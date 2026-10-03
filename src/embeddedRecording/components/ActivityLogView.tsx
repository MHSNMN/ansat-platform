// @ts-nocheck
import React, { useState } from "react";
import { ActivityLog, ThemeMode, User } from "../types";
import { parseActivityLogTimestamp } from "../lib/logUtils";
import {
  Activity,
  Search,
  UploadCloud,
  ShieldAlert,
  BookPlus,
  BookOpen,
  Trash2,
  Wand2,
  ShieldCheck,
  Lock,
  Clock,
  User as UserIcon,
  FileSpreadsheet,
} from "lucide-react";

interface ActivityLogViewProps {
  logs: ActivityLog[];
  theme: ThemeMode;
  currentUser?: User | null;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({
  logs,
  theme,
  currentUser,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<string>("ALL");

  const canViewActivityLogs =
    currentUser &&
    (currentUser.is_super_admin || currentUser.can_view_activity_logs);

  if (!canViewActivityLogs) {
    return (
      <div className="p-8 text-center rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 max-w-md mx-auto my-12 dir-rtl shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">
            سجل الأنشطة محمي 🔒
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            عذراً، الاطلاع على سجل عمليات المنصة وتتبع الأنشطة مقتصر فقط على
            المدراء والأعضاء الممتلكين لصلاحية الاطلاع على السجل الإداري.
          </p>
        </div>
      </div>
    );
  }

  // Extract unique users from logs
  const uniqueUsers = Array.from(new Set(logs.map((l) => l.user_name))).filter(
    Boolean,
  );

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      (log.user_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.details || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action_display_ar || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    const matchesUser =
      selectedUser === "ALL" || log.user_name === selectedUser;

    let matchesCat = true;
    if (filterCategory === "DELETE") {
      matchesCat =
        log.action_type === "BOOK_DELETE" ||
        log.action_type === "RECORDING_DELETE" ||
        (log.action_display_ar || "").includes("حذف");
    } else if (filterCategory === "ADD") {
      matchesCat =
        log.action_type === "BOOK_ADD" ||
        log.action_type === "UPLOAD" ||
        (log.action_display_ar || "").includes("إضافة") ||
        (log.action_display_ar || "").includes("رفع");
    } else if (filterCategory === "EDIT") {
      matchesCat =
        log.action_type === "BOOK_EDIT" ||
        log.action_type === "EDIT_PERMISSION" ||
        log.action_type === "TASK_UPDATE" ||
        (log.action_display_ar || "").includes("تعديل") ||
        (log.action_display_ar || "").includes("تحديث");
    } else if (filterCategory === "QA_AUDIO") {
      matchesCat =
        log.action_type === "MASTERING" ||
        log.action_type === "QA_REVIEW" ||
        (log.action_display_ar || "").includes("جودة") ||
        (log.action_display_ar || "").includes("مونتاج");
    } else if (filterCategory === "PERMISSIONS") {
      matchesCat =
        log.action_type === "EDIT_PERMISSION" ||
        log.action_type === "SYSTEM_WIPE";
    }

    return matchesSearch && matchesUser && matchesCat;
  });

  const exportLogsCSV = () => {
    let csv = "\uFEFF"; // UTF-8 BOM
    csv += "سجل عمليات ونشاطات منصة إنصات\n";
    csv += `تاريخ التصدير,${new Date().toLocaleDateString("ar-EG")}\n\n`;
    csv += "المستخدم,نوع الإجراء,الوصف والتفاصيل,التاريخ والوقت\n";

    filteredLogs.forEach((l) => {
      csv += `"${l.user_name}","${l.action_display_ar}","${l.details.replace(/"/g, '""')}","${l.createdAt || ""}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `سجل_نشاطات_إنصات_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getLogIcon = (type: ActivityLog["action_type"]) => {
    switch (type) {
      case "UPLOAD":
        return <UploadCloud className="w-4 h-4 text-amber-400" />;
      case "EDIT_PERMISSION":
        return <ShieldAlert className="w-4 h-4 text-purple-400" />;
      case "BOOK_ADD":
        return <BookPlus className="w-4 h-4 text-emerald-400" />;
      case "BOOK_EDIT":
        return <BookOpen className="w-4 h-4 text-blue-400" />;
      case "BOOK_DELETE":
        return <Trash2 className="w-4 h-4 text-rose-400" />;
      case "MASTERING":
        return <Wand2 className="w-4 h-4 text-indigo-400" />;
      case "QA_REVIEW":
        return <ShieldCheck className="w-4 h-4 text-teal-400" />;
      case "TASK_UPDATE":
        return <Activity className="w-4 h-4 text-amber-300" />;
      default:
        return <Activity className="w-4 h-4 text-amber-400" />;
    }
  };

  const getLogBadgeStyle = (type: ActivityLog["action_type"]) => {
    switch (type) {
      case "UPLOAD":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "EDIT_PERMISSION":
        return "bg-purple-500/10 text-purple-300 border-purple-500/30";
      case "BOOK_ADD":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "BOOK_EDIT":
        return "bg-blue-500/10 text-blue-300 border-blue-500/30";
      case "BOOK_DELETE":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      case "MASTERING":
        return "bg-indigo-500/10 text-indigo-300 border-indigo-500/30";
      case "QA_REVIEW":
        return "bg-teal-500/10 text-teal-300 border-teal-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div
        className={`p-5 rounded-2xl border space-y-4 ${
          theme === "dark"
            ? "bg-slate-900/90 border-slate-800"
            : "bg-white border-slate-200 shadow-sm"
        }`}
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              سجل العمليات والنشاطات المتقدم ({filteredLogs.length} إجراء)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              تصفية دقيقة حسب نوع الإجراء (حذف، إضافة، تعديل)، تصفية حسب
              المستخدم، وبحث فوري في التفاصيل
            </p>
          </div>

          <button
            onClick={exportLogsCSV}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center gap-2 cursor-pointer transition-all self-stretch sm:self-auto justify-center"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير السجل إلى (CSV)</span>
          </button>
        </div>

        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/60">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث في تفاصيل الإجراء أو اسم العضو..."
              className={`w-full pr-9 pl-3 py-2 rounded-xl text-xs border font-medium focus:outline-none focus:ring-2 ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-white focus:ring-amber-500"
                  : "bg-white border-slate-300 focus:ring-amber-500"
              }`}
            />
          </div>

          {/* Action Category Filter */}
          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs border font-bold focus:outline-none ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-amber-400"
                  : "bg-white border-slate-300 text-amber-600"
              }`}
            >
              <option value="ALL">جميع أنواع الإجراءات (كل النمط)</option>
              <option value="DELETE">🗑️ إجراءات الحذف فقط</option>
              <option value="ADD">➕ إجراءات الإضافة والرفع</option>
              <option value="EDIT">✏️ إجراءات التعديل والتحديث</option>
              <option value="QA_AUDIO">🎙️ الهندسة والمونتاج والجودة</option>
              <option value="PERMISSIONS">⚙️ الصلاحيات وإدارة النظام</option>
            </select>
          </div>

          {/* User Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className={`w-full px-3 py-2 rounded-xl text-xs border font-bold focus:outline-none ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-800 text-slate-200"
                  : "bg-white border-slate-300 text-slate-800"
              }`}
            >
              <option value="ALL">جميع المستخدمين والأعضاء</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  👤 {u}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Timeline */}
      <div
        className={`p-6 rounded-2xl border ${
          theme === "dark"
            ? "bg-slate-900/80 border-slate-800"
            : "bg-white border-slate-200"
        }`}
      >
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            لا توجد سجلات تطابق معايير البحث الحالية.
          </div>
        ) : (
          <div className="relative border-r border-slate-800/80 pr-6 space-y-6">
            {filteredLogs.map((log) => (
              <div key={log.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -right-[31px] top-1 w-5 h-5 rounded-full bg-slate-950 border border-amber-500/50 flex items-center justify-center shadow-md">
                  <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                </div>

                <div
                  className={`p-4 rounded-xl border transition-all space-y-2 ${
                    theme === "dark"
                      ? "bg-slate-950/60 border-slate-800/80 hover:border-amber-500/30"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border flex items-center gap-1.5 ${getLogBadgeStyle(log.action_type)}`}
                      >
                        {getLogIcon(log.action_type)}
                        <span>{log.action_display_ar}</span>
                      </span>

                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                        {log.user_name}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1 dir-ltr">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {parseActivityLogTimestamp(log.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 pr-1 leading-relaxed">
                    {log.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
