export interface CategoryTopic {
  id: string;
  name: string;
  slug: string;
  description: string;
  coverImage?: string;
  icon?: string;
  order: number;
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  updatedAt: string;
}

export type LibraryTopic = CategoryTopic;

export type AudioPublishStatus =
  "DRAFT" | "REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface AudioLibraryItem {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription?: string;
  coverUrl: string;
  bookTitle?: string;
  authorName?: string;
  narratorName?: string;
  audioEngineerName?: string;
  reviewerName?: string;
  category: string; // e.g. "الأدب", "الفلسفة", "التاريخ", "الفكر", "التعليم", "الجلسات الثقافية"
  categoryId?: string;
  durationSeconds: number;
  language: string;
  culturalScope?: string;
  tags: string[];
  audioUrl: string;
  driveFileId?: string;
  optionalPdfUrl?: string;
  spotifyUrl?: string;
  rssUrl?: string;
  publishDate: string;
  status: AudioPublishStatus;
  featured: boolean;
  order: number;
  playCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const PRESET_TOPICS: CategoryTopic[] = [
  {
    id: "topic-literature",
    name: "الأدب والرواية",
    slug: "literature",
    description:
      "نصوص مختارة من عيون الأدب العربي والعالمي وقصص وروايات ملهمة.",
    icon: "BookOpen",
    order: 1,
    visibility: "PUBLIC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "topic-philosophy",
    name: "الفلسفة والمنطق",
    slug: "philosophy",
    description: "تأملات فكرية ومباحث فلسفية تبحث في الوجود والمعرفة والإنسان.",
    icon: "Brain",
    order: 2,
    visibility: "PUBLIC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "topic-history",
    name: "التاريخ والحضارة",
    slug: "history",
    description: "محطات مضيئة وتوثيق للتجارب الإنسانية الكبرى وحركات التنوير.",
    icon: "Landmark",
    order: 3,
    visibility: "PUBLIC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "topic-thought",
    name: "الفكر والوعي المجتمعي",
    slug: "thought",
    description: "أطروحات معاصرة تناقش تحديات الفكر العربي وبناء الوعي.",
    icon: "Lightbulb",
    order: 4,
    visibility: "PUBLIC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "topic-education",
    name: "التعليم والمعرفة",
    slug: "education",
    description: "مواد مبسطة ومهارات معرفية تثري شغف التعلم والارتقاء الشخصي.",
    icon: "GraduationCap",
    order: 5,
    visibility: "PUBLIC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "topic-sessions",
    name: "الجلسات الثقافية",
    slug: "sessions",
    description: "تسجيلات صوتية للنقاشات الحوارية والقراءات الجماعية لإنصات.",
    icon: "Mic2",
    order: 6,
    visibility: "PUBLIC",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
