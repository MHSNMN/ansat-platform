import { ActivityItem } from "./activityTypes";

export const PRESET_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-youth-manifesto",
    title: "بيان الشباب العربي للثقافة والعلوم",
    slug: "arab-youth-manifesto",
    shortDescription:
      "حراك فكري ومبادرة شبابية عربية مستقلة برعاية إنصات لصياغة رؤية معرفية وعلمية مشتركة تنهض بالمحتوى العربي وتعزز مساهمة الشباب في إنتاج الثقافة والعلوم.",
    fullDescription: `«بيان الشباب العربي للثقافة والعلوم» هو وثيقة حية وحراك معرفي جامع انطلق بمبادرة من نخب شبابية وباحثين وكتاب من مختلف الأقطار العربية، ليكون فضاءً حراً للتفكير والتنسيق والنهوض بالمشهد الثقافي والعلمي العربي.

أبرز محاور وأهداف البيان:
1. استعادة المبادرة الشبابية في إنتاج المعرفة وعدم الاكتفاء بالاستهلاك الرقمي السطحي.
2. تيسير العلوم والفلسفة والفكر الإنساني باللسان العربي الفصيح من خلال الصوت والرقمنة.
3. بناء شبكة تضامن فكرية عابرة للحدود الجغرافية تجمع القراء والباحثين والمهندسين.
4. إطلاق حلقات نقاش دورية وندوات افتراضية تتناول قضايا الفكر، الترجمة، وحقوق الوصول الحر للمعرفة.

يستقبل البيان توقيعات ومشاركات المثقفين والمهتمين، وتُنشر مخرجاته وجلساته الحوارية تباعاً عبر منصة إنصات.`,
    coverImage:
      "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1000&q=80",
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=800&q=80",
        caption: "جلسة حوارية لإعداد ميثاق الشباب العربي للثقافة والعلوم",
      },
      {
        url: "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80",
        caption: "حلقة نقاشية حول النهوض بالمحتوى المعرفي العربي الرقمي",
      },
    ],
    activityType: "CULTURAL_SESSION",
    mode: "HYBRID",
    location: "جلسات افتراضية دورية عبر زووم + ملتقيات حضورية سنوية",
    meetingLink: "https://t.me/ensat_audio",
    startDate: "2025-01-15",
    organizers: ["أمانة بيان الشباب العربي", "مبادرة إنصات للثقافة والمعرفة"],
    participantsCount: 140,
    relatedLinks: [
      {
        title: "قناة البيان والمناقشات على تيليغرام",
        url: "https://t.me/ensat_audio",
      },
      {
        title: "حساب إنصات الرسمي على منصة X",
        url: "https://x.com/ensat_audio",
      },
    ],
    recordingUrl: "",
    attachments: [{ title: "مسودة وثيقة بيان الشباب العربي (PDF)", url: "#" }],
    status: "ONGOING",
    featured: true,
    createdAt: "2025-01-01T10:00:00.000Z",
    updatedAt: "2025-02-01T10:00:00.000Z",
  },
  {
    id: "act-narrator-forum",
    title: "ملتقى الرواة العرب وقراءات التراث الفكري",
    slug: "arab-narrators-forum",
    shortDescription:
      "جلسات أسبوعية تجمع القراء والمعلقين الصوتيين لمناقشة فنون الإلقاء، الوقف والابتداء، ومخارج الحروف في قراءة أمهات الكتب.",
    fullDescription: `مساحة تدريبية وتفاعلية تجمع الرواة المعتمدين في إنصات والقراء الجدد. يتناول الملتقى تحليل النصوص الكلاسيكية والمعاصرة، وضبط النبر والتنغيم الصوتي بما يلائم طبيعة النص وسياقه الدلالي.`,
    coverImage:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=800&q=80",
    galleryImages: [],
    activityType: "WORKSHOP",
    mode: "ONLINE",
    location: "غرف صوتية تفاعلية عبر منصة إنصات",
    startDate: "2025-02-10",
    organizers: ["لجنة التدريب والأداء الصوتي - إنصات"],
    participantsCount: 85,
    relatedLinks: [{ title: "دليل القارئ في منصة إنصات", url: "#" }],
    attachments: [],
    status: "ONGOING",
    featured: false,
    createdAt: "2025-01-10T10:00:00.000Z",
    updatedAt: "2025-02-10T10:00:00.000Z",
  },
  {
    id: "act-audio-engineering",
    title: "مختبر الماسترينغ الإذاعي وهندسة الصوت",
    slug: "broadcast-audio-lab",
    shortDescription:
      "ورشة متقدمة لمهندسي الصوت المتطوعين حول معايير عزل الضجيج وموازنة الترددات (LUFS) ومعالجة الفواصل الموسيقية.",
    fullDescription: `تركز هذه الورشة على التطبيق العملي لتقنيات معالجة الصوت المعتمدة في إنصات وفق بروتوكول EBU R128 القياسي لضمان نقاء الصوت على كافة أجهزة الاستماع وسماعات الأذن.`,
    coverImage:
      "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80",
    galleryImages: [],
    activityType: "WORKSHOP",
    mode: "ONLINE",
    startDate: "2025-03-01",
    organizers: ["قسم الهندسة الصوتية والماسترينغ"],
    participantsCount: 42,
    relatedLinks: [],
    attachments: [],
    status: "UPCOMING",
    featured: false,
    createdAt: "2025-01-20T10:00:00.000Z",
    updatedAt: "2025-02-15T10:00:00.000Z",
  },
];
