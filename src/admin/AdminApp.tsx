import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Headphones,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Edit3,
  Sliders,
  UserCheck,
  Phone,
  Globe,
  UserCog,
  CheckSquare,
  Square,
  X,
  Trash2,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Copy,
  Layers,
  CheckCircle2,
  Filter,
  Mic,
  Activity,
  Award,
  ClipboardCheck,
  KeyRound,
  AlertCircle,
} from "lucide-react";
import { PlatformGuard } from "../auth/PlatformGuard";
import { useAuth } from "../auth/useAuth";
import { apiFetch, safeJson } from "../lib/api";
import type { PlatformId, UserRole } from "../types";
import { PhoneInput } from "../shared/components/PhoneInput";
import { ARAB_COUNTRIES } from "../lib/phoneUtils";
import { AdminVolunteers } from "./AdminVolunteers";
import { CertificateManager } from "../components/CertificateManager";
import { EditUserProfileModal } from "./EditUserProfileModal";
import { AdminPermissionsMatrix } from "./AdminPermissionsMatrix";
import { RestoreDeletedUsersModal } from "./RestoreDeletedUsersModal";
import { DeduplicateUsersModal } from "./DeduplicateUsersModal";
import { EnsatPlatformsHub } from "./EnsatPlatformsHub";
import { AdminMigrationAudit } from "./AdminMigrationAudit";
import "./admin.css";

export type PlatformAccess = Partial<
  Record<"recording" | "tasks" | "rewards" | "admin", boolean>
>;
export type AdminMember = {
  uid: string;
  id?: string;
  name: string;
  username?: string;
  email: string;
  phone?: string;
  country?: string;
  nationality?: string;
  department?: string;
  role: UserRole;
  status?: string;
  bio?: string;
  age?: string | number;
  field?: string;
  publicProfileConsent?: boolean;
  platformAccess?: PlatformAccess;
  actionAccess?: Record<string, "ALLOW" | "DENY" | "INHERIT" | boolean>;
  migratedViaPin?: boolean;
  legacyMigrated?: boolean;
  migrationAuditStatus?: "PENDING_AUDIT" | "VERIFIED" | "FLAGGED";
  migrationAuditedBy?: string;
  migrationAuditedAt?: string;
  migrationAuditNotes?: string;
  migratedAt?: string;
  legacyId?: string;
};

const operationalPlatforms = [
  { id: "recording" as const, label: "التسجيل", icon: Headphones },
  { id: "tasks" as const, label: "المهام", icon: ListTodo },
  { id: "rewards" as const, label: "النقاط", icon: LayoutDashboard },
  { id: "admin" as const, label: "الإدارة", icon: ShieldCheck },
];

const roleDefaults: Record<string, PlatformAccess> = {
  SUPER_ADMIN: { recording: true, tasks: true, rewards: true, admin: true },
  ADMIN: { recording: true, tasks: true, rewards: true, admin: true },
  AUDIO_ENGINEER: { recording: true, tasks: true, rewards: true, admin: false },
  QA_REVIEWER: { recording: true, tasks: true, rewards: true, admin: false },
  NARRATOR: { recording: true, tasks: true, rewards: true, admin: false },
  MEMBER: { recording: true, tasks: true, rewards: true, admin: false },
};

function resolvedAccess(member: AdminMember, id: keyof PlatformAccess) {
  return (
    member.platformAccess?.[id] ?? roleDefaults[member.role]?.[id] ?? false
  );
}

