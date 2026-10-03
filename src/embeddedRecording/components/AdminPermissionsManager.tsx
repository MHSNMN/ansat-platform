// @ts-nocheck
import React, { useCallback, useState, useEffect } from "react";
import { User, ThemeMode, UserRole } from "../types";
import {
  ShieldCheck,
  UserPlus,
  X,
  Search,
  RefreshCw,
  Power,
  PowerOff,
} from "lucide-react";
import { authService } from "../services/authService";
import { safeJson } from "../../lib/api";

interface AdminPermissionsManagerProps {
  currentUser: User | null;
  theme: ThemeMode;
  onShowToast?: (msg: string, type: "success" | "error" | "info") => void;
  onUsersUpdated?: (users: User[]) => void;
}

export const AdminPermissionsManager: React.FC<
  AdminPermissionsManagerProps
> = ({ currentUser, theme, onShowToast, onUsersUpdated }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const notify = useCallback(
    (message: string, type: "success" | "error" | "info") => {
      if (onShowToast) onShowToast(message, type);
      else {
        setNotice({ message, type });
        window.setTimeout(() => setNotice(null), 4500);
      }
    },
    [onShowToast],
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "MEMBER" as UserRole,
    department: "",
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const token = await authService.token();
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await safeJson<{
        success?: boolean;
        users?: any[];
        error?: string;
      }>(res, { success: false, error: "تعذر تحميل الأعضاء" });
      if (data.success) {
        const normalized = (data.users || []).map((user: any) => ({
          ...user,
          id: user.uid || user.id,
          name: user.name || user.displayName || user.username || "",
          username: user.username || "",
          email: user.email || "",
          phone: user.phone || user.phoneNumber || "",
          role: user.role || "MEMBER",
          role_display_ar:
            user.roleDisplayAr || user.role_display_ar || user.role || "",
        }));
        setUsers(normalized);
        onUsersUpdated?.(normalized);
      }
    } catch (err) {
      notify("فشل في تحميل بيانات الأعضاء", "error");
    } finally {
      setLoading(false);
    }
  }, [notify, onUsersUpdated]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.password !== newUser.confirmPassword) {
      return notify("كلمة المرور غير متطابقة", "error");
    }
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(newUser.username)) {
      return notify(
        "اسم المستخدم يجب أن يكون بين 4 و 32 رمزاً إنجليزياً أو أرقام فقط",
        "error",
      );
    }

    try {
      setIsSubmitting(true);
      const token = await authService.token();
      const idempotencyKey = crypto.randomUUID();

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
          password: newUser.password,
          phone: newUser.phone,
          role: newUser.role,
          department: newUser.department,
        }),
      });

      const data = await safeJson<{ success?: boolean; error?: string }>(res, {
        success: false,
        error: "حدث خطأ في الاتصال",
      });
      if (data.success) {
        notify("تم إنشاء الحساب بنجاح", "success");
        setShowAddModal(false);
        setNewUser({
          name: "",
          username: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
          role: "MEMBER",
          department: "",
        });
        fetchUsers();
      } else {
        notify(data.error || "فشل إنشاء الحساب", "error");
      }
    } catch (err) {
      notify("حدث خطأ في الاتصال", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (uid: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "disabled" : "active";
      const token = await authService.token();
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(uid)}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      const data = await res.json().catch(() => null);
      if (data?.success) {
        notify("تم تحديث حالة الحساب", "success");
        fetchUsers();
      } else {
        notify(data?.error || "فشل تحديث الحالة", "error");
      }
    } catch (err) {
      notify("حدث خطأ في الاتصال", "error");
    }
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    try {
      const token = await authService.token();
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(uid)}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success)
        throw new Error(data?.error || "فشل تحديث الدور");
      notify("تم تحديث الدور والصلاحيات في جميع المنصات", "success");
      await fetchUsers();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "حدث خطأ في الاتصال",
        "error",
      );
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!u) return false;
    const q = (search || "").trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  });

  if (currentUser?.role !== "SUPER_ADMIN" && currentUser?.role !== "ADMIN") {
    return (
      <div className="p-8 text-center text-red-500 font-bold bg-red-50 dark:bg-red-900/20 rounded-xl">
        ليس لديك صلاحية لعرض هذه الصفحة
      </div>
    );
  }

  return (
    <div
      className={`p-6 rounded-2xl shadow-sm border ${theme === "dark" ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200"}`}
    >
      {notice && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${notice.type === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : notice.type === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-sky-500/30 bg-sky-500/10 text-sky-300"}`}
        >
          {notice.message}
        </div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-indigo-500" />
          إدارة الأعضاء والصلاحيات
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          عضو جديد
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="بحث بالاسم، اسم المستخدم، البريد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full pr-10 pl-4 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-200"}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <div className="text-[11px] text-slate-400">إجمالي الأعضاء</div>
          <div className="text-xl font-black text-white">{users.length}</div>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="text-[11px] text-emerald-300">حسابات نشطة</div>
          <div className="text-xl font-black text-emerald-400">
            {users.filter((u) => !u.status || u.status === "active").length}
          </div>
        </div>
        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
          <div className="text-[11px] text-violet-300">فريق التسجيل</div>
          <div className="text-xl font-black text-violet-400">
            {
              users.filter(
                (u) =>
                  u?.role &&
                  ["NARRATOR", "AUDIO_ENGINEER", "QA_REVIEWER"].includes(
                    u.role,
                  ),
              ).length
            }
          </div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="text-[11px] text-amber-300">الإدارة</div>
          <div className="text-xl font-black text-amber-400">
            {
              users.filter(
                (u) => u?.role && ["SUPER_ADMIN", "ADMIN"].includes(u.role),
              ).length
            }
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table
            className={`w-full text-right ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
          >
            <thead>
              <tr
                className={`border-b ${theme === "dark" ? "border-slate-700" : "border-slate-200"}`}
              >
                <th className="py-3 px-4">الاسم</th>
                <th className="py-3 px-4">اسم المستخدم</th>
                <th className="py-3 px-4">الدور</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr
                  key={u.id || (u as any).uid}
                  className={`border-b ${theme === "dark" ? "border-slate-700 hover:bg-slate-700/50" : "border-slate-100 hover:bg-slate-50"}`}
                >
                  <td className="py-3 px-4 font-semibold">{u.name}</td>
                  <td className="py-3 px-4" dir="ltr">
                    {u.username}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      disabled={
                        u.role === "SUPER_ADMIN" &&
                        currentUser?.role !== "SUPER_ADMIN"
                      }
                      onChange={(event) =>
                        handleRoleChange(
                          (u as any).uid || u.id,
                          event.target.value as UserRole,
                        )
                      }
                      className={`rounded-lg border px-2 py-1.5 text-xs font-bold ${theme === "dark" ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700"}`}
                    >
                      <option value="MEMBER">عضو — المهام فقط</option>
                      <option value="NARRATOR">راوي — رفع خام</option>
                      <option value="AUDIO_ENGINEER">مهندس صوت</option>
                      <option value="QA_REVIEWER">مراجع جودة</option>
                      {currentUser?.role === "SUPER_ADMIN" && (
                        <option value="ADMIN">مدير</option>
                      )}
                      {currentUser?.role === "SUPER_ADMIN" && (
                        <option value="SUPER_ADMIN">مدير عام</option>
                      )}
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${!u.status || u.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                    >
                      {!u.status || u.status === "active" ? "نشط" : "معطل"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() =>
                        handleToggleStatus(
                          (u as any).uid || u.id,
                          u.status || "active",
                        )
                      }
                      className={`p-2 rounded-lg ${!u.status || u.status === "active" ? "text-red-500 hover:bg-red-100" : "text-emerald-500 hover:bg-emerald-100"}`}
                      title={
                        !u.status || u.status === "active"
                          ? "تعطيل الحساب"
                          : "تفعيل الحساب"
                      }
                    >
                      {!u.status || u.status === "active" ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div
            className={`w-full max-w-lg rounded-2xl p-6 ${theme === "dark" ? "bg-slate-800 text-white" : "bg-white text-slate-800"}`}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">إضافة عضو جديد</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">
                  الاسم الكامل
                </label>
                <input
                  required
                  type="text"
                  value={newUser.name}
                  onChange={(e) =>
                    setNewUser({ ...newUser, name: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">
                  اسم المستخدم (إنجليزي وأرقام)
                </label>
                <input
                  required
                  dir="ltr"
                  minLength={4}
                  maxLength={32}
                  type="text"
                  value={newUser.username}
                  onChange={(e) =>
                    setNewUser({ ...newUser, username: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">
                  البريد الإلكتروني
                </label>
                <input
                  required
                  dir="ltr"
                  type="email"
                  value={newUser.email}
                  onChange={(e) =>
                    setNewUser({ ...newUser, email: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">
                  رقم الهاتف
                </label>
                <input
                  required
                  dir="ltr"
                  type="tel"
                  placeholder="+964..."
                  value={newUser.phone}
                  onChange={(e) =>
                    setNewUser({ ...newUser, phone: e.target.value })
                  }
                  className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">
                    كلمة المرور المؤقتة
                  </label>
                  <input
                    required
                    dir="ltr"
                    minLength={8}
                    type="password"
                    value={newUser.password}
                    onChange={(e) =>
                      setNewUser({ ...newUser, password: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    تأكيد كلمة المرور
                  </label>
                  <input
                    required
                    dir="ltr"
                    minLength={8}
                    type="password"
                    value={newUser.confirmPassword}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        confirmPassword: e.target.value,
                      })
                    }
                    className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">
                    الدور والصلاحية
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({
                        ...newUser,
                        role: e.target.value as UserRole,
                      })
                    }
                    className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                  >
                    <option value="MEMBER">عضو — المهام فقط</option>
                    <option value="NARRATOR">راوي / عضو</option>
                    <option value="QA_REVIEWER">مراجع جودة</option>
                    <option value="AUDIO_ENGINEER">مهندس صوت</option>
                    {currentUser?.role === "SUPER_ADMIN" && (
                      <option value="ADMIN">مدير</option>
                    )}
                    {currentUser?.role === "SUPER_ADMIN" && (
                      <option value="SUPER_ADMIN">مدير عام</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    القسم (اختياري)
                  </label>
                  <input
                    type="text"
                    value={newUser.department}
                    onChange={(e) =>
                      setNewUser({ ...newUser, department: e.target.value })
                    }
                    className={`w-full px-4 py-2 rounded-xl border focus:ring-2 focus:ring-indigo-500 ${theme === "dark" ? "bg-slate-900 border-slate-700" : "bg-slate-50 border-slate-300"}`}
                  />
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {isSubmitting ? "جاري الإنشاء..." : "إنشاء العضو"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
