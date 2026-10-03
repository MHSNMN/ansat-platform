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
import { safeJson } from "../lib/api";

interface AdminPermissionsManagerProps {
  currentUser: User | null;
  theme: ThemeMode;
  onShowToast: (msg: string, type: "success" | "error" | "info") => void;
}

export const AdminPermissionsManager: React.FC<
  AdminPermissionsManagerProps
> = ({ currentUser, theme, onShowToast }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "NARRATOR" as UserRole,
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
      }
    } catch (err) {
      onShowToast("فشل في تحميل بيانات الأعضاء", "error");
    } finally {
      setLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.password !== newUser.confirmPassword) {
      return onShowToast("كلمة المرور غير متطابقة", "error");
    }
    if (!/^[a-zA-Z0-9_]{4,32}$/.test(newUser.username)) {
      return onShowToast(
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
          role: newUser.role,
          department: newUser.department,
        }),
      });

      const data = await safeJson<{ success?: boolean; error?: string }>(res, {
        success: false,
        error: "حدث خطأ في الاتصال",
      });
      if (data.success) {
        onShowToast("تم إنشاء الحساب بنجاح", "success");
        setShowAddModal(false);
        setNewUser({
          name: "",
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          role: "NARRATOR",
          department: "",
        });
        fetchUsers();
      } else {
        onShowToast(data.error || "فشل إنشاء الحساب", "error");
      }
    } catch (err) {
      onShowToast("حدث خطأ في الاتصال", "error");
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
        onShowToast("تم تحديث حالة الحساب", "success");
        fetchUsers();
      } else {
        onShowToast(data?.error || "فشل تحديث الحالة", "error");
      }
    } catch (err) {
      onShowToast("حدث خطأ في الاتصال", "error");
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
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === "SUPER_ADMIN" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}
                    >
                      {u.role_display_ar || u.role}
                    </span>
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
                    <option value="NARRATOR">راوي / عضو</option>
                    <option value="QA_REVIEWER">مراجع جودة</option>
                    <option value="AUDIO_ENGINEER">مهندس صوت</option>
                    <option value="RECORDING_MANAGER">
                      مدير تسجيل ومشاريع كتب
                    </option>
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
