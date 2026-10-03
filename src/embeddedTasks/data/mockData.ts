// @ts-nocheck
import {
  DepartmentInfo,
  TeamMember,
  TeamTask,
  Book,
  CloudFolder,
  UserSession,
  ActivityLog,
} from "../types";

// الإعلان الإداري البارز (Admin Announcement)
export const INITIAL_ANNOUNCEMENT =
  "📢 تنبيه إداري عاجل من الإدارة العليا: يرجى من جميع الأعضاء الالتزام بتسليم الأعمال الموكلة قبل المواعيد النهائية وإضافة ملاحظة عند التحويل إلى مكتمل.";

// قائمة الأنشطة والتحركات الأولية للنظام
export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];

// أكواد الوصول الخاصة بالأعضاء والإدارة (Admins & Members) الرسمية
export const AUTHORIZED_USERS: UserSession[] = [];

// الأقسام الأربعة الأساسية للمبادرة
export const DEPARTMENTS: DepartmentInfo[] = [
  {
    id: "content",
    name: "قسم المحتوى والحقوق",
    iconName: "BookOpen",
    description:
      "اختيار الكتب القيمة، تدقيق النصوص، الحصول على المراجعات الفكرية وضبط حقوق الملكية الأدبية.",
    memberCount: 0,
    leader: "يُحدد من لوحة الإدارة",
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "audio",
    name: "قسم الإنتاج الصوتي",
    iconName: "Mic",
    description:
      "الأداء الصوتي الدرامي، الهندسة الصوتية، التوزيع الموسيقي والمكساج النهائي للإصدارات.",
    memberCount: 0,
    leader: "يُحدد من لوحة الإدارة",
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "design",
    name: "قسم الفعاليات والتصميم",
    iconName: "Palette",
    description:
      "تنظيم الجلسات النقاشية، تصميم الهوية البصرية والمحتوى التفاعلي.",
    memberCount: 0,
    leader: "يُحدد من لوحة الإدارة",
    color: "from-rose-500 to-pink-600",
  },
  {
    id: "tech",
    name: "قسم النشر والأنظمة الرقمية",
    iconName: "Code",
    description:
      "تطوير المنصة الرقمية، الأرشيف السحابي، والبحث العلمي والعلوم التطبيقية.",
    memberCount: 0,
    leader: "يُحدد من لوحة الإدارة",
    color: "from-emerald-500 to-teal-600",
  },
];

// فريق العمل الكادر الرسمي بالكامل
export const TEAM_MEMBERS: TeamMember[] = [];

// قائمة مهام الفريق الأولية لكل الأعضاء غير الأدمنية
export const INITIAL_TASKS: TeamTask[] = AUTHORIZED_USERS.filter(
  (u) => !u.isAdmin,
).flatMap((member) => [
  {
    id: `task-login-${member.id}`,
    memberId: member.id,
    memberName: member.name,
    country: member.country,
    departmentId: member.departmentName.includes("صوتي")
      ? "audio"
      : member.departmentName.includes("محتوى")
        ? "content"
        : member.departmentName.includes("تصميم") ||
            member.departmentName.includes("فعاليات")
          ? "design"
          : "tech",
    departmentName: member.departmentName,
    title: "التسجيل والدخول في لوحة تحكم إنصات",
    description:
      "تسجيل الدخول في اللوحة المحدثة لإنصات والتحقق من صلاحيات القسم واستكمال الملف الشخصي.",
    deadline: "2026-07-28",
    status: "قيد التنفيذ",
    progress: 50,
    priority: "عالية",
  },
  {
    id: `task-drive-${member.id}`,
    memberId: member.id,
    memberName: member.name,
    country: member.country,
    departmentId: member.departmentName.includes("صوتي")
      ? "audio"
      : member.departmentName.includes("محتوى")
        ? "content"
        : member.departmentName.includes("تصميم") ||
            member.departmentName.includes("فعاليات")
          ? "design"
          : "tech",
    departmentName: member.departmentName,
    title: "إدراج جميع الملفات والتقدم في ملف Google Drive الخاص بقسمك",
    description:
      "رفع وتحميل كافة ملفات العمل والمسودات ونسبة التقدم الحالية داخل مجلد Google Drive الخاص بقسمك.",
    deadline: "2026-07-30",
    status: "قيد التنفيذ",
    progress: 30,
    priority: "عالية",
  },
]);