function AdminWorkspace() {
  const { user, refreshUser } = useAuth();
  const isSuperAdmin =
    user?.role === "SUPER_ADMIN" ||
    user?.canonicalRole === "SUPER_ADMIN" ||
    (user as any)?.is_super_admin === true;
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [countryFilter, setCountryFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeduplicateModal, setShowDeduplicateModal] = useState(false);
  const [editingMember, setEditingMember] = useState<AdminMember | null>(null);
  const [deleteTargetModal, setDeleteTargetModal] = useState<{
    type: "single" | "bulk";
    member?: AdminMember;
    count?: number;
    uids?: string[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "members"
    | "platforms"
    | "permissions"
    | "volunteers"
    | "certificates"
    | "audit"
    | "cms"
  >("members");
  const [canEditCms, setCanEditCms] = useState(false);
  const [copiedId, setCopiedId] = useState<string>("");

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await apiFetch("/api/admin/users");
      const payload = await safeJson<{
        success?: boolean;
        users?: AdminMember[];
        error?: string;
      }>(response, {
        success: false,
        error: "تعذر تحميل الأعضاء",
      });
      if (!response.ok || !payload.success)
        throw new Error(payload.error || "تعذر تحميل الأعضاء");
      setMembers(payload.users || []);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تحميل الأعضاء");
    } finally {
      setLoading(false);
    }
  }, []);

  const pendingAuditCount = useMemo(() => {
    return members.filter(
      (m) =>
        (m.legacyMigrated || m.migratedViaPin) &&
        m.migrationAuditStatus !== "VERIFIED",
    ).length;
  }, [members]);

  useEffect(() => {
    let isCancelled = false;
    async function verifyCmsAccess() {
      if (!user) return;
      try {
        const res = await apiFetch("/api/admin/check-cms-permission");
        if (!isCancelled) {
          if (res.ok) {
            const data = await safeJson<{ allowed?: boolean }>(res, {
              allowed: false,
            });
            setCanEditCms(Boolean(data?.allowed));
          } else {
            setCanEditCms(false);
          }
        }
      } catch {
        if (!isCancelled) setCanEditCms(false);
      }
    }
    verifyCmsAccess();
    if (
      activeTab === "members" ||
      activeTab === "platforms" ||
      activeTab === "permissions" ||
      activeTab === "audit"
    )
      void loadMembers();
    return () => {
      isCancelled = true;
    };
  }, [loadMembers, user, activeTab]);

  // Derived filtered members
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter((member) => {
      // Search query
      if (needle) {
        const matches = [
          member.name,
          member.username,
          member.email,
          member.phone,
          member.department,
          member.country,
          member.legacyId,
        ].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(needle),
        );
        if (!matches) return false;
      }

      // Role filter
      if (roleFilter !== "ALL") {
        if (roleFilter === "ADMINS") {
          if (
            ![
              "SUPER_ADMIN",
              "ADMIN",
              "OPERATIONS_MANAGER",
              "CONTENT_MANAGER",
              "MEMBERS_MANAGER",
            ].includes(member.role)
          )
            return false;
        } else if (roleFilter === "CREATIVE") {
          if (
            !["NARRATOR", "AUDIO_ENGINEER", "QA_REVIEWER"].includes(member.role)
          )
            return false;
        } else if (member.role !== roleFilter) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "MIGRATED_PENDING") {
          if (
            !(member.legacyMigrated || member.migratedViaPin) ||
            member.migrationAuditStatus === "VERIFIED"
          )
            return false;
        } else if (statusFilter === "MIGRATED_ALL") {
          if (!(member.legacyMigrated || member.migratedViaPin)) return false;
        } else {
          const currentStatus = member.status || "active";
          if (currentStatus !== statusFilter) return false;
        }
      }

      // Country filter
      if (countryFilter !== "ALL") {
        if ((member.country || "") !== countryFilter) return false;
      }

      return true;
    });
  }, [members, query, roleFilter, statusFilter, countryFilter]);

  // KPI Stats
  const stats = useMemo(() => {
    let adminCount = 0;
    let narratorCount = 0;
    let engineerCount = 0;
    let activeCount = 0;
    let disabledCount = 0;

    members.forEach((m) => {
      if (
        [
          "SUPER_ADMIN",
          "ADMIN",
          "OPERATIONS_MANAGER",
          "CONTENT_MANAGER",
          "MEMBERS_MANAGER",
        ].includes(m.role)
      )
        adminCount++;
      if (m.role === "NARRATOR") narratorCount++;
      if (m.role === "AUDIO_ENGINEER" || m.role === "QA_REVIEWER")
        engineerCount++;
      if (m.status === "disabled" || m.status === "suspended") disabledCount++;
      else activeCount++;
    });

    return {
      total: members.length,
      admins: adminCount,
      narrators: narratorCount,
      engineers: engineerCount,
      active: activeCount,
      disabled: disabledCount,
    };
  }, [members]);

  // Unique countries in dataset for dropdown
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.country && m.country.trim()) set.add(m.country.trim());
    });
    return Array.from(set).sort();
  }, [members]);

  // Bulk Selection States & Handlers
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<string>("NARRATOR");
  const [bulkCountry, setBulkCountry] = useState<string>("العراق");
  const [bulkStatus, setBulkStatus] = useState<string>("active");
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  const toggleSelectAll = () => {
    if (selectedUids.size === filtered.length && filtered.length > 0) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(
        new Set(filtered.map((m) => m.uid || m.id || "").filter(Boolean)),
      );
    }
  };

  const toggleSelectMember = (uid: string) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const executeBulkUpdate = async (updates: {
    role?: string;
    country?: string;
    status?: string;
    platformAccess?: PlatformAccess;
  }) => {
    if (selectedUids.size === 0) return;
    setBulkBusy(true);
    setNotice("");
    try {
      const uidsArray = Array.from(selectedUids);
      const res = await apiFetch("/api/admin/users/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uids: uidsArray,
          ...updates,
        }),
      });
      const data = await safeJson<{
        success?: boolean;
        error?: string;
        updatedCount?: number;
      }>(res, { success: false, error: "تعذر التحديث الجماعي" });
      if (!res.ok || !data.success) {
        throw new Error(data.error || "فشل التحديث الجماعي");
      }
      // Update local state reactively
      setMembers((current) =>
        current.map((m) => {
          const mUid = m.uid || m.id || "";
          if (!selectedUids.has(mUid)) return m;
          return {
            ...m,
            ...(updates.role ? { role: updates.role as UserRole } : {}),
            ...(updates.country
              ? { country: updates.country, nationality: updates.country }
              : {}),
            ...(updates.status
              ? {
                  status: updates.status,
                  isActive: updates.status === "active",
                }
              : {}),
            ...(updates.platformAccess
              ? {
                  platformAccess: {
                    ...(m.platformAccess || {}),
                    ...updates.platformAccess,
                  },
                }
              : {}),
          };
        }),
      );
      setNotice(
        `✅ تم بنجاح تحديث ${data.updatedCount || uidsArray.length} حساب.`,
      );
      setSelectedUids(new Set());
      setTimeout(() => setNotice(""), 4500);
      if (user && selectedUids.has(user.id)) {
        await refreshUser();
      }
    } catch (err: any) {
      setNotice(err.message || "حدث خطأ أثناء التحديث الجماعي");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedUids.size === 0) return;
    setDeleteTargetModal({
      type: "bulk",
      count: selectedUids.size,
      uids: Array.from(selectedUids),
    });
  };

  const handleDeleteMember = (member: AdminMember) => {
    const targetUid = member.uid || member.id;
    if (!targetUid) return;
    setDeleteTargetModal({
      type: "single",
      member,
    });
  };

  const confirmExecuteDelete = async () => {
    if (!deleteTargetModal) return;

    if (deleteTargetModal.type === "bulk") {
      const uidsArray = deleteTargetModal.uids || [];
      if (uidsArray.length === 0) return;
      setBulkBusy(true);
      setNotice("");
      try {
        const res = await apiFetch("/api/admin/users/bulk-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uids: uidsArray }),
        });
        const data = await safeJson<{
          success?: boolean;
          error?: string;
          deletedCount?: number;
        }>(res, {
          success: false,
          error: "فشل الحذف الجماعي",
        });
        if (!res.ok || !data.success) {
          throw new Error(data.error || "فشل الحذف الجماعي");
        }
        setMembers((current) =>
          current.filter((m) => !uidsArray.includes(m.uid || m.id || "")),
        );
        setSelectedUids(new Set());
        setDeleteTargetModal(null);
        setNotice(
          `✅ تم حذف ${data.deletedCount || uidsArray.length} عضو بنجاح.`,
        );
        setTimeout(() => setNotice(""), 4500);
      } catch (err: any) {
        setNotice(err.message || "حدث خطأ أثناء الحذف الجماعي");
      } finally {
        setBulkBusy(false);
      }
    } else if (
      deleteTargetModal.type === "single" &&
      deleteTargetModal.member
    ) {
      const targetUid =
        deleteTargetModal.member.uid || deleteTargetModal.member.id;
      const targetName = deleteTargetModal.member.name || "العضو";
      if (!targetUid) return;

      setBusy(`delete:${targetUid}`);
      setNotice("");
      try {
        const res = await apiFetch(
          `/api/admin/users/${encodeURIComponent(targetUid)}`,
          {
            method: "DELETE",
          },
        );
        const data = await safeJson<{ success?: boolean; error?: string }>(
          res,
          {
            success: false,
            error: "تعذر حذف العضو",
          },
        );
        if (!res.ok || !data.success) {
          throw new Error(data.error || "تعذر حذف العضو");
        }
        setMembers((current) =>
          current.filter((m) => m.uid !== targetUid && m.id !== targetUid),
        );
        setDeleteTargetModal(null);
        setNotice(`✅ تم حذف العضو "${targetName}" بنجاح.`);
        setTimeout(() => setNotice(""), 4500);
      } catch (err: any) {
        setNotice(err.message || "فشل في حذف العضو");
      } finally {
        setBusy("");
      }
    }
  };

  const updateAccess = async (
    member: AdminMember,
    platform: keyof PlatformAccess,
    enabled: boolean,
  ) => {
    const targetUid = member.uid || member.id;
    const next: Required<PlatformAccess> = {
      recording: resolvedAccess(member, "recording"),
      tasks: resolvedAccess(member, "tasks"),
      rewards: resolvedAccess(member, "rewards"),
      admin: resolvedAccess(member, "admin"),
      [platform]: enabled,
    };
    setBusy(`${targetUid}:${platform}`);
    setNotice("");
    try {
      const response = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}/platform-access`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platformAccess: next }),
        },
      );
      const payload = await safeJson<{ success?: boolean; error?: string }>(
        response,
        { success: false, error: "تعذر الاتصال بالخادم لتحديث الصلاحية" },
      );
      if (!response.ok || !payload.success)
        throw new Error(payload.error || "تعذر تحديث الصلاحية");
      setMembers((current) =>
        current.map((item) =>
          item.uid === targetUid || item.id === targetUid
            ? { ...item, platformAccess: next }
            : item,
        ),
      );
      if (targetUid === user?.id) await refreshUser();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "تعذر تحديث الصلاحية");
    } finally {
      setBusy("");
    }
  };

  const handleQuickRoleChange = async (
    member: AdminMember,
    newRole: string,
  ) => {
    const targetUid = member.uid || member.id;
    if (!targetUid) return;
    setBusy(`role:${targetUid}`);
    try {
      const res = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}/role`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );
      const data = await safeJson<{ success?: boolean; error?: string }>(res, {
        success: false,
        error: "تعذر تعديل الدور",
      });
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر تعديل الدور");
      }
      setMembers((current) =>
        current.map((m) =>
          m.uid === targetUid || m.id === targetUid
            ? { ...m, role: newRole as UserRole }
            : m,
        ),
      );
      setNotice(`✅ تم تغيير دور "${member.name}" إلى ${newRole} بنجاح.`);
      setTimeout(() => setNotice(""), 3500);
      if (targetUid === user?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      setNotice(err.message || "فشل في تغيير الدور");
    } finally {
      setBusy("");
    }
  };

  const handleQuickStatusChange = async (
    member: AdminMember,
    newStatus: string,
  ) => {
    const targetUid = member.uid || member.id;
    if (!targetUid) return;
    setBusy(`status:${targetUid}`);
    try {
      const res = await apiFetch(
        `/api/admin/users/${encodeURIComponent(targetUid)}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await safeJson<{ success?: boolean; error?: string }>(res, {
        success: false,
        error: "تعذر تعديل الحالة",
      });
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر تعديل الحالة");
      }
      setMembers((current) =>
        current.map((m) =>
          m.uid === targetUid || m.id === targetUid
            ? {
                ...m,
                status: newStatus as any,
                accountStatus: newStatus as any,
                isActive: newStatus === "active",
              }
            : m,
        ),
      );
      const statusLabel =
        newStatus === "active"
          ? "نشط"
          : newStatus === "pending"
            ? "قيد المراجعة"
            : "موقوف";
      setNotice(`✅ تم تغيير حالة "${member.name}" إلى ${statusLabel} بنجاح.`);
      setTimeout(() => setNotice(""), 3500);
      if (targetUid === user?.id) {
        await refreshUser();
      }
    } catch (err: any) {
      setNotice(err.message || "فشل في تغيير الحالة");
    } finally {
      setBusy("");
    }
  };

  const handleMemberSaved = async (updated: AdminMember) => {
    setMembers((current) =>
      current.map((item) => {
        const itemUid = item.uid || item.id;
        const updatedUid = updated.uid || updated.id;
        return itemUid === updatedUid ? { ...item, ...updated } : item;
      }),
    );
    if ((updated.uid || updated.id) === user?.id) {
      await refreshUser();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 2500);
  };

  return (
    <div className="admin-platform" dir="rtl">
      <header className="admin-topbar">
        <a className="admin-brand" href="/portal">
          <span>
            <ShieldCheck size={23} />
          </span>
          <div>
            <strong>إدارة إنصات</strong>
            <small>مركز الصلاحيات والحسابات الموحدة</small>
          </div>
        </a>

        <div className="flex flex-wrap gap-2 md:gap-2.5">
          <button
            onClick={() => setActiveTab("members")}
            className={`px-3.5 py-2 font-black text-xs md:text-sm rounded-xl transition flex items-center gap-1.5 ${activeTab === "members" ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            id="tab-btn-members"
          >
            <Users size={16} />
            إدارة الأعضاء والأسماء
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-3.5 py-2 font-black text-xs md:text-sm rounded-xl transition flex items-center gap-1.5 relative ${activeTab === "audit" ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            id="tab-btn-audit"
          >
            <ClipboardCheck size={16} />
            <span>قسم التدقيق والترحيل</span>
            {pendingAuditCount > 0 && (
              <span className="bg-amber-500 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
                {pendingAuditCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("platforms")}
            className={`px-3.5 py-2 font-black text-xs md:text-sm rounded-xl transition flex items-center gap-1.5 ${activeTab === "platforms" ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            id="tab-btn-platforms"
          >
            <Layers size={16} />
            إدارة منصات إنصات
          </button>
          <button
            onClick={() => setActiveTab("permissions")}
            className={`px-3.5 py-2 font-black text-xs md:text-sm rounded-xl transition flex items-center gap-1.5 ${activeTab === "permissions" ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            id="tab-btn-permissions"
          >
            <Sliders size={16} />
            الصلاحيات والأذونات (RBAC)
          </button>
          <button
            onClick={() => setActiveTab("volunteers")}
            className={`px-3.5 py-2 font-black text-xs md:text-sm rounded-xl transition flex items-center gap-1.5 ${activeTab === "volunteers" ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            id="tab-btn-volunteers"
          >
            <UserCheck size={16} />
            طلبات التطوع
          </button>
          <button
            onClick={() => setActiveTab("certificates")}
            className={`px-3.5 py-2 font-black text-xs md:text-sm rounded-xl transition flex items-center gap-1.5 ${activeTab === "certificates" ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
            id="tab-btn-certificates"
          >
            <Award size={16} />
            Certificates
          </button>
          {canEditCms && (
            <button
              onClick={() => setActiveTab("cms")}
              className={`px-3.5 py-2 font-black text-xs md:text-sm rounded-xl transition flex items-center gap-1.5 ${activeTab === "cms" ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              id="tab-btn-cms"
            >
              <Edit3 size={16} />
              المحتوى والواجهة
            </button>
          )}
        </div>

        <div className="admin-account">
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.email}</small>
          </div>
          <span>{user?.role_display_ar}</span>
        </div>
      </header>

      <main className="admin-main">
        {activeTab === "members" ? (
          <>
            {/* KPI Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center gap-3">
                <div className="p-3 bg-amber-400/10 text-amber-400 rounded-xl">
                  <Users size={22} />
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">
                    إجمالي الحسابات
                  </span>
                  <strong className="text-white text-xl font-black">
                    {stats.total}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center gap-3">
                <div className="p-3 bg-purple-400/10 text-purple-400 rounded-xl">
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">
                    الإدارة والمدراء
                  </span>
                  <strong className="text-white text-xl font-black">
                    {stats.admins}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center gap-3">
                <div className="p-3 bg-blue-400/10 text-blue-400 rounded-xl">
                  <Mic size={22} />
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">
                    الرواة والمسجلين
                  </span>
                  <strong className="text-white text-xl font-black">
                    {stats.narrators}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center gap-3">
                <div className="p-3 bg-cyan-400/10 text-cyan-400 rounded-xl">
                  <Activity size={22} />
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">
                    هندسة وجودة الصوت
                  </span>
                  <strong className="text-white text-xl font-black">
                    {stats.engineers}
                  </strong>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex items-center gap-3 col-span-2 sm:col-span-1">
                <div className="p-3 bg-emerald-400/10 text-emerald-400 rounded-xl">
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">
                    الحسابات النشطة
                  </span>
                  <strong className="text-emerald-400 text-xl font-black">
                    {stats.active}
                  </strong>
                </div>
              </div>
            </div>

            {/* Advanced Filters & Action Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 mb-5">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search
                    size={18}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ابحث بالاسم، اسم المستخدم، البريد، الهاتف، الدولة أو القسم..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pr-10 pl-9 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition"
                    id="input-search-members"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                    >
                      <X size={15} />
                    </button>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    onClick={() => void loadMembers()}
                    disabled={loading}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition border border-slate-700"
                    id="btn-refresh-members"
                  >
                    <RefreshCw
                      className={loading ? "spin text-amber-400" : ""}
                      size={15}
                    />
                    <span>تحديث</span>
                  </button>

                  <button
                    onClick={() => setShowRestoreModal(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                    id="btn-open-restore-modal"
                    title="سجل الحسابات المحذوفة واسترجاع الأسماء"
                  >
                    <RotateCcw size={15} className="text-amber-400" />
                    <span>سلة المحذوفات</span>
                  </button>

                  <button
                    onClick={() => setShowDeduplicateModal(true)}
                    disabled={loading}
                    className="px-3.5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
                    id="btn-deduplicate-users"
                    title="فحص ومعاينة الأسماء المتكررة واختيار الحساب الأساسي قبل الحذف"
                  >
                    <Sparkles size={15} className="text-amber-400" />
                    <span>الأسماء المتكررة</span>
                  </button>

                  <button
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 transition shadow-lg shadow-amber-400/20"
                    onClick={() => setShowCreate((value) => !value)}
                    id="btn-create-member-toggle"
                  >
                    <Plus size={17} />
                    <span>إضافة عضو جديد</span>
                  </button>
                </div>
              </div>

              {/* Secondary Filter Row: Roles, Status & Country */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Role Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-slate-400 font-bold flex items-center gap-1 ml-1">
                    <Filter size={13} /> التصفية:
                  </span>
                  {[
                    { id: "ALL", label: "الكل" },
                    { id: "ADMINS", label: "المدراء والإشراف" },
                    { id: "NARRATOR", label: "الرواة" },
                    { id: "AUDIO_ENGINEER", label: "مهندسو الصوت" },
                    { id: "QA_REVIEWER", label: "مراجعي الجودة" },
                    { id: "MEMBER", label: "المتطوعين" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setRoleFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition ${
                        roleFilter === tab.id
                          ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                          : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Status & Country Dropdowns */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Status Dropdown */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-300">
                    <span className="text-slate-500 text-[11px]">الحالة:</span>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="bg-transparent text-amber-300 text-xs font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="ALL">جميع الحالات</option>
                      <option value="active">نشط فقط</option>
                      <option value="pending">قيد المراجعة</option>
                      <option value="disabled">موقوف</option>
                      <option value="MIGRATED_PENDING">
                        ⏳ ترحيل PIN (بانتظار التدقيق)
                      </option>
                      <option value="MIGRATED_ALL">
                        ⚡ جميع الحسابات المرحّلة
                      </option>
                    </select>
                  </div>

                  {/* Country Dropdown */}
                  {availableCountries.length > 0 && (
                    <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-300">
                      <Globe size={13} className="text-slate-500" />
                      <select
                        value={countryFilter}
                        onChange={(e) => setCountryFilter(e.target.value)}
                        className="bg-transparent text-amber-300 text-xs font-bold focus:outline-none cursor-pointer max-w-[120px]"
                      >
                        <option value="ALL">جميع الدول</option>
                        {availableCountries.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(query ||
                    roleFilter !== "ALL" ||
                    statusFilter !== "ALL" ||
                    countryFilter !== "ALL") && (
                    <button
                      onClick={() => {
                        setQuery("");
                        setRoleFilter("ALL");
                        setStatusFilter("ALL");
                        setCountryFilter("ALL");
                      }}
                      className="px-2 py-1 text-slate-400 hover:text-amber-300 transition text-[11px] underline"
                    >
                      إعادة ضبط
                    </button>
                  )}
                </div>
              </div>
            </div>

            {notice && (
              <div className="p-3.5 bg-slate-900 border-2 border-amber-400/80 rounded-2xl text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-3 shadow-lg mb-4 animate-in fade-in">
                <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {showCreate && (
              <CreateMember
                onCreated={() => {
                  setShowCreate(false);
                  void loadMembers();
                }}
              />
            )}

            {/* Bulk Actions Toolbar (Visible when 1+ members selected) */}
            {selectedUids.size > 0 && (
              <div className="sticky top-2 z-30 bg-slate-900 border-2 border-amber-500/90 rounded-2xl p-3.5 sm:p-4 shadow-2xl backdrop-blur-md mb-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 animate-in fade-in">
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black rounded-xl flex items-center gap-2 shadow-md shrink-0 text-xs sm:text-sm">
                    <CheckSquare size={17} />
                    <span>{selectedUids.size} عضو محدد</span>
                  </div>
                  <span className="text-xs text-amber-200 font-bold hidden sm:inline">
                    تطبيق التعديلات الجماعية:
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                  {/* Bulk Role */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1">
                    <select
                      value={bulkRole}
                      onChange={(e) => setBulkRole(e.target.value)}
                      className="bg-transparent text-amber-300 text-xs font-bold focus:outline-none cursor-pointer"
                      disabled={bulkBusy}
                      title="الدور المراد تطبيقه"
                    >
                      <option value="MEMBER">عضو متطوع</option>
                      <option value="NARRATOR">راوي (صلاحية الرفع فقط)</option>
                      <option value="AUDIO_ENGINEER">
                        مهندس صوت (المونتاج فقط)
                      </option>
                      <option value="QA_REVIEWER">
                        مدقق جودة (التدقيق فقط)
                      </option>
                      <option value="OPERATIONS_MANAGER">مدير عمليات</option>
                      <option value="CONTENT_MANAGER">مدير محتوى</option>
                      <option value="MEMBERS_MANAGER">مدير أعضاء</option>
                      <option value="REWARDS_MANAGER">مدير مكافآت</option>
                      <option value="CERTIFICATE_MANAGER">مدير شهادات</option>
                      <option value="ADMIN">مدير نظام</option>
                    </select>
                    <button
                      onClick={() => void executeBulkUpdate({ role: bulkRole })}
                      disabled={bulkBusy}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition disabled:opacity-50 shrink-0"
                    >
                      تغيير الدور
                    </button>
                  </div>

                  {/* Bulk Country */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1">
                    <select
                      value={bulkCountry}
                      onChange={(e) => setBulkCountry(e.target.value)}
                      className="bg-transparent text-amber-300 text-xs font-bold focus:outline-none cursor-pointer max-w-[100px]"
                      disabled={bulkBusy}
                      title="الدولة المراد تطبيقها"
                    >
                      {ARAB_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.nameAr}>
                          {c.flag} {c.nameAr}
                        </option>
                      ))}
                      <option value="دولة أخرى">🌍 دولة أخرى</option>
                    </select>
                    <button
                      onClick={() =>
                        void executeBulkUpdate({ country: bulkCountry })
                      }
                      disabled={bulkBusy}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition disabled:opacity-50 shrink-0"
                    >
                      تغيير الدولة
                    </button>
                  </div>

                  {/* Bulk Status */}
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1">
                    <select
                      value={bulkStatus}
                      onChange={(e) => setBulkStatus(e.target.value)}
                      className="bg-transparent text-amber-300 text-xs font-bold focus:outline-none cursor-pointer"
                      disabled={bulkBusy}
                    >
                      <option value="active">نشط</option>
                      <option value="pending">قيد المراجعة</option>
                      <option value="disabled">موقوف</option>
                    </select>
                    <button
                      onClick={() =>
                        void executeBulkUpdate({ status: bulkStatus })
                      }
                      disabled={bulkBusy}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition disabled:opacity-50 shrink-0"
                    >
                      تغيير الحالة
                    </button>
                  </div>

                  {/* Bulk Delete */}
                  <button
                    onClick={() => void handleBulkDelete()}
                    disabled={bulkBusy}
                    className="px-3.5 py-1.5 bg-red-950 hover:bg-red-900 border border-red-500/70 text-red-200 text-xs font-black rounded-xl transition disabled:opacity-50 flex items-center gap-1.5 shrink-0 shadow-sm"
                    title="حذف جميع الأعضاء المحددين نهائياً"
                  >
                    <Trash2 size={14} className="text-red-400" />
                    <span>حذف المحدد ({selectedUids.size})</span>
                  </button>

                  {/* Cancel selection */}
                  <button
                    onClick={() => setSelectedUids(new Set())}
                    disabled={bulkBusy}
                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition shrink-0"
                    title="إلغاء التحديد"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Member List */}
            <section className="admin-member-list" aria-busy={loading}>
              <div className="admin-list-head flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={toggleSelectAll}
                    className="p-1 text-slate-400 hover:text-amber-400 transition"
                    title={
                      filtered.length > 0 &&
                      selectedUids.size === filtered.length
                        ? "إلغاء تحديد الكل"
                        : "تحديد جميع الأعضاء المعروضين"
                    }
                    id="btn-toggle-select-all"
                  >
                    {filtered.length > 0 &&
                    selectedUids.size === filtered.length ? (
                      <CheckSquare size={17} className="text-amber-400" />
                    ) : (
                      <Square size={17} />
                    )}
                  </button>
                  <span>العضو والمعلومات الشخصية ({filtered.length})</span>
                </div>
                <div>الدور الوظيفي والحالة</div>
                <div>دخول المنصات والإجراءات</div>
              </div>

              {loading ? (
                <div className="admin-empty">
                  <Loader2 className="spin" /> جارٍ تحميل الدليل الموحّد…
                </div>
              ) : (
                filtered.map((member) => {
                  const mUid = member.uid || member.id || "";
                  const isSelected = selectedUids.has(mUid);
                  return (
                    <article
                      className={`admin-member transition-all ${isSelected ? "ring-2 ring-amber-400/80 bg-amber-500/5" : ""}`}
                      key={mUid}
                    >
                      <div className="admin-identity">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => toggleSelectMember(mUid)}
                            className="p-1 text-slate-400 hover:text-amber-400 transition shrink-0"
                            title="تحديد هذا العضو"
                          >
                            {isSelected ? (
                              <CheckSquare
                                size={17}
                                className="text-amber-400"
                              />
                            ) : (
                              <Square size={17} />
                            )}
                          </button>
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-md shrink-0">
                            {member.name.trim().charAt(0) || "ع"}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <strong className="text-sm sm:text-base font-black text-white">
                              {member.name}
                            </strong>
                            {member.country && (
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/30 text-amber-300 flex items-center gap-1 font-medium">
                                <Globe size={11} /> {member.country}
                              </span>
                            )}
                            {(member.migratedViaPin ||
                              member.legacyMigrated) && (
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-md border font-bold flex items-center gap-1 ${
                                  member.migrationAuditStatus === "VERIFIED"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                    : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                }`}
                                title={
                                  member.migrationAuditStatus === "VERIFIED"
                                    ? "تم تدقيق الترحيل واعتماده"
                                    : "حساب مرحل من النظام القديم بانتظار التدقيق اليدوي"
                                }
                              >
                                <ClipboardCheck size={11} />
                                {member.migrationAuditStatus === "VERIFIED"
                                  ? "ترحيل موثّق"
                                  : "ترحيل (بانتظار التدقيق)"}
                              </span>
                            )}
                            {((member as any).status === "pending_activation" ||
                              (member as any).isInvite) && (
                              <span
                                className="text-[10px] px-2 py-0.5 rounded-md border font-bold flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                title={
                                  (member as any).pin
                                    ? `كود التفعيل: ${(member as any).pin}`
                                    : "بانتظار تفعيل العضو"
                                }
                              >
                                <KeyRound size={11} />
                                <span>
                                  بانتظار التفعيل{" "}
                                  {(member as any).pin
                                    ? `(${(member as any).pin})`
                                    : ""}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5 flex-wrap">
                            <span>@{member.username || "بدون_مستخدم"}</span>
                            <span>·</span>
                            {(member.email || member.phone) && (
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    (member.email || member.phone)!,
                                    `contact:${mUid}`,
                                  )
                                }
                                className="hover:text-amber-300 transition flex items-center gap-1"
                                title={
                                  member.email
                                    ? "نسخ البريد الإلكتروني"
                                    : "نسخ رقم الهاتف"
                                }
                              >
                                <span>{member.email || member.phone}</span>
                                {copiedId === `contact:${mUid}` ? (
                                  <Check
                                    size={11}
                                    className="text-emerald-400"
                                  />
                                ) : (
                                  <Copy size={11} className="opacity-60" />
                                )}
                              </button>
                            )}
                          </div>
                          {member.phone && member.email && (
                            <div
                              className="flex items-center gap-1 text-[11px] text-slate-400 font-mono"
                              dir="ltr"
                            >
                              <Phone size={11} className="text-slate-500" />
                              <span>{member.phone}</span>
                            </div>
                          )}
                          {member.department && (
                            <em className="text-slate-500 text-[11px] block mt-0.5">
                              {member.department}
                            </em>
                          )}
                        </div>
                      </div>

                      <div className="admin-role flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role || "MEMBER"}
                            onChange={(e) =>
                              void handleQuickRoleChange(member, e.target.value)
                            }
                            disabled={busy === `role:${mUid}`}
                            className="bg-slate-950 border border-slate-700 text-amber-300 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner transition"
                            title="تغيير الدور الوظيفي مباشرة"
                          >
                            <option value="MEMBER">عضو (MEMBER)</option>
                            <option value="NARRATOR">راوي (NARRATOR)</option>
                            <option value="AUDIO_ENGINEER">
                              مهندس صوت (AUDIO_ENGINEER)
                            </option>
                            <option value="QA_REVIEWER">
                              مراجع جودة (QA_REVIEWER)
                            </option>
                            <option value="OPERATIONS_MANAGER">
                              مدير عمليات (OPERATIONS_MANAGER)
                            </option>
                            <option value="CONTENT_MANAGER">
                              مدير محتوى (CONTENT_MANAGER)
                            </option>
                            <option value="MEMBERS_MANAGER">
                              مدير أعضاء (MEMBERS_MANAGER)
                            </option>
                            <option value="REWARDS_MANAGER">
                              مدير مكافآت (REWARDS_MANAGER)
                            </option>
                            <option value="CERTIFICATE_MANAGER">
                              مدير شهادات (CERTIFICATE_MANAGER)
                            </option>
                            <option value="ADMIN">مدير نظام (ADMIN)</option>
                            {user?.role === "SUPER_ADMIN" && (
                              <option value="SUPER_ADMIN">
                                مدير عام (SUPER_ADMIN)
                              </option>
                            )}
                          </select>
                          {busy === `role:${mUid}` && (
                            <Loader2
                              size={13}
                              className="spin text-amber-400"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.status || "active"}
                            onChange={(e) =>
                              void handleQuickStatusChange(
                                member,
                                e.target.value,
                              )
                            }
                            disabled={busy === `status:${mUid}`}
                            className={`bg-slate-950 border text-xs font-bold rounded-lg px-2 py-1 focus:outline-none cursor-pointer transition shadow-inner ${
                              member.status === "disabled" ||
                              member.status === "suspended"
                                ? "border-rose-800/80 text-rose-400"
                                : member.status === "pending"
                                  ? "border-amber-800/80 text-amber-400"
                                  : "border-emerald-800/80 text-emerald-400"
                            }`}
                            title="تغيير حالة الحساب مباشرة"
                          >
                            <option
                              value="active"
                              className="bg-slate-900 text-emerald-400"
                            >
                              🟢 نشط
                            </option>
                            <option
                              value="pending"
                              className="bg-slate-900 text-amber-400"
                            >
                              🟡 قيد المراجعة
                            </option>
                            <option
                              value="disabled"
                              className="bg-slate-900 text-rose-400"
                            >
                              🔴 موقوف
                            </option>
                          </select>
                          {busy === `status:${mUid}` && (
                            <Loader2
                              size={13}
                              className="spin text-emerald-400"
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="admin-access">
                          {operationalPlatforms.map((platform) => {
                            const Icon = platform.icon;
                            const enabled = resolvedAccess(member, platform.id);
                            const key = `${mUid}:${platform.id}`;
                            return (
                              <button
                                key={platform.id}
                                className={enabled ? "enabled" : ""}
                                disabled={!!busy || !isSuperAdmin}
                                onClick={() =>
                                  void updateAccess(
                                    member,
                                    platform.id,
                                    !enabled,
                                  )
                                }
                                aria-pressed={enabled}
                                title={`تعديل وصول منصة ${platform.label}`}
                              >
                                <Icon size={15} />
                                <span>{platform.label}</span>
                                {busy === key ? (
                                  <Loader2 className="spin" size={13} />
                                ) : enabled ? (
                                  <Check size={13} />
                                ) : null}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => setEditingMember(member)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition shrink-0"
                          title="تعديل كافة بيانات الملف الشخصي"
                          id={`btn-edit-profile-${mUid}`}
                        >
                          <UserCog size={15} />
                          <span>تعديل الملف</span>
                        </button>

                        {(user?.role === "SUPER_ADMIN" ||
                          user?.role === "ADMIN" ||
                          user?.role === "MEMBERS_MANAGER") &&
                          mUid !== user?.id && (
                            <button
                              onClick={() => void handleDeleteMember(member)}
                              disabled={busy === `delete:${mUid}`}
                              className="p-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 hover:text-red-100 transition shrink-0 disabled:opacity-50"
                              title={`حذف العضو ${member.name} نهائياً`}
                              id={`btn-delete-member-${mUid}`}
                            >
                              {busy === `delete:${mUid}` ? (
                                <Loader2
                                  size={15}
                                  className="spin text-red-400"
                                />
                              ) : (
                                <Trash2 size={15} />
                              )}
                            </button>
                          )}
                      </div>
                    </article>
                  );
                })
              )}

              {!loading && !filtered.length && (
                <div className="admin-empty">لا توجد نتائج مطابقة لبحثك.</div>
              )}
            </section>
          </>
        ) : activeTab === "audit" ? (
          <AdminMigrationAudit
            members={members}
            onEditMember={setEditingMember}
          />
        ) : activeTab === "platforms" ? (
          <EnsatPlatformsHub
            members={members}
            onMemberUpdated={handleMemberSaved}
            currentUserRole={isSuperAdmin ? "SUPER_ADMIN" : user?.role}
          />
        ) : activeTab === "permissions" ? (
          <AdminPermissionsMatrix
            members={members}
            onMemberUpdated={handleMemberSaved}
            currentUserRole={isSuperAdmin ? "SUPER_ADMIN" : user?.role}
          />
        ) : activeTab === "volunteers" ? (
          <AdminVolunteers />
        ) : activeTab === "certificates" ? (
          <CertificateManager users={members} />
        ) : (
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center gap-6 mt-8">
            <Edit3 size={48} className="text-amber-400 opacity-80" />
            <div>
              <h2 className="text-2xl font-black text-white mb-2">
                إدارة نصوص الواجهة (CMS)
              </h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                يمكنك تعديل نصوص الواجهة الرئيسية (Hero، عن إنصات، الشروط
                وغيرها) بشكل مباشر عبر نظام Inline Editor الذي يتيح لك رؤية
                التعديلات في سياقها الفعلي قبل نشرها.
              </p>
            </div>
            <a
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition"
            >
              <Edit3 size={18} />
              الذهاب إلى الواجهة والتعديل
            </a>
          </section>
        )}
      </main>

      {/* In-app Delete Confirmation Modal */}
      {deleteTargetModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative text-right"
            dir="rtl"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-2xl shrink-0">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  {deleteTargetModal.type === "bulk"
                    ? `حذف ${deleteTargetModal.count} عضو دفعة واحدة`
                    : "تأكيد حذف العضو نهائياً"}
                </h3>
                <span className="text-xs text-red-300">
                  إجراء إداري دائم وموثق في سجلات التدقيق
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {deleteTargetModal.type === "bulk" ? (
                <>
                  هل أنت متأكد من رغبتك في حذف{" "}
                  <strong className="text-white">
                    {deleteTargetModal.count}
                  </strong>{" "}
                  عضو محدد نهائياً من قاعدة البيانات والنظام؟
                  <br />
                  <span className="text-amber-300 text-[11px] block mt-1">
                    يتم حفظ نسخة احتياطية مشفرة في سلة المحذوفات للاسترجاع
                    لاحقاً إن لزم.
                  </span>
                </>
              ) : (
                <>
                  هل أنت متأكد من حذف العضو{" "}
                  <strong className="text-white font-bold">
                    "{deleteTargetModal.member?.name}"
                  </strong>{" "}
                  (
                  {deleteTargetModal.member?.email ||
                    deleteTargetModal.member?.username ||
                    deleteTargetModal.member?.uid}
                  ) نهائياً من النظام؟
                </>
              )}
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteTargetModal(null)}
                disabled={Boolean(busy || bulkBusy)}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => void confirmExecuteDelete()}
                disabled={Boolean(busy || bulkBusy)}
                className="bg-red-600 hover:bg-red-500 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-red-600/30"
              >
                {busy.startsWith("delete:") || bulkBusy ? (
                  <>
                    <Loader2 size={16} className="spin" />
                    <span>جارٍ الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>تأكيد الحذف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Profile Modal */}
      {editingMember && (
        <EditUserProfileModal
          isOpen={Boolean(editingMember)}
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={handleMemberSaved}
          currentAdminRole={isSuperAdmin ? "SUPER_ADMIN" : user?.role}
        />
      )}

      {/* Restore Deleted Users Modal */}
      {showRestoreModal && (
        <RestoreDeletedUsersModal
          isOpen={showRestoreModal}
          onClose={() => setShowRestoreModal(false)}
          onRestored={() => {
            void loadMembers();
          }}
        />
      )}

      {/* Deduplicate Users Modal */}
      {showDeduplicateModal && (
        <DeduplicateUsersModal
          isOpen={showDeduplicateModal}
          onClose={() => setShowDeduplicateModal(false)}
          onResolved={() => {
            void loadMembers();
          }}
          onOpenRestore={() => setShowRestoreModal(true)}
        />
      )}
    </div>
  );
}

function CreateMember({ onCreated }: { onCreated: () => void }) {
  const [mode, setMode] = useState<"invite" | "direct">("invite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Invite state
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteDept, setInviteDept] = useState("");
  const [inviteCountry, setInviteCountry] = useState("العراق");
  const [inviteCode, setInviteCode] = useState(() =>
    Math.floor(100000 + Math.random() * 900000).toString(),
  );
  const [createdInvite, setCreatedInvite] = useState<{
    code: string;
    identifier: string;
    name: string;
    role: string;
    roleDisplayAr: string;
  } | null>(null);

  // Direct state
  const [directPhone, setDirectPhone] = useState("");
  const [directCountry, setDirectCountry] = useState("الكويت");

  const generateRandomCode = () => {
    setInviteCode(Math.floor(100000 + Math.random() * 900000).toString());
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");

    if (!inviteName.trim()) {
      setError("يرجى إدخال اسم العضو الكامل.");
      setBusy(false);
      return;
    }

    if (!inviteEmail.trim() && !invitePhone.trim()) {
      setError(
        "يجب إدخال البريد الإلكتروني أو رقم الهاتف على الأقل لربط كود الانضمام.",
      );
      setBusy(false);
      return;
    }

    try {
      const response = await apiFetch("/api/admin/invite-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          phone: invitePhone.trim(),
          role: inviteRole,
          department: inviteDept.trim(),
          country: inviteCountry,
          code: inviteCode.trim(),
        }),
      });

      const payload = await safeJson<{
        success?: boolean;
        error?: string;
        code?: string;
        identifier?: string;
        name?: string;
        role?: string;
        roleDisplayAr?: string;
      }>(response, { success: false, error: "تعذر إنشاء كود الانضمام" });
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "تعذر إنشاء كود الانضمام");
      }

      setCreatedInvite({
        code: payload.code || inviteCode,
        identifier: payload.identifier || inviteEmail || invitePhone,
        name: payload.name || inviteName,
        role: payload.role || inviteRole,
        roleDisplayAr: payload.roleDisplayAr || "عضو متطوع",
      });

      onCreated();
    } catch (err: any) {
      setError(err?.message || "تعذر إنشاء كود الانضمام");
    } finally {
      setBusy(false);
    }
  };

  const submitDirect = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password !== confirm) {
      setError("كلمتا المرور غير متطابقتين.");
      setBusy(false);
      return;
    }
    const body = {
      name: String(form.get("name") || ""),
      username: String(form.get("username") || ""),
      email: String(form.get("email") || ""),
      password,
      phone: directPhone,
      country: directCountry,
      department: String(form.get("department") || ""),
      role: String(form.get("role") || "MEMBER"),
    };

    try {
      const response = await apiFetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      const payload = await safeJson<{ success?: boolean; error?: string }>(
        response,
        {
          success: false,
          error: "تعذر إنشاء الحساب",
        },
      );
      if (!response.ok || !payload.success)
        throw new Error(payload.error || "تعذر إنشاء الحساب");
      event.currentTarget.reset();
      setDirectPhone("");
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  };

  const invitationMessageText = createdInvite
    ? `مرحباً ${createdInvite.name}، نرحب بانضمامك لمبادرة إنصات بصفتك (${createdInvite.roleDisplayAr}).\n\nبيانات تفعيل حسابك:\n- المعرف المسجل: ${createdInvite.identifier}\n- كود الانضمام والتفعيل: ${createdInvite.code}\n\nيرجى الدخول للموقع واختيار "تفعيل العضوية وتأكيد الحساب" لإدخال الكود وتعيين كلمة المرور الخاصة بك.`
    : "";

  const copyInviteDetails = () => {
    if (!invitationMessageText) return;
    navigator.clipboard.writeText(invitationMessageText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="p-5 sm:p-7 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl mb-6 text-slate-100 animate-in fade-in duration-200"
      id="container-create-member"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Users size={20} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-white">
              إضافة أو دعوة عضو جديد
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              توليد كود انضمام مخصص للعضو لتأكيد حسابه ذاتياً أو إنشاء الحساب
              مباشرة بكلمة مرور
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-950/80 border border-slate-800 rounded-xl max-w-fit mb-5">
        <button
          type="button"
          onClick={() => {
            setMode("invite");
            setError("");
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            mode === "invite"
              ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black"
              : "text-slate-300 hover:text-white hover:bg-slate-800/80"
          }`}
        >
          <KeyRound size={15} />
          <span>كود انضمام لعضو جديد (تفعيل ذاتي)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("direct");
            setError("");
          }}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
            mode === "direct"
              ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black"
              : "text-slate-300 hover:text-white hover:bg-slate-800/80"
          }`}
        >
          <Plus size={15} />
          <span>إنشاء فوري لحساب بكلمة مرور</span>
        </button>
      </div>

      {/* MODE 1: Invite Code Generation */}
      {mode === "invite" && (
        <div>
          {createdInvite ? (
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-950/90 border border-amber-500/40 text-slate-200 space-y-5 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                    <CheckCircle2 size={18} />
                  </div>
                  <strong className="text-white text-sm sm:text-base font-bold">
                    تم إنشاء كود الانضمام بنجاح!
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedInvite(null);
                    generateRandomCode();
                    setInviteName("");
                    setInviteEmail("");
                    setInvitePhone("");
                  }}
                  className="text-xs px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold transition cursor-pointer"
                >
                  دعوة عضو آخر
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="p-2">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">
                    اسم العضو
                  </span>
                  <strong className="text-sm font-bold text-white block truncate">
                    {createdInvite.name}
                  </strong>
                </div>
                <div className="p-2 border-y sm:border-y-0 sm:border-r sm:border-l border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">
                    المعرف المسجل
                  </span>
                  <strong
                    className="text-xs text-amber-300 font-mono font-bold block truncate"
                    dir="ltr"
                  >
                    {createdInvite.identifier}
                  </strong>
                </div>
                <div className="p-2">
                  <span className="text-[11px] font-medium text-slate-400 block mb-1">
                    كود التفعيل (PIN)
                  </span>
                  <strong className="text-xl text-amber-400 font-mono font-black tracking-widest block">
                    {createdInvite.code}
                  </strong>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 block">
                  نص الدعوة الجاهز للإرسال للعضو (عبر واتساب أو تيليجرام):
                </label>
                <textarea
                  readOnly
                  rows={4}
                  value={invitationMessageText}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-xs text-slate-100 leading-relaxed font-sans focus:outline-none select-all"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={copyInviteDetails}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-amber-400/20"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  <span>
                    {copied ? "تم النسخ للحافظة بنجاح!" : "نسخ نص الدعوة"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatedInvite(null);
                    generateRandomCode();
                    setInviteName("");
                    setInviteEmail("");
                    setInvitePhone("");
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
                >
                  توليد كود لعضو جديد
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateInvite} className="space-y-5">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 text-xs leading-relaxed">
                أنشئ كوداً مخصصاً للعضو الجديد واربطه ببريده أو هاتفه. سيتمكن
                العضو من فتح المنصة واختيار{" "}
                <strong>«تفعيل العضوية وتأكيد الحساب»</strong> لإدخال الكود، ثم
                إكمال بياناته وتعيين كلمة مروره بنفسه بكل سهولة.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    الاسم الكامل للعضو *
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                    placeholder="مثال: أحمد عبد الله المحمد"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    البريد الإلكتروني (اختياري)
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    dir="ltr"
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500 text-left"
                  />
                </div>

                <div>
                  <PhoneInput
                    label="رقم الهاتف أو الواتساب (E.164)"
                    value={invitePhone}
                    onChange={(val) => setInvitePhone(val)}
                    placeholder="5X XXX XXXX"
                    theme="dark"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    الدولة
                  </label>
                  <select
                    value={inviteCountry}
                    onChange={(e) => setInviteCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition cursor-pointer"
                  >
                    {ARAB_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.nameAr}>
                        {c.flag} {c.nameAr}
                      </option>
                    ))}
                    <option value="دولة أخرى">🌍 دولة أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    الدور الوظيفي والصلاحية
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition cursor-pointer"
                  >
                    <option value="MEMBER">عضو متطوع (MEMBER)</option>
                    <option value="NARRATOR">
                      راوٍ / معلق صوتي (NARRATOR)
                    </option>
                    <option value="AUDIO_ENGINEER">
                      مهندس صوت ومكساج (AUDIO_ENGINEER)
                    </option>
                    <option value="QA_REVIEWER">
                      مراجع جودة وتدقيق (QA_REVIEWER)
                    </option>
                    <option value="OPERATIONS_MANAGER">
                      مدير عمليات (OPERATIONS_MANAGER)
                    </option>
                    <option value="CONTENT_MANAGER">
                      مدير محتوى (CONTENT_MANAGER)
                    </option>
                    <option value="MEMBERS_MANAGER">
                      مدير أعضاء (MEMBERS_MANAGER)
                    </option>
                    <option value="REWARDS_MANAGER">
                      مدير مكافآت (REWARDS_MANAGER)
                    </option>
                    <option value="CERTIFICATE_MANAGER">
                      مدير شهادات (CERTIFICATE_MANAGER)
                    </option>
                    <option value="ADMIN">مدير إداري (ADMIN)</option>
                    <option value="SUPER_ADMIN">مدير عام (SUPER_ADMIN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    القسم أو التخصص
                  </label>
                  <input
                    type="text"
                    value={inviteDept}
                    onChange={(e) => setInviteDept(e.target.value)}
                    placeholder="مثال: التدقيق اللغوي، الهندسة الصوتية، الرواية..."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    كود التفعيل والانضمام (6 أرقام)
                  </label>
                  <div className="flex gap-2 max-w-md">
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-amber-500/50 focus:border-amber-400 rounded-xl text-amber-300 font-mono text-center tracking-widest text-base font-black focus:outline-none transition"
                      dir="ltr"
                      placeholder="123456"
                    />
                    <button
                      type="button"
                      onClick={generateRandomCode}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                      title="توليد كود عشوائي جديد"
                    >
                      🎲 كود جديد
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2">
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                  disabled={busy}
                  id="btn-submit-invite-member"
                >
                  {busy ? (
                    <Loader2 className="animate-spin" size={18} />
                  ) : (
                    <KeyRound size={18} />
                  )}
                  <span>توليد كود الانضمام وحفظ الدعوة</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* MODE 2: Direct Creation */}
      {mode === "direct" && (
        <form
          onSubmit={submitDirect}
          id="form-create-member"
          className="space-y-5"
        >
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 text-xs leading-relaxed">
            إنشاء فوري ومباشر لحساب العضو مع تعيين اسم مستخدم وكلمة مرور أولية،
            وإدخال بياناته بالكامل في المنصة مباشرة.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                الاسم الكامل للعضو *
              </label>
              <input
                name="name"
                required
                placeholder="مثال: أحمد عبد الله المحمد"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                اسم المستخدم المطلوب (English) *
              </label>
              <input
                name="username"
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_]+"
                required
                dir="ltr"
                placeholder="ahmed_99"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500 text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                البريد الإلكتروني *
              </label>
              <input
                name="email"
                type="email"
                required
                dir="ltr"
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500 text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                الدولة
              </label>
              <select
                value={directCountry}
                onChange={(e) => setDirectCountry(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition cursor-pointer"
              >
                {ARAB_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.nameAr}>
                    {c.flag} {c.nameAr}
                  </option>
                ))}
                <option value="دولة أخرى">🌍 دولة أخرى</option>
              </select>
            </div>

            <div>
              <PhoneInput
                label="رقم الهاتف أو الواتساب (E.164)"
                value={directPhone}
                onChange={(val) => setDirectPhone(val)}
                placeholder="5X XXX XXXX"
                theme="dark"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                القسم أو التخصص
              </label>
              <input
                name="department"
                placeholder="مثال: الهندسة الصوتية، التدقيق..."
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                الدور الوظيفي والصلاحية
              </label>
              <select
                name="role"
                defaultValue="MEMBER"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition cursor-pointer"
              >
                <option value="MEMBER">عضو متطوع (MEMBER)</option>
                <option value="NARRATOR">راوٍ / معلق صوتي (NARRATOR)</option>
                <option value="AUDIO_ENGINEER">
                  مهندس صوت ومكساج (AUDIO_ENGINEER)
                </option>
                <option value="QA_REVIEWER">
                  مراجع جودة وتدقيق (QA_REVIEWER)
                </option>
                <option value="OPERATIONS_MANAGER">
                  مدير عمليات (OPERATIONS_MANAGER)
                </option>
                <option value="CONTENT_MANAGER">
                  مدير محتوى (CONTENT_MANAGER)
                </option>
                <option value="MEMBERS_MANAGER">
                  مدير أعضاء (MEMBERS_MANAGER)
                </option>
                <option value="REWARDS_MANAGER">
                  مدير مكافآت (REWARDS_MANAGER)
                </option>
                <option value="CERTIFICATE_MANAGER">
                  مدير شهادات (CERTIFICATE_MANAGER)
                </option>
                <option value="ADMIN">مدير إداري (ADMIN)</option>
                <option value="SUPER_ADMIN">مدير عام (SUPER_ADMIN)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                كلمة مرور أولية مؤقتة (6 خانات على الأقل) *
              </label>
              <input
                name="password"
                type="password"
                minLength={6}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500 text-left"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                تأكيد كلمة المرور *
              </label>
              <input
                name="confirm"
                type="password"
                minLength={6}
                required
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl text-white text-sm focus:outline-none transition placeholder:text-slate-500 text-left"
              />
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
              disabled={busy}
              id="btn-submit-create-member"
            >
              {busy ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Plus size={18} />
              )}
              <span>إنشاء وتوثيق الحساب في المنصة</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AdminApp() {
  return (
    <PlatformGuard platform={"admin" as PlatformId}>
      <AdminWorkspace />
    </PlatformGuard>
  );
}
export default AdminApp;
