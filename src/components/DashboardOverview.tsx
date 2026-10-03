import React, { useState, useEffect } from "react";
import {
  User,
  Book,
  AudioRecording,
  ThemeMode,
  MainTab,
  ActivityLog,
} from "../types";
import { fetchActivityLogs } from "../lib/supabaseClient";
import {
  BookOpen,
  Headphones,
  Sparkles,
  Star,
  Volume2,
  History,
  ShieldCheck,
  Trash2,
  BarChart3,
  Layers,
  Activity,
  Download,
  Zap,
  CloudUpload,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DashboardOverviewProps {
  currentUser: User | null;
  books: Book[];
  recordings: AudioRecording[];
  users: User[];
  onSelectTab: (tab: MainTab) => void;
  onPlayAudio: (rec: AudioRecording) => void;
  theme: ThemeMode;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  currentUser,
  books,
  recordings,
  users,
  onSelectTab,
  onPlayAudio,
  theme,
}) => {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    fetchActivityLogs().then((logs) => setActivityLogs(logs || []));
  }, []);

  const booksInProgress = books.filter(
    (b) => b.completed_parts < b.total_parts,
  ).length;
  const completedBooksCount = books.filter(
    (b) => b.completed_parts >= b.total_parts,
  ).length;
  const completedPartsTotal = books.reduce(
    (acc, b) => acc + b.completed_parts,
    0,
  );
  const totalPartsAllBooks = books.reduce((acc, b) => acc + b.total_parts, 0);

  const overallProductivityRate =
    totalPartsAllBooks > 0
      ? Math.round((completedPartsTotal / totalPartsAllBooks) * 100)
      : 0;

  // Chart Data
  const statusCounts = {
    RAW: 0,
    MASTERED: 0,
    QA_APPROVED: 0,
    FINAL: 0,
    QA_REJECTED: 0,
    needs_revision: 0,
  };
  recordings.forEach((r) => {
    if (
      statusCounts[r.workflowStatus as keyof typeof statusCounts] !== undefined
    )
      statusCounts[r.workflowStatus as keyof typeof statusCounts]++;
  });

  const pieData = [
    { name: "خام", value: statusCounts.RAW, color: "#f59e0b" },
    { name: "مماستر", value: statusCounts.MASTERED, color: "#6366f1" },
    { name: "مدقق", value: statusCounts.QA_APPROVED, color: "#10b981" },
    { name: "نهائي", value: statusCounts.FINAL, color: "#3b82f6" },
    {
      name: "مرفوض/مراجعة",
      value: statusCounts.QA_REJECTED + statusCounts.needs_revision,
      color: "#f43f5e",
    },
  ].filter((d) => d.value > 0);

  const booksChartData = books
    .map((b) => ({
      name: b.title.length > 15 ? b.title.substring(0, 15) + "..." : b.title,
      "الأجزاء المنجزة": b.completed_parts,
      المتبقي: b.total_parts - b.completed_parts,
    }))
    .sort((a, b) => b["الأجزاء المنجزة"] - a["الأجزاء المنجزة"])
    .slice(0, 10);

  // Growth Data (Mock based on completed parts for AreaChart)
  const growthData = [
    { name: "أسبوع 1", إنتاج: Math.max(0, completedPartsTotal - 30) },
    { name: "أسبوع 2", إنتاج: Math.max(0, completedPartsTotal - 20) },
    { name: "أسبوع 3", إنتاج: Math.max(0, completedPartsTotal - 10) },
    { name: "هذا الأسبوع", إنتاج: completedPartsTotal },
  ];

  const exportStatisticsCSV = () => {
    let csv = "\uFEFF"; // UTF-8 BOM
    csv += "تقرير إحصائيات إنتاج منصة إنصات الصوتية\n";
    csv += `تاريخ التصدير,${new Date().toLocaleDateString("ar-EG")}\n\n`;
    csv += "--- الملخص العام للإنتاج ---\n";
    csv += `إجمالي الكتب المسجلة,${books.length}\n`;
    csv += `الكتب المكتملة بالكامل,${completedBooksCount}\n`;
    csv += `الكتب قيد التسجيل والمتابعة,${booksInProgress}\n`;
    csv += `إجمالي الأجزاء المنجزة,${completedPartsTotal}\n`;
    csv += `نسبة الإنجاز الكلية للمنصة,${overallProductivityRate}%\n\n`;

    csv += "--- تفاصيل الكتب ---\n";
    csv += "اسم الكتاب,المؤلف,عدد الأجزاء الكلي,الأجزاء المنجزة,نسبة الإنجاز\n";
    books.forEach((b) => {
      const completionRate =
        b.total_parts > 0
          ? Math.round((b.completed_parts / b.total_parts) * 100)
          : 0;
      csv += `"${b.title}","${b.author}",${b.total_parts},${b.completed_parts},${completionRate}%\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `تقرير_إنصات_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionIcon = (action: string) => {
    if (!action) return <History className="w-4 h-4 text-slate-400" />;
    if (action.includes("master"))
      return <Sparkles className="w-4 h-4 text-indigo-400" />;
    if (action.includes("qa") || action.includes("reject"))
      return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
    if (action.includes("delete") || action.includes("remove"))
      return <Trash2 className="w-4 h-4 text-rose-400" />;
    if (action.includes("upload") || action.includes("add"))
      return <CloudUpload className="w-4 h-4 text-blue-400" />;
    if (action.includes("book"))
      return <BookOpen className="w-4 h-4 text-amber-400" />;
    return <History className="w-4 h-4 text-slate-400" />;
  };

  const renderWelcomeBanner = () => (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-amber-900 border border-slate-700/50 p-8 shadow-2xl">
      <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
        <Star className="w-64 h-64 text-amber-400" />
      </div>
      <div className="relative z-10">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          مرحباً بك في مركز الإنتاج السحابي{" "}
          <Zap className="w-8 h-8 text-amber-400 animate-pulse" />
        </h1>
        <p className="text-slate-300 max-w-2xl text-sm leading-relaxed mb-6">
          أهلاً {currentUser?.name}، هذه هي لوحة التحكم الشاملة. يمكنك متابعة
          مسار إنتاج الكتب الصوتية، ومراقبة جودة التسجيلات، والوصول السريع لجميع
          أدوات المنصة.
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={() => onSelectTab("audio_library")}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-0.5"
          >
            <Headphones className="w-5 h-5" />
            المكتبة الصوتية
          </button>
          <button
            onClick={exportStatisticsCSV}
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-2 border border-slate-600 transition-all hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" />
            تصدير الإحصائيات (CSV)
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 dir-rtl pb-24">
      {renderWelcomeBanner()}

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Books Stat */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700 hover:border-amber-500/30 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">
                الكتب المسجلة
              </p>
              <h3 className="text-3xl font-bold text-white">{books.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-6 h-6 text-amber-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded">
              {completedBooksCount} مكتمل
            </span>
            <span>و {booksInProgress} قيد العمل</span>
          </div>
        </div>

        {/* Parts Stat */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700 hover:border-indigo-500/30 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">
                الأجزاء المنجزة
              </p>
              <h3 className="text-3xl font-bold text-white">
                {completedPartsTotal}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6 text-indigo-400" />
            </div>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 rounded-full"
              style={{ width: `${overallProductivityRate}%` }}
            ></div>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            نسبة الإنجاز الكلية {overallProductivityRate}%
          </p>
        </div>

        {/* Audio Recordings */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700 hover:border-blue-500/30 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">
                إجمالي التسجيلات
              </p>
              <h3 className="text-3xl font-bold text-white">
                {recordings.length}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Volume2 className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-blue-400 font-bold bg-blue-400/10 px-2 py-0.5 rounded">
              {statusCounts.FINAL} نهائي
            </span>
            <span>جاهز للنشر والتوزيع</span>
          </div>
        </div>

        {/* Team Activity */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700 hover:border-emerald-500/30 transition-colors group">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">
                نشاط الفريق
              </p>
              <h3 className="text-3xl font-bold text-white">
                {activityLogs.length}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Activity className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="text-emerald-400 font-bold bg-emerald-400/10 px-2 py-0.5 rounded">
              تفاعل مستمر
            </span>
            <span>عبر المنصة السحابية</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900/50 rounded-2xl p-6 border border-slate-700 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-400" />
              أعلى الكتب إنجازاً
            </h3>
          </div>
          <div className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={booksChartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#334155"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar
                  dataKey="الأجزاء المنجزة"
                  stackId="a"
                  fill="#6366f1"
                  radius={[0, 0, 4, 4]}
                />
                <Bar
                  dataKey="المتبقي"
                  stackId="a"
                  fill="#334155"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Pie Chart */}
        <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              حالة التسجيلات الحالية
            </h3>
          </div>
          <div className="flex-1 min-h-[250px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f172a",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  itemStyle={{ color: "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {pieData.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-slate-300"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: d.color }}
                ></div>
                <span className="truncate">
                  {d.name} ({d.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Log List */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            أحدث النشاطات في المنصة
          </h3>
        </div>

        {activityLogs.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center opacity-50">
            <History className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">لا توجد نشاطات مسجلة بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {activityLogs.slice(0, 15).map((log, idx) => (
              <div
                key={log.id || idx}
                className="p-4 hover:bg-slate-800/30 transition-colors flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                  {getActionIcon(log.action_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <p className="text-sm font-medium text-slate-200">
                      <span className="text-indigo-400 font-bold">
                        {log.user_name}
                      </span>{" "}
                      قام بإجراء {log.action_display_ar || log.action_type}
                    </p>
                    <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                      {(() => {
                        const raw = log?.createdAt ?? (log as any)?.created_at;
                        if (!raw) return "تاريخ غير متوفر";
                        try {
                          if (typeof (raw as any)?.toDate === "function") {
                            const d = (raw as any).toDate();
                            return d instanceof Date &&
                              !Number.isNaN(d.getTime())
                              ? d.toLocaleString("ar-EG")
                              : "تاريخ غير متوفر";
                          }
                          if (typeof raw === "object" && raw !== null) {
                            const sec =
                              (raw as any).seconds ?? (raw as any)._seconds;
                            if (typeof sec === "number") {
                              return new Date(sec * 1000).toLocaleString(
                                "ar-EG",
                              );
                            }
                          }
                          if (typeof raw === "string") {
                            const d = new Date(raw);
                            if (!Number.isNaN(d.getTime())) {
                              return d.toLocaleString("ar-EG");
                            }
                            return raw;
                          }
                          if (typeof raw === "number") {
                            return new Date(raw).toLocaleString("ar-EG");
                          }
                          return "تاريخ غير متوفر";
                        } catch {
                          return "تاريخ غير متوفر";
                        }
                      })()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate max-w-2xl">
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
