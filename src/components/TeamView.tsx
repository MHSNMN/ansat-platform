import React from "react";
import { User, ThemeMode } from "../types";
import { Users, Sparkles, Mic, ShieldCheck } from "lucide-react";
import { updateUserPermissions } from "../lib/supabaseClient";

interface TeamViewProps {
  users: User[];
  theme: ThemeMode;
  currentUser?: User | null;
  onUsersUpdated?: (updatedUsers: User[]) => void;
}

export const TeamView: React.FC<TeamViewProps> = ({
  users,
  theme,
  currentUser,
  onUsersUpdated,
}) => {
  // Direct permission evaluation for instantaneous accurate UI state
  const isPermittedToView = Boolean(
    currentUser?.is_super_admin || currentUser?.can_manage_members,
  );

  // Click handler to toggle permissions instantly (Optimistic UI Update)
  const handleTogglePermission = (
    userId: string,
    key: keyof User,
    currentVal: boolean,
  ) => {
    if (!isPermittedToView || !onUsersUpdated) return;

    // 1. Instant 0ms local state update
    const updatedUsers = users.map((u) =>
      u.id === userId ? { ...u, [key]: !currentVal } : u,
    );
    onUsersUpdated(updatedUsers);

    // 2. Quiet async database save
    (async () => {
      try {
        const actorName = currentUser?.name || "المدير";
        await updateUserPermissions(userId, { [key]: !currentVal }, actorName);
      } catch (err) {
        console.warn("Background sync permission error in TeamView:", err);
      }
    })();
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-400" />
          فريق مبادرة إنصات الصوتية ({users.length} عضواً)
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {isPermittedToView
            ? "تعديل وتخصيص صلاحيات زملائك في المبادرة فوراً وبنقرة واحدة عبر التحديث الفوري المباشر"
            : "تصفح أعضاء الفريق وأدوارهم في المبادرة"}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users.map((u) => (
          <div
            key={u.id}
            className={`p-5 rounded-2xl border transition-all space-y-3 relative ${
              theme === "dark"
                ? "bg-slate-900/80 border-slate-800 text-slate-100"
                : "bg-white border-slate-200 text-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${u.avatar_color || "bg-amber-500 text-slate-950"}`}
                >
                  {u.name.slice(0, 1)}
                </div>
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-1">
                    {u.name}
                    {u.is_super_admin && (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    )}
                  </h4>
                  <div className="text-[11px] text-slate-400">
                    {u.role_display_ar}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 opacity-60">
                <ShieldCheck className="w-4 h-4" />
                <span>آمن</span>
              </div>
            </div>

            {/* Clickable Permissions Toggle Badges */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                disabled={!isPermittedToView}
                onClick={() =>
                  handleTogglePermission(
                    u.id,
                    "can_access_studio",
                    !!u.can_access_studio,
                  )
                }
                className={`text-[10px] px-2.5 py-1 rounded border transition-all flex items-center gap-1 font-bold select-none ${isPermittedToView ? "cursor-pointer" : "cursor-not-allowed opacity-80"} ${
                  u.can_access_studio
                    ? "bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-sm"
                    : "bg-slate-950 text-slate-500 border-slate-800"
                }`}
                title="تعديل فوري لصلاحية الاستوديو"
              >
                <Mic className="w-3 h-3" />
                <span>الاستوديو</span>
              </button>

              <button
                disabled={!isPermittedToView}
                onClick={() =>
                  handleTogglePermission(
                    u.id,
                    "can_upload_raw",
                    !!u.can_upload_raw,
                  )
                }
                className={`text-[10px] px-2.5 py-1 rounded border transition-all font-bold select-none ${isPermittedToView ? "cursor-pointer" : "cursor-not-allowed opacity-80"} ${
                  u.can_upload_raw
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-sm"
                    : "bg-slate-950 text-slate-500 border-slate-800"
                }`}
                title="تعديل فوري لصلاحية الراوي"
              >
                <span>راوي</span>
              </button>

              <button
                disabled={!isPermittedToView}
                onClick={() =>
                  handleTogglePermission(
                    u.id,
                    "can_master_audio",
                    !!u.can_master_audio,
                  )
                }
                className={`text-[10px] px-2.5 py-1 rounded border transition-all font-bold select-none ${isPermittedToView ? "cursor-pointer" : "cursor-not-allowed opacity-80"} ${
                  u.can_master_audio
                    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30 shadow-sm"
                    : "bg-slate-950 text-slate-500 border-slate-800"
                }`}
                title="تعديل فوري لصلاحية المونتاج"
              >
                <span>ممنتج</span>
              </button>

              <button
                disabled={!isPermittedToView}
                onClick={() =>
                  handleTogglePermission(
                    u.id,
                    "can_qa_review",
                    !!u.can_qa_review,
                  )
                }
                className={`text-[10px] px-2.5 py-1 rounded border transition-all font-bold select-none ${isPermittedToView ? "cursor-pointer" : "cursor-not-allowed opacity-80"} ${
                  u.can_qa_review
                    ? "bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-sm"
                    : "bg-slate-950 text-slate-500 border-slate-800"
                }`}
                title="تعديل فوري لصلاحية التدقيق والجودة"
              >
                <span>جودة</span>
              </button>

              <button
                disabled={!isPermittedToView}
                onClick={() =>
                  handleTogglePermission(
                    u.id,
                    "can_manage_books",
                    !!u.can_manage_books,
                  )
                }
                className={`text-[10px] px-2.5 py-1 rounded border transition-all font-bold select-none ${isPermittedToView ? "cursor-pointer" : "cursor-not-allowed opacity-80"} ${
                  u.can_manage_books
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-sm"
                    : "bg-slate-950 text-slate-500 border-slate-800"
                }`}
                title="تعديل فوري لصلاحية إدارة وإنشاء الكتب"
              >
                <span>إدارة الكتب</span>
              </button>
            </div>

            {/* Email footer */}
            <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
              <span className="text-slate-400">البريد الإلكتروني:</span>
              <span className="font-mono text-[11px] text-slate-300">
                {u.email || "عضو المبادرة"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