// الكتب التفاعلية في المكتبة
export const BOOKS_LIBRARY: Book[] = [];

// روابط الأرشيف السحابي والمجلدات المباشرة الرسمية
export const CLOUD_FOLDERS: CloudFolder[] = [
  // 1. ملفات العمل والأنشطة العامة (الكتب المعتمدة + الجلسات التحضيرية + الاجتماعات)
  {
    id: "folder-books-pdf",
    title: "الكتب المعتمدة للتسجيل",
    departmentName: "أنشطة المبادرة والمكتبة",
    departmentId: "activity",
    iconName: "BookOpen",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "ملف نشاط رئيسي",
    url: "https://drive.google.com/drive/my-drive",
    description:
      "ملف الكتب الحاوي على النسخ المعتمدة بصيغة PDF للكتب والروايات المقررة للتسجيل الصوتي.",
    files: [],
  },
  {
    id: "folder-meet-recordings",
    title: "Meet Recordings (تسجيلات الاجتماعات)",
    departmentName: "الإدارة والفعاليات",
    departmentId: "activity",
    iconName: "Video",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "تسجيلات اللقاءات",
    url: "https://drive.google.com/drive/my-drive",
    description:
      "المجلد المخصص لتسجيلات اجتماعات Google Meet الرسمية وورش العمل والندوات الحوارية.",
    files: [],
  },

  // 2. مجلدات أقسام العمل والإنتاج الصوتي الرسمية
  {
    id: "folder-dept-audio-raw",
    title: "التسجيلات الخام (Raw Audio)",
    departmentName: "قسم الإنتاج الصوتي",
    departmentId: "audio",
    iconName: "Mic",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "مجلد قسم الصوتي",
    url: "https://drive.google.com/drive/my-drive",
    description:
      "المجلد المخصص للتسجيلات الصوتية الخام الأصلية المرفوعة من الرواة قبل الهندسة.",
    files: [],
  },
  {
    id: "folder-dept-audio-rejected",
    title: "التسجيلات المطالب بإعادتها (إعادة تسجيل / تعديل)",
    departmentName: "قسم الإنتاج والجودة",
    departmentId: "audio",
    iconName: "AlertTriangle",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "ملاحظات التدقيق",
    url: "https://drive.google.com/drive/my-drive",
    description:
      "المجلد المخصص للمقاطع الصوتية التي تتطلب إعادة تسجيل أو تصحيح بناءً على تقارير التدقيق والجودة.",
    files: [],
  },
  {
    id: "folder-dept-audio-eng",
    title: "الهندسة الصوتية والمونتاج (Montage & Mixing)",
    departmentName: "قسم الإنتاج الصوتي",
    departmentId: "audio",
    iconName: "Sliders",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "مجلد قسم الصوتي",
    url: "https://drive.google.com/drive/my-drive",
    description:
      "المجلد المخصص لمشاريع هندسة الصوت والمونتاج، تنقية المقاطع والماستر النهائي.",
    files: [],
  },
  {
    id: "folder-dept-final",
    title: "النسخ النهائية للنشر (Final Master)",
    departmentName: "النشر والتقنية",
    departmentId: "tech",
    iconName: "CheckCircle",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "جاهز للنشر",
    url: "https://drive.google.com/drive/my-drive",
    description:
      "المجلد المخصص للنسخ المكتملة المعتمدة بعد الماسترينج والجاهزة للبث والنشر على المنصات.",
    files: [],
  },
  {
    id: "folder-dept-content",
    title: "قسم المحتوى والنصوص (Content & Texts)",
    departmentName: "قسم المحتوى والحقوق",
    departmentId: "content",
    iconName: "FileText",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "مجلد قسم المحتوى",
    url: "https://drive.google.com/drive/my-drive",
    description:
      "المجلد المخصص لإعداد النصوص، التدقيق اللغوي، والمسودات المكتوبة.",
    files: [],
  },
  {
    id: "folder-dept-design",
    title: "التصميم والميديا (Design & Media)",
    departmentName: "قسم الفعاليات والتصميم",
    departmentId: "design",
    iconName: "Image",
    fileCount: 0,
    size: "Google Drive Direct",
    lastUpdated: "مجلد قسم التصميم",
    url: "https://drive.google.com/drive/my-drive",
    description: "المجلد المخصص للأغلفة، الهويات البصرية، والتصاميم الترويجية.",
    files: [],
  },
];
