import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import React, { useEffect, useMemo, useState } from "react";
import { CountUpNumber } from "./CountUpNumber";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  FileBadge2,
  Filter,
  Headphones,
  HeartHandshake,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Menu,
  MessageSquare,
  Mic,
  Phone,
  Play,
  Plus,
  Radio,
  Search,
  Send,
  Sparkles,
  Trash2,
  AlertTriangle,
  Users,
  Volume2,
  X,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../auth/useAuth";
import { CmsSiteContent } from "../cms/cmsTypes";
import { DEFAULT_CMS_CONTENT } from "../cms/cmsDefaults";
import {
  AudioLibraryItem,
  LibraryTopic,
  PRESET_TOPICS,
} from "../library/libraryTypes";
import { ActivityItem } from "../activities/activityTypes";
import { PRESET_ACTIVITIES } from "../activities/presetActivities";
import { VolunteerFormDefinition } from "../volunteer/volunteerTypes";
import { PRESET_VOLUNTEER_FORMS } from "../volunteer/volunteerPresets";
import { AudioPlayerBar } from "../library/AudioPlayerBar";
import { ActivityDetailModal } from "../activities/ActivityDetailModal";
import { ActivityEditorModal } from "../activities/ActivityEditorModal";
import { AccountActivationModal } from "../migration/AccountActivationModal";
import { VolunteerFormModal } from "../volunteer/VolunteerFormModal";
import { InlineEditorBar } from "../cms/InlineEditorBar";
import { CmsTextEditorModal, CmsEditorTab } from "../cms/CmsTextEditorModal";
import { LibraryEditorModal } from "../library/LibraryEditorModal";
import { ARAB_COUNTRIES } from "../lib/phoneUtils";

type PortalProps = { onOpenWorkspace: () => void };

const navLinks = [
  { label: "الرئيسية", href: "home" },
  { label: "مجتمعنا والدول", href: "countries" },
  { label: "محاور العمل", href: "pillars" },
  { label: "الفعاليات والمبادرات", href: "events" },
  { label: "المكتبة الصوتية", href: "library" },
  { label: "رحلة العمل", href: "journey" },
  { label: "عن إنصات", href: "about" },
  { label: "التواصل الرسمي", href: "contact" },
];

export const getCountryFlag = (countryName: string): string => {
  const norm = (countryName || "").trim().toLowerCase();
  const found = ARAB_COUNTRIES.find(
    (c) =>
      c.nameAr.includes(norm) ||
      norm.includes(c.nameAr) ||
      (c.code === "PS" &&
        (norm.includes("فلسطين") || norm.includes("palestine"))) ||
      (c.code === "EG" && (norm.includes("مصر") || norm.includes("egypt"))) ||
      (c.code === "IQ" && (norm.includes("عراق") || norm.includes("iraq"))) ||
      (c.code === "MA" &&
        (norm.includes("مغرب") || norm.includes("morocco"))) ||
      (c.code === "SY" && (norm.includes("سوريا") || norm.includes("syria"))),
  );
  return found?.flag || "🌍";
};

export function PublicPortal({ onOpenWorkspace }: PortalProps) {
  const { user } = useAuth();
  const [selectedCountryTab, setSelectedCountryTab] = useState<string>("ALL");

  // 3D Tilt Logic for the Hero Card
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springConfig = { damping: 25, stiffness: 300, mass: 0.5 };
  const rotateX = useSpring(
    useTransform(mouseY, [0, 1], [8, -8]),
    springConfig,
  );
  const rotateY = useSpring(
    useTransform(mouseX, [0, 1], [-8, 8]),
    springConfig,
  );
  const glareX = useSpring(
    useTransform(mouseX, [0, 1], [-50, 150]),
    springConfig,
  );
  const glareY = useSpring(
    useTransform(mouseY, [0, 1], [-50, 150]),
    springConfig,
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  };
  const handleMouseLeave = () => {
    mouseX.set(0.5);
    mouseY.set(0.5);
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // CMS Content State - Hydrated from localStorage immediately to guarantee persistence after refresh
  const [cmsContent, setCmsContent] = useState<CmsSiteContent>(() => {
    try {
      const cached = localStorage.getItem("ensat_cms_content_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          ...DEFAULT_CMS_CONTENT,
          ...parsed,
          images: {
            ...(DEFAULT_CMS_CONTENT.images || {}),
            ...(parsed.images || {}),
          },
          pillars: {
            ...(DEFAULT_CMS_CONTENT.pillars || {}),
            ...(parsed.pillars || {}),
          },
          youthManifesto: {
            ...(DEFAULT_CMS_CONTENT.youthManifesto || {}),
            ...(parsed.youthManifesto || {}),
          },
        };
      }
    } catch (e) {
      console.warn("Failed to read initial cached CMS content", e);
    }
    return DEFAULT_CMS_CONTENT;
  });

  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [isTextEditorOpen, setIsTextEditorOpen] = useState(false);
  const [textEditorInitialTab, setTextEditorInitialTab] =
    useState<CmsEditorTab>("hero");
  const [previewMode, setPreviewMode] = useState<"published" | "draft">(
    "draft",
  );

  // Contact quick form state
  const [contactFormData, setContactFormData] = useState({
    name: "",
    emailOrPhone: "",
    subject: "استفسار عام",
    message: "",
  });
  const [contactFormSubmitted, setContactFormSubmitted] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // Data Collections
  const [libraryItems, setLibraryItems] = useState<AudioLibraryItem[]>([]);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>(() => {
    try {
      const cached = localStorage.getItem("ensat_activities_cache");
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return PRESET_ACTIVITIES;
  });
  const [volunteerForms, setVolunteerForms] = useState<
    VolunteerFormDefinition[]
  >(PRESET_VOLUNTEER_FORMS);
  const [topics, setTopics] = useState<LibraryTopic[]>(PRESET_TOPICS);

  // Activities Spotlight & Filtering State
  const [selectedSpotlightId, setSelectedSpotlightId] = useState<string>(() => {
    try {
      const cached = localStorage.getItem("ensat_activities_cache");
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
      }
    } catch (_err) {
      // ignore cache read error
    }
    return "act-youth-manifesto";
  });
  const [spotlightDirection, setSpotlightDirection] = useState<number>(1);
  const [activityCategoryFilter, setActivityCategoryFilter] =
    useState<string>("ALL");
  const [activityStatusFilter, setActivityStatusFilter] =
    useState<string>("ALL");
  const [activitySearchQuery, setActivitySearchQuery] = useState<string>("");
  const [activityToDelete, setActivityToDelete] = useState<ActivityItem | null>(
    null,
  );
  const [isDeletingActivity, setIsDeletingActivity] = useState<boolean>(false);

  // Real Audio Duration calculation - completely dynamic from real recordings on page
  const actualAudioSeconds = useMemo(() => {
    if (!libraryItems || libraryItems.length === 0) return 0;
    return libraryItems.reduce(
      (acc, item) => acc + (Math.max(0, Number(item.durationSeconds)) || 0),
      0,
    );
  }, [libraryItems]);

  const actualAudioHours = Math.floor(actualAudioSeconds / 3600);
  const actualAudioMinutes = Math.floor((actualAudioSeconds % 3600) / 60);
  const actualAudioRemainderSec = actualAudioSeconds % 60;

  // Metrics
  const [metrics, setMetrics] = useState({
    projects: 12,
    finalAudioSeconds: 0,
    volunteers: 34,
    memberNames: [] as string[],
    countries: [] as { name: string; count: number; members: string[] }[],
    projectsList: [] as {
      id: string;
      title: string;
      authorName?: string;
      category?: string;
      totalParts?: number;
      completedParts?: number;
    }[],
  });

  // Library Interactive State
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPlayingItem, setCurrentPlayingItem] =
    useState<AudioLibraryItem | null>(null);

  // Modals
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(
    null,
  );
  const [isActivityEditorOpen, setIsActivityEditorOpen] = useState(false);
  const [activityToEdit, setActivityToEdit] = useState<ActivityItem | null>(
    null,
  );
  const [isLibraryEditorOpen, setIsLibraryEditorOpen] = useState(false);
  const [libraryToEdit, setLibraryToEdit] = useState<AudioLibraryItem | null>(
    null,
  );
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isVolunteerModalOpen, setIsVolunteerModalOpen] = useState(false);
  const [activeInfoModal, setActiveInfoModal] = useState<
    "countries" | "projects" | "privacy" | "terms" | "volunteers" | null
  >(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const [serverVerifiedCanEdit, setServerVerifiedCanEdit] = useState(false);

  // Derived active spotlight activity
  const activeSpotlightActivity = useMemo(() => {
    if (!activityItems || activityItems.length === 0) return null;
    const found = activityItems.find((a) => a.id === selectedSpotlightId);
    if (found) return found;
    const featured = activityItems.find((a) => a.featured);
    return featured || activityItems[0];
  }, [activityItems, selectedSpotlightId]);

  // Derived filtered activities
  const filteredActivities = useMemo(() => {
    return activityItems.filter((item) => {
      if (
        activityCategoryFilter !== "ALL" &&
        item.activityType !== activityCategoryFilter
      ) {
        return false;
      }
      if (
        activityStatusFilter !== "ALL" &&
        item.status !== activityStatusFilter
      ) {
        return false;
      }
      if (activitySearchQuery.trim()) {
        const q = activitySearchQuery.trim().toLowerCase();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesDesc =
          item.shortDescription?.toLowerCase().includes(q) ||
          item.fullDescription?.toLowerCase().includes(q);
        const matchesOrg = item.organizers?.some((org) =>
          org.toLowerCase().includes(q),
        );
        if (!matchesTitle && !matchesDesc && !matchesOrg) return false;
      }
      return true;
    });
  }, [
    activityItems,
    activityCategoryFilter,
    activityStatusFilter,
    activitySearchQuery,
  ]);

  const switchSpotlightActivity = (
    targetId: string,
    shouldScrollToSection = false,
  ) => {
    if (targetId === selectedSpotlightId) {
      if (shouldScrollToSection) {
        const el = document.getElementById("events");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }
    const currentIndex = activityItems.findIndex(
      (a) => a.id === selectedSpotlightId,
    );
    const targetIndex = activityItems.findIndex((a) => a.id === targetId);
    setSpotlightDirection(targetIndex >= currentIndex ? 1 : -1);
    setSelectedSpotlightId(targetId);
    if (shouldScrollToSection) {
      const el = document.getElementById("events");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleNextSpotlight = () => {
    if (!activityItems || activityItems.length <= 1) return;
    const currentId = activeSpotlightActivity?.id || selectedSpotlightId;
    const currentIndex = activityItems.findIndex((a) => a.id === currentId);
    const nextIndex = (currentIndex + 1) % activityItems.length;
    setSpotlightDirection(1);
    setSelectedSpotlightId(activityItems[nextIndex].id);
  };

  const handlePrevSpotlight = () => {
    if (!activityItems || activityItems.length <= 1) return;
    const currentId = activeSpotlightActivity?.id || selectedSpotlightId;
    const currentIndex = activityItems.findIndex((a) => a.id === currentId);
    const prevIndex =
      (currentIndex - 1 + activityItems.length) % activityItems.length;
    setSpotlightDirection(-1);
    setSelectedSpotlightId(activityItems[prevIndex].id);
  };

  const spotlightVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 70 : -70,
      scale: 0.96,
      filter: "blur(4px)",
    }),
    center: {
      opacity: 1,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -70 : 70,
      scale: 0.96,
      filter: "blur(4px)",
      transition: {
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1] as const,
      },
    }),
  };

  const handleActivitySaved = (savedActivity: ActivityItem) => {
    setActivityItems((prev) => {
      const exists = prev.some((a) => a.id === savedActivity.id);
      const updated = exists
        ? prev.map((a) => (a.id === savedActivity.id ? savedActivity : a))
        : [savedActivity, ...prev];
      try {
        localStorage.setItem("ensat_activities_cache", JSON.stringify(updated));
      } catch (e) {
        console.warn("Activities cache write note", e);
      }
      return updated;
    });
    setSelectedSpotlightId(savedActivity.id);
    setIsActivityEditorOpen(false);
    setActivityToEdit(null);
  };

  const handleActivityDeleted = (deletedId: string) => {
    setActivityItems((prev) => {
      const updated = prev.filter((a) => a.id !== deletedId);
      try {
        localStorage.setItem("ensat_activities_cache", JSON.stringify(updated));
      } catch (e) {
        console.warn("Activities cache write note", e);
      }
      return updated;
    });
    if (selectedSpotlightId === deletedId) {
      const remaining = activityItems.filter((a) => a.id !== deletedId);
      if (remaining.length > 0) {
        setSelectedSpotlightId(remaining[0].id);
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!activityToDelete) return;
    setIsDeletingActivity(true);
    try {
      const res = await apiFetch(
        `/api/admin/content/public_activities/${activityToDelete.id}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        await apiFetch(
          `/api/admin/content/public_activities/${activityToDelete.id}/archive`,
          {
            method: "PATCH",
          },
        );
      }
    } catch (e) {
      console.warn("Server delete activity note:", e);
    }
    handleActivityDeleted(activityToDelete.id);
    setIsDeletingActivity(false);
    setActivityToDelete(null);
  };

  useEffect(() => {
    let isCancelled = false;
    async function verifyCmsAccess() {
      if (!user) {
        setServerVerifiedCanEdit(false);
        return;
      }
      try {
        const res = await apiFetch("/api/admin/check-cms-permission");
        if (!isCancelled) {
          if (res.ok) {
            const data = await res.json();
            setServerVerifiedCanEdit(Boolean(data?.allowed));
          } else {
            setServerVerifiedCanEdit(false);
          }
        }
      } catch {
        if (!isCancelled) setServerVerifiedCanEdit(false);
      }
    }
    verifyCmsAccess();
    return () => {
      isCancelled = true;
    };
  }, [user]);

  const featuredRecording = useMemo(() => {
    return libraryItems.find((i) => i.featured) || libraryItems[0] || null;
  }, [libraryItems]);

  const canEditCms = Boolean(user && serverVerifiedCanEdit);

  const fetchSiteData = async (mode: "published" | "draft" = previewMode) => {
    try {
      setLoading(true);
      const url =
        mode === "draft"
          ? "/api/public/site-overview?preview=draft"
          : "/api/public/site-overview";
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.content) {
            let merged: CmsSiteContent = {
              ...DEFAULT_CMS_CONTENT,
              ...data.content,
              images: {
                ...(DEFAULT_CMS_CONTENT.images || {}),
                ...(data.content.images || {}),
              },
              pillars: {
                ...(DEFAULT_CMS_CONTENT.pillars || {}),
                ...(data.content.pillars || {}),
              },
              youthManifesto: {
                ...(DEFAULT_CMS_CONTENT.youthManifesto || {}),
                ...(data.content.youthManifesto || {}),
              },
              sections:
                data.content.sections?.length > 0
                  ? data.content.sections
                  : DEFAULT_CMS_CONTENT.sections,
            };

            // Overlay cached changes if any exists
            try {
              const cached = localStorage.getItem("ensat_cms_content_cache");
              if (cached) {
                const parsed = JSON.parse(cached);
                merged = {
                  ...merged,
                  ...parsed,
                  images: {
                    ...(merged.images || {}),
                    ...(parsed.images || {}),
                  },
                  pillars: {
                    ...(merged.pillars || {}),
                    ...(parsed.pillars || {}),
                  },
                  youthManifesto: {
                    ...(merged.youthManifesto || {}),
                    ...(parsed.youthManifesto || {}),
                  },
                };
              }
            } catch (e) {
              console.warn("Failed to overlay cached CMS content", e);
            }

            setCmsContent(merged);
          }
          if (Array.isArray(data.library)) {
            setLibraryItems(data.library);
            if (data.library.length > 0 && !currentPlayingItem) {
              setCurrentPlayingItem(data.library[0]);
            }
          }
          if (Array.isArray(data.activities)) {
            let acts = data.activities;
            try {
              const cached = localStorage.getItem("ensat_activities_cache");
              if (cached !== null) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                  acts = parsed;
                }
              }
            } catch {
              // ignore
            }
            setActivityItems(acts);
            setSelectedSpotlightId((prev) => {
              if (acts.some((a) => a.id === prev)) return prev;
              return acts.length > 0 ? acts[0].id : "";
            });
          }
          if (Array.isArray(data.volunteerForms))
            setVolunteerForms(data.volunteerForms);
          if (Array.isArray(data.topics)) setTopics(data.topics);
          if (data.metrics) setMetrics(data.metrics);
        }
      }
    } catch {
      // Fallback already in initial state
    } finally {
      setLoading(false);
    }
  };

  const handleOpenTextEditor = (tab: CmsEditorTab = "hero") => {
    setTextEditorInitialTab(tab);
    setIsTextEditorOpen(true);
  };

  const handleOpenYouthManifesto = () => {
    const act = activityItems.find((a) => a.id === "act-youth-manifesto");
    if (act) {
      setSelectedActivity(act);
    } else {
      setSelectedActivity({
        id: "act-youth-manifesto",
        title:
          cmsContent.youthManifesto?.title ||
          "بيان الشباب العربي للثقافة والعلوم",
        slug: "act-youth-manifesto",
        shortDescription: cmsContent.youthManifesto?.summary || "",
        fullDescription: cmsContent.youthManifesto?.summary || "",
        coverImage: cmsContent.images?.youthManifesto || "",
        galleryImages: [],
        activityType: "CULTURAL_SESSION",
        mode: "ONLINE",
        startDate: "2025-01-01",
        organizers: ["فريق إنصات"],
        relatedLinks: [],
        attachments: [],
        status: "COMPLETED",
        createdAt: "2025-01-01",
        updatedAt: "2025-01-01",
        summary:
          cmsContent.youthManifesto?.summary ||
          "مبادرة شبابية عربية مستقلة برعاية إنصات، تهدف إلى بناء رؤية فكرية وعلمية مشتركة تنهض بالمحتوى الثقافي وتصنع حراكاً علمياً عربياً.",
        date: "2025 - 2026",
        location: "عمان، وبث رقمي عربي موحد",
        category: "حراك ثقافي",
        image:
          cmsContent.images?.youthManifesto ||
          "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1000&q=80",
        featured: true,
        tags: ["بيان الشباب", "ثقافة", "علوم", "ميثاق فكري"],
        body: `${cmsContent.youthManifesto?.summary || ""}\n\nأهم بنود وأهداف البيان:\n${(
          cmsContent.youthManifesto?.documentPoints || []
        )
          .map((p, i) => `${i + 1}. ${p}`)
          .join("\n")}`,
      });
    }
  };

  useEffect(() => {
    fetchSiteData();
    // Initial CMS/bootstrap request; subsequent updates are driven by explicit editor actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Filtered Library Items
  const filteredLibrary = useMemo(() => {
    return libraryItems.filter((item) => {
      const matchTopic =
        selectedTopic === "all" ||
        item.category === selectedTopic ||
        (item.tags && item.tags.includes(selectedTopic));
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.authorName && item.authorName.toLowerCase().includes(q)) ||
        (item.narratorName && item.narratorName.toLowerCase().includes(q)) ||
        (item.shortDescription &&
          item.shortDescription.toLowerCase().includes(q));
      return matchTopic && matchSearch;
    });
  }, [libraryItems, selectedTopic, searchQuery]);

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#090c15] text-slate-100 selection:bg-amber-400 selection:text-slate-950 font-['IBM_Plex_Sans_Arabic',sans-serif] relative pb-28 overflow-x-hidden"
    >
      {/* Ambient background light gradients for visual depth */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-[700px] bg-[radial-gradient(ellipse_75%_50%_at_50%_-5%,rgba(245,158,11,0.08),transparent_70%)] z-0" />
      <div className="pointer-events-none absolute top-[1600px] right-0 w-[550px] h-[550px] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.035),transparent_70%)] z-0" />
      <div className="pointer-events-none absolute top-[3000px] left-0 w-[500px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.03),transparent_70%)] z-0" />

      {/* Inline Editor Bar for Authorized Personnel */}
      {canEditCms && (
        <InlineEditorBar
          content={cmsContent}
          isEditing={isInlineEditing}
          previewMode={previewMode}
          onToggleEdit={setIsInlineEditing}
          onContentChange={setCmsContent}
          onRefresh={(mode) => fetchSiteData(mode || previewMode)}
          onOpenTextEditor={handleOpenTextEditor}
          onTogglePreviewMode={(mode) => {
            setPreviewMode(mode);
            fetchSiteData(mode);
          }}
        />
      )}

      {/* Unified Member Activation Banner */}
      <div className="relative z-30 bg-gradient-to-r from-amber-500/10 via-amber-400/20 to-amber-500/10 border-b border-amber-500/20 py-2.5 px-4 text-center text-xs sm:text-sm text-amber-200 flex items-center justify-center gap-2.5 flex-wrap backdrop-blur-sm">
        <Sparkles size={15} className="text-amber-400 shrink-0" />
        <span>هل استلمت كود انضمام كعضو جديد أو كنت عضواً سابقاً؟</span>
        <button
          type="button"
          onClick={() => setIsPinModalOpen(true)}
          className="underline font-bold text-amber-300 hover:text-white transition flex items-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-95"
        >
          <KeyRound size={13} />
          <span>تفعيل العضوية وتأكيد الحساب بكود التفعيل</span>
        </button>
      </div>

      {/* Main Header / Navigation */}
      <header className="sticky top-0 z-40 bg-[#090c15]/90 backdrop-blur-xl border-b border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <a href="#home" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 group-hover:shadow-amber-500/35 transition-all duration-200">
              <Headphones size={22} />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white block leading-tight group-hover:text-amber-300 transition-colors">
                إنصات
              </span>
              <span className="text-[11px] font-semibold text-amber-400 block">
                المنصة المركزية للإنتاج الصوتي
              </span>
            </div>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
            {navLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollTo(link.href)}
                className="hover:text-amber-400 hover:-translate-y-0.5 transition-all duration-150 cursor-pointer"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPinModalOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              title="تفعيل عضو جديد أو ترحيل حساب قديم بكود التفعيل"
            >
              <KeyRound size={14} className="text-amber-400" />
              <span>تفعيل العضوية بالكود</span>
            </button>

            <button
              type="button"
              onClick={() => setIsVolunteerModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300 hover:bg-amber-400 hover:text-slate-950 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Users size={15} />
              <span>طلب تطوع</span>
            </button>

            <button
              type="button"
              onClick={onOpenWorkspace}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all duration-200 shadow-lg shadow-amber-400/20 hover:shadow-amber-400/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Lock size={14} />
              <span>بوابة الأعضاء</span>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition cursor-pointer"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {menuOpen && (
          <div className="lg:hidden border-b border-white/[0.08] bg-[#0d121f] px-6 py-5 space-y-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
            {navLinks.map((link) => (
              <button
                key={link.href}
                type="button"
                onClick={() => scrollTo(link.href)}
                className="block w-full text-right py-2 text-slate-200 hover:text-amber-400 font-medium cursor-pointer"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-3 border-t border-white/[0.08] flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setIsVolunteerModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl bg-amber-400/15 text-amber-300 text-xs font-bold text-center cursor-pointer hover:bg-amber-400/25 transition"
              >
                تقديم طلب تطوع
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setIsPinModalOpen(true);
                }}
                className="w-full py-2.5 rounded-xl border border-white/15 text-slate-200 text-xs font-bold text-center cursor-pointer hover:bg-white/10 transition flex items-center justify-center gap-1.5"
              >
                <KeyRound size={14} className="text-amber-400" />
                <span>تفعيل العضوية وتأكيد الحساب (كود / PIN)</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section
        id="home"
        className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-white/[0.08]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Content (7 cols) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-7 space-y-6"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold shadow-sm">
                  <Radio size={14} className="animate-pulse text-amber-400" />
                  <span>مبادرة ثقافية عربية مستقلة</span>
                </div>
                {isInlineEditing && (
                  <button
                    type="button"
                    onClick={() => handleOpenTextEditor("hero")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    <Edit3 size={13} />
                    <span>تعديل نصوص الواجهة الترحيبية</span>
                  </button>
                )}
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-[1.2]">
                {cmsContent.headline || "صوتٌ يصنع المعرفة، وأثرٌ يبقى للأجيال"}
              </h1>

              <p className="text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl">
                {cmsContent.description ||
                  "منصة «إنصات» فضاء عربي ريادي لإنتاج ونشر المواد الصوتية الثقافية والفكرية بجودة هندسية ولغوية رفيعة، بإسهام نخبة من الرواة ومهندسي الصوت والمدققين من مختلف أرجاء الوطن العربي."}
              </p>

              {/* Action Buttons with high-contrast hierarchy */}
              <div className="pt-2 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => scrollTo("library")}
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm flex items-center gap-2.5 transition-all duration-200 shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <Headphones size={18} />
                  <span>استمع إلى المكتبة الصوتية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsVolunteerModalOpen(true)}
                  className="px-7 py-4 rounded-2xl border border-slate-700/80 hover:border-amber-400/50 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-sm flex items-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm cursor-pointer"
                >
                  <HeartHandshake size={18} className="text-amber-400" />
                  <span>انضم كمتطوع</span>
                </button>
              </div>

              {/* Verified Trust Badges */}
              <div className="pt-3 flex flex-wrap items-center gap-6 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>تدقيق لغوي ومراجعة أداء دقيقة</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>هندسة وماسترينغ صوتي احترافي</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>أرشفة سحابية محمية ومستدامة</span>
                </div>
              </div>
            </motion.div>

            {/* Right Card: Authentic Cultural Audio Showcase */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1],
                delay: 0.1,
              }}
              className="lg:col-span-5"
              style={{ perspective: "1000px" }}
            >
              <motion.div
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{
                  rotateX,
                  rotateY,
                  transformStyle: "preserve-3d",
                }}
                className="relative rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#13192b]/95 via-[#0e1424]/95 to-[#0a0f1d]/95 p-6 sm:p-7 shadow-2xl shadow-black/70 backdrop-blur-xl min-h-[340px] flex flex-col will-change-transform group hover:border-amber-400/40 transition-colors"
              >
                <motion.div
                  style={{ x: glareX, y: glareY, opacity: 0.15 }}
                  className="pointer-events-none absolute -inset-[100%] z-20 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,transparent_50%)] mix-blend-overlay transition-opacity duration-500"
                />

                {featuredRecording ? (
                  <>
                    <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center overflow-hidden shrink-0 border border-amber-400/30 shadow-md">
                          <img
                            src={
                              featuredRecording.coverUrl ||
                              "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&q=80"
                            }
                            alt="Cover"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-amber-400/90 font-bold block">
                            تسجيل مختار من مكتبة إنصات
                          </span>
                          <h4 className="text-sm font-bold text-white line-clamp-1">
                            {featuredRecording.title}
                          </h4>
                        </div>
                      </div>
                      <span className="text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold whitespace-nowrap">
                        جاهز للاستماع
                      </span>
                    </div>

                    <div className="py-4 space-y-3 grow">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>
                          الراوي:{" "}
                          <b className="text-slate-200">
                            {featuredRecording.narratorName ||
                              "فريق رواة إنصات"}
                          </b>
                        </span>
                        <span>
                          التصنيف:{" "}
                          <b className="text-amber-300">
                            {featuredRecording.category || "فكر وأدب"}
                          </b>
                        </span>
                      </div>

                      {/* Animated Soundwave Frequency Spectrum */}
                      <div className="p-3 bg-black/30 rounded-2xl border border-white/[0.06] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 h-6">
                          {[
                            14, 22, 10, 24, 18, 12, 20, 16, 24, 12, 20, 15, 23,
                            10,
                          ].map((h, i) => (
                            <span
                              key={i}
                              className="w-1 bg-amber-400/70 rounded-full animate-pulse"
                              style={{
                                height: `${h}px`,
                                animationDelay: `${i * 90}ms`,
                                animationDuration: "1.1s",
                              }}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {featuredRecording.durationSeconds
                            ? `${Math.floor(featuredRecording.durationSeconds / 60)}:${(featuredRecording.durationSeconds % 60).toString().padStart(2, "0")} د`
                            : "تسجيل كامل"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">
                        {featuredRecording.shortDescription ||
                          "استمع إلى هذا الإصدار الصوتي المعتمد والمحقق وفق أعلى معايير الأداء اللغوي والهندسي."}
                      </p>
                    </div>

                    {/* Direct Listen Trigger */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentPlayingItem(featuredRecording);
                          scrollTo("library");
                        }}
                        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-amber-500/20 hover:shadow-amber-500/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                      >
                        <Play size={16} fill="currentColor" />
                        <span>تشغيل الصوت والاستماع</span>
                      </button>
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400">
                      <span>جودة البث: 48kHz / 24-bit</span>
                      <span className="text-amber-300 font-bold">
                        أرشفة سحابية مؤمنة
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center h-full grow space-y-4 py-8">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                      <Headphones size={28} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">
                        المكتبة قيد التجهيز
                      </h4>
                      <p className="text-xs text-slate-400">
                        سيتم نشر الإصدارات الصوتية قريباً هنا، ترقبوا كل جديد.
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </div>
        </div>

        {/* Central Live Metrics Bar with Count-Up Animations */}
        <div className="mt-14 border-y border-white/[0.08] bg-[#0d121f]/70 backdrop-blur-md relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-white/[0.08]"
            >
              <div
                onClick={() => setActiveInfoModal("projects")}
                className="p-6 text-center cursor-pointer hover:bg-white/[0.03] transition-all duration-200 group"
              >
                <span className="text-3xl lg:text-4xl font-black text-amber-400 block mb-1 group-hover:scale-105 transition-transform">
                  <CountUpNumber value={metrics.projects || 18} />
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-200 block">
                  كتاب ومشروع صوتي
                </span>
                <span className="text-[11px] text-amber-400/80 group-hover:text-amber-300 underline mt-1 block">
                  عرض القائمة ←
                </span>
              </div>

              <div className="p-6 text-center hover:bg-white/[0.03] transition-all duration-200 flex flex-col items-center justify-center group">
                <span className="text-2xl lg:text-3xl font-black text-amber-400 block mb-1 group-hover:scale-105 transition-transform">
                  {actualAudioSeconds >= 3600 ? (
                    <CountUpNumber value={actualAudioHours} suffix=" ساعة" />
                  ) : actualAudioSeconds > 0 ? (
                    <CountUpNumber value={actualAudioMinutes} suffix=" دقيقة" />
                  ) : (
                    "0 دقيقة"
                  )}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-200 block">
                  تسجيلات جاهزة للاستماع
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {actualAudioSeconds >= 3600
                    ? `+ ${actualAudioMinutes} دقيقة (${libraryItems.length} تسجيل متاح)`
                    : actualAudioSeconds > 0
                      ? `+ ${actualAudioRemainderSec} ثانية (${libraryItems.length} تسجيل متاح)`
                      : "المكتبة الصوتية قيد التجهيز"}
                </span>
              </div>

              <div
                onClick={() => {
                  setActiveInfoModal("volunteers");
                  setMemberSearchQuery("");
                }}
                className="p-6 text-center cursor-pointer hover:bg-white/[0.03] transition-all duration-200 group"
              >
                <span className="text-3xl lg:text-4xl font-black text-amber-400 block mb-1 group-hover:scale-105 transition-transform">
                  <CountUpNumber value={metrics.volunteers || 56} />
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-200 block">
                  عضواً ومشاركاً موحداً
                </span>
                <span className="text-[11px] text-amber-400/80 group-hover:text-amber-300 underline mt-1 block">
                  عرض قائمة الأسماء ←
                </span>
              </div>

              <div
                onClick={() => setActiveInfoModal("countries")}
                className="p-6 text-center cursor-pointer hover:bg-white/[0.03] transition-all duration-200 group"
              >
                <span className="text-3xl lg:text-4xl font-black text-amber-400 block mb-1 group-hover:scale-105 transition-transform">
                  <CountUpNumber value={metrics.countries?.length || 6} />
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-200 block">
                  بلدان عربية
                </span>
                <span className="text-[11px] text-amber-400/80 group-hover:text-amber-300 underline mt-1 block">
                  عرض قائمة الدول ←
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ABOUT & VISION SECTION with Real Imagery & Technical Credentials */}
      <section
        id="about"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-[#0c111d] relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="grid lg:grid-cols-12 gap-12 items-start"
          >
            <div className="lg:col-span-5 space-y-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-amber-400 tracking-wider">
                  عن منصة إنصات
                </span>
                {isInlineEditing && (
                  <button
                    type="button"
                    onClick={() => handleOpenTextEditor("about")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    <Edit3 size={12} />
                    <span>تعديل نصوص «عن إنصات»</span>
                  </button>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                {cmsContent.aboutTitle ||
                  "مساحة عربية للعمل الثقافي، لا مجرد مكتبة صوتية."}
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line">
                {cmsContent.aboutBody ||
                  "نعمل عن بُعد كفريق متكامل: نختار المادة الرصينة، نقرأها بتأنٍ، نراجعها لغوياً وصوتياً، ثم نشاركها مع الجمهور بصورة تليق بالمحتوى العربي.\n\nنؤمن أن الوصول إلى المعرفة حق، وأن الصوت الجيد يجعل الفكرة أكثر قرباً ورفقةً في الحياة اليومية."}
              </p>

              {/* Real Acoustic Studio Photographic Panel with Editable Link */}
              <div className="relative rounded-3xl overflow-hidden border border-white/[0.1] group shadow-xl">
                <div className="h-52 w-full overflow-hidden">
                  <img
                    src={
                      cmsContent.images?.aboutStudio ||
                      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=1000&q=80"
                    }
                    alt="استوديو إنصات لتسجيل الكتب الصوتية"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                {isInlineEditing && canEditCms && (
                  <button
                    type="button"
                    onClick={() => handleOpenTextEditor("images")}
                    className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-xl bg-slate-950/80 hover:bg-amber-500 hover:text-slate-950 text-white text-[11px] font-bold border border-white/20 transition flex items-center gap-1 shadow-lg backdrop-blur-sm cursor-pointer"
                  >
                    <Camera size={13} />
                    <span>تعديل الصورة</span>
                  </button>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#090c15] via-[#090c15]/60 to-transparent flex flex-col justify-end p-5">
                  <span className="text-[11px] font-bold text-amber-400">
                    استوديوهات إنصات الافتراضية
                  </span>
                  <p className="text-xs text-slate-200 font-medium mt-1">
                    تسجيل معزول صوتياً بدقة 48kHz وتدقيق نحوي معتمد لضمان النطق
                    الفصيح
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-6">
              {/* Vision Card */}
              <div className="p-6 rounded-3xl bg-[#111728] border border-white/[0.08] space-y-3 hover:border-amber-400/40 hover:-translate-y-1 transition-all duration-200 shadow-lg">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
                  <Sparkles size={22} />
                </div>
                <h3 className="text-lg font-bold text-white">رؤيتنا</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {cmsContent.vision ||
                    "أن نكون المرجع العربي الأول للكتب والمواد الصوتية المحققة لغوياً وصوتياً، وموئلاً للمبدعين في الأداء وهندسة الصوت."}
                </p>
              </div>

              {/* Mission Card */}
              <div className="p-6 rounded-3xl bg-[#111728] border border-white/[0.08] space-y-3 hover:border-amber-400/40 hover:-translate-y-1 transition-all duration-200 shadow-lg">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
                  <HeartHandshake size={22} />
                </div>
                <h3 className="text-lg font-bold text-white">رسالتنا</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {cmsContent.mission ||
                    "تمكين الشباب العربي من توظيف أصواتهم ومهاراتهم لخدمة الثقافة والمعرفة، ونشر الأدب والفكر عبر تجارب استماع ثرية."}
                </p>
              </div>

              {/* Goals Card (Full Width) */}
              <div className="sm:col-span-2 p-6 rounded-3xl bg-[#111728] border border-white/[0.08] hover:border-amber-400/40 transition-all duration-200 shadow-lg">
                <h3 className="text-base font-bold text-white mb-3.5 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-amber-400" />
                  <span>أهداف المبادرة ومعايير العمل</span>
                </h3>
                <div className="grid sm:grid-cols-2 gap-3.5 text-xs sm:text-sm text-slate-300">
                  {(cmsContent.goals && cmsContent.goals.length > 0
                    ? cmsContent.goals
                    : [
                        "إثراء المحتوى الصوتي العربي بمواد أدبية وفكرية رفيعة",
                        "بناء شبكة تضامنية من الرواة والمهندسين والمدققين",
                        "توثيق التراث الثقافي ونقله للأجيال الشابة",
                        "توفير بيئة إنتاجية منظمة تحترم جهود المتطوعين",
                      ]
                  ).map((goal, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                      <span className="leading-relaxed">{goal}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ARAB COMMUNITY & PARTICIPATING COUNTRIES SECTION */}
      <section
        id="countries"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-[#090e1a] relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold text-amber-400 tracking-wider bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                  مجتمعنا العربي
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {metrics.countries?.length || 5} بلدان عربية ·{" "}
                  {metrics.volunteers || 75} عضواً ومشاركاً
                </span>
                {isInlineEditing && canEditCms && (
                  <button
                    type="button"
                    onClick={() => handleOpenTextEditor("countries")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    <Edit3 size={12} />
                    <span>إدارة قائمة الدول</span>
                  </button>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
                أصوات من أرجاء الوطن العربي
              </h2>
              <p className="text-sm sm:text-base text-slate-300 max-w-2xl mt-2 leading-relaxed">
                يمتد فريق إنصات عبر مدن وعواصم عربية متعددة ليوحد الصوت والمعنى
                ويثري المحتوى المعرفي العربي بجهود تطوعية مشتركة.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveInfoModal("volunteers");
                  setMemberSearchQuery("");
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Users size={15} />
                <span>دليل الأعضاء ({metrics.volunteers || 75})</span>
              </button>
            </div>
          </div>

          {/* Countries Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {(metrics.countries && metrics.countries.length > 0
              ? metrics.countries
              : [
                  {
                    name: "العراق",
                    count: 42,
                    members: ["فريق إنصات - العراق"],
                  },
                  { name: "مصر", count: 27, members: ["فريق إنصات - مصر"] },
                  {
                    name: "المغرب",
                    count: 4,
                    members: ["فريق إنصات - المغرب"],
                  },
                  { name: "سوريا", count: 1, members: ["فريق إنصات - سوريا"] },
                  {
                    name: "فلسطين",
                    count: 1,
                    members: ["فريق إنصات - فلسطين"],
                  },
                ]
            ).map((countryItem, idx) => {
              const isSelected = selectedCountryTab === countryItem.name;
              return (
                <div
                  key={idx}
                  onClick={() =>
                    setSelectedCountryTab(isSelected ? "ALL" : countryItem.name)
                  }
                  className={`p-5 rounded-2xl border transition-all duration-200 cursor-pointer text-right flex flex-col justify-between group ${
                    isSelected
                      ? "bg-amber-500/10 border-amber-400 shadow-lg shadow-amber-500/5 ring-1 ring-amber-400"
                      : "bg-[#111728]/90 border-white/[0.08] hover:border-amber-400/40 hover:-translate-y-1"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">
                          {getCountryFlag(countryItem.name)}
                        </span>
                        <h3 className="text-base font-black text-white group-hover:text-amber-300 transition">
                          {countryItem.name}
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                        {countryItem.count} متطوع
                      </span>
                    </div>

                    {/* Member chips preview */}
                    {countryItem.members && countryItem.members.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/[0.06]">
                        {countryItem.members.slice(0, 6).map((m, mIdx) => (
                          <span
                            key={mIdx}
                            className="bg-slate-900/90 text-slate-300 text-[11px] px-2 py-0.5 rounded-lg border border-slate-700/60 font-medium"
                          >
                            {m}
                          </span>
                        ))}
                        {countryItem.members.length > 6 && (
                          <span className="text-[10px] text-amber-400 font-bold self-center">
                            +{countryItem.members.length - 6} آخرين
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-white/[0.04]">
                    <span>انقر لتصفية أعضاء {countryItem.name}</span>
                    <span className="text-amber-400 font-bold group-hover:translate-x-[-2px] transition">
                      {isSelected ? "إلغاء التصفية ✕" : "عرض الأعضاء ←"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Members Showcase Box */}
          <div className="p-6 rounded-3xl bg-[#111728]/80 border border-white/[0.08] shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06] mb-5">
              <div>
                <h4 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>
                    {selectedCountryTab === "ALL"
                      ? `أعضاء فريق إنصات المعتمدون (${metrics.memberNames?.length || metrics.volunteers || 75} عضواً)`
                      : `أعضاء إنصات في ${selectedCountryTab}`}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  نخبة من الرواة، مهندسي الصوت، والمدققين اللغويين الملتزمين
                  بصناعة الأثر
                </p>
              </div>

              {selectedCountryTab !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setSelectedCountryTab("ALL")}
                  className="text-xs text-amber-400 hover:text-amber-300 underline self-start sm:self-auto cursor-pointer"
                >
                  عرض جميع الدول
                </button>
              )}
            </div>

            {/* Member badges flow */}
            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto pr-1">
              {(selectedCountryTab === "ALL"
                ? metrics.memberNames && metrics.memberNames.length > 0
                  ? metrics.memberNames
                  : [
                      "جنى عماد عليان",
                      "منى محمد",
                      "مهدي احمد",
                      "نور تمّام مهدي",
                      "نادين سناح",
                      "Manar Ammar Ayyed",
                      "Sarah Mohammed Ghanawi",
                      "Yousif Bassam Hamid",
                      "ادريس حميد",
                      "اريج احمد رجب عبد الكافي",
                    ]
                : metrics.countries?.find((c) => c.name === selectedCountryTab)
                    ?.members || []
              ).map((name, i) => (
                <span
                  key={i}
                  className="bg-slate-900/90 text-amber-200 border border-slate-700/80 text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 shadow-sm hover:border-amber-400/50 hover:bg-slate-800 transition"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                  <span>{name}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FOUR PILLARS & COMPREHENSIVE MISSION SECTION */}
      <section
        id="pillars"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-[#090e1b] relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-12">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 tracking-wider">
                  رسالة إنصات الشاملة
                </span>
                {isInlineEditing && canEditCms && (
                  <button
                    type="button"
                    onClick={() => handleOpenTextEditor("pillars")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    <Edit3 size={12} />
                    <span>تعديل محاور ورسالة العمل</span>
                  </button>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
                {cmsContent.pillars?.title ||
                  "محاور ورسالة إنصات: أبعد من مجرد إنتاج صوتي"}
              </h2>
              <p className="text-sm text-slate-300 mt-2 max-w-3xl leading-relaxed">
                {cmsContent.pillars?.subtitle ||
                  "حراك ثقافي شبابي عربي متكامل يجمع بين رصانة المعرفة، الحوار الإنساني، وبناء مجتمع معرفي عابر للحدود الجغرافية."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsVolunteerModalOpen(true)}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <span>شارك في مساراتنا التطوعية</span>
              <ArrowLeft size={16} />
            </button>
          </div>

          {/* 4 Pillars Cards Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(
              cmsContent.pillars?.items ||
              DEFAULT_CMS_CONTENT.pillars?.items ||
              []
            ).map((pillar, idx) => {
              const icons = [
                <Mic key="0" className="text-amber-400" size={24} />,
                <Radio key="1" className="text-indigo-400" size={24} />,
                <Users key="2" className="text-emerald-400" size={24} />,
                <HeartHandshake key="3" className="text-amber-400" size={24} />,
              ];
              const borderColors = [
                "group-hover:border-amber-400/50",
                "group-hover:border-indigo-400/50",
                "group-hover:border-emerald-400/50",
                "group-hover:border-amber-400/50",
              ];
              const iconBg = [
                "bg-amber-500/10 border-amber-500/20 text-amber-300",
                "bg-indigo-500/10 border-indigo-500/20 text-indigo-300",
                "bg-emerald-500/10 border-emerald-500/20 text-emerald-300",
                "bg-amber-500/10 border-amber-500/20 text-amber-300",
              ];

              return (
                <motion.div
                  key={pillar.id || idx}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{
                    duration: 0.35,
                    delay: idx * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`p-6 rounded-3xl bg-[#111728] border border-white/[0.08] flex flex-col justify-between group transition-all duration-300 hover:-translate-y-1.5 shadow-xl ${borderColors[idx % 4]}`}
                >
                  <div className="space-y-4">
                    {/* Visual Card Image if provided */}
                    {pillar.image && (
                      <div className="h-36 w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/[0.06] relative">
                        <img
                          src={pillar.image}
                          alt={pillar.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {isInlineEditing && canEditCms && (
                          <button
                            type="button"
                            onClick={() => handleOpenTextEditor("pillars")}
                            className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg bg-slate-950/80 text-white text-[10px] font-bold border border-white/20 transition flex items-center gap-1 shadow cursor-pointer"
                          >
                            <Camera size={11} />
                            <span>تعديل</span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${iconBg[idx % 4]}`}
                      >
                        {icons[idx % 4]}
                      </div>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-slate-300 font-bold">
                        {pillar.badge || `المحور ${idx + 1}`}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                        {pillar.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mt-2">
                        {pillar.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-5 mt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
                    <span className="font-mono text-[11px] text-amber-400/90 font-bold">
                      محور رئيسي
                    </span>
                    <span className="text-amber-400 group-hover:translate-x-[-4px] transition-transform">
                      ←
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* ACTIVITIES & INITIATIVES HUB (ملتقى الفعاليات والمبادرات الكبرى) */}
      {/* ========================================================================= */}
      <section
        id="events"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-[#0b101d] relative overflow-hidden"
      >
        {/* Anchor targets for backward compatibility */}
        <div id="youth-manifesto" className="sr-only" aria-hidden="true" />
        <div id="activities" className="sr-only" aria-hidden="true" />

        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -right-24 top-1/4 w-96 h-96 bg-amber-500/[0.07] rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-1/4 w-96 h-96 bg-sky-500/[0.05] rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-12">
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-white/[0.06]">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-3 max-w-2xl"
            >
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 shadow-sm">
                  <Sparkles size={13} />
                  <span>الفعاليات والمبادرات الثقافية</span>
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  مساحات حية للتفكير المشترك والإنتاج المعرفي
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight">
                ملتقى الفعاليات والمبادرات
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                من المبادرات الفكرية الكبرى كـ «بيان الشباب العربي للثقافة
                والعلوم» إلى ورش العمل والندوات وحلقات النقاش؛ منصة تفاعلية
                متجددة تتيح لك استعراض ومتابعة كافة أنشطة إنصات والمشاركة فيها.
              </p>
            </motion.div>

            {/* Quick Stats and Add Button */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.35,
                delay: 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-wrap items-center gap-3 shrink-0"
            >
              <div className="flex items-center gap-2 bg-slate-900/80 border border-white/[0.08] px-3.5 py-2 rounded-2xl text-xs text-slate-300">
                <Calendar size={14} className="text-amber-400" />
                <span>
                  إجمالي الفعاليات:{" "}
                  <b className="text-amber-300 font-mono">
                    {activityItems.length}
                  </b>
                </span>
              </div>

              {(isInlineEditing || canEditCms) && (
                <button
                  type="button"
                  onClick={() => {
                    setActivityToEdit(null);
                    setIsActivityEditorOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs sm:text-sm font-black transition flex items-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer hover:-translate-y-0.5"
                >
                  <Plus size={16} />
                  <span>إضافة فعالية جديدة</span>
                </button>
              )}
            </motion.div>
          </div>

          {/* INTERACTIVE ACTIVITIES NAVIGATOR BAR (WHEN MORE THAN 1 ACTIVITY) */}
          {activityItems.length > 1 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0d1424]/90 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-amber-500/25 shadow-xl">
              {/* Activities Horizontal Switcher Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-1">
                <span className="text-xs text-amber-400 font-bold px-2 flex items-center gap-1.5 shrink-0">
                  <Sparkles size={13} />
                  <span>تبديل الفعالية:</span>
                </span>
                {activityItems.map((act, idx) => {
                  const isActive = act.id === activeSpotlightActivity?.id;
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => switchSpotlightActivity(act.id)}
                      className={`relative px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 flex items-center gap-2 cursor-pointer shrink-0 select-none ${
                        isActive
                          ? "text-slate-950 font-black"
                          : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-spotlight-pill"
                          className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-300 rounded-xl shadow-md shadow-amber-400/30"
                          transition={{
                            type: "spring",
                            stiffness: 450,
                            damping: 32,
                          }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1.5">
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
                            isActive
                              ? "bg-slate-950 text-amber-300"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="max-w-[150px] truncate">
                          {act.title}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Prev / Next controls & counter */}
              <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 border-t sm:border-t-0 sm:border-r border-white/[0.08] pt-2 sm:pt-0 sm:pr-3">
                <span className="text-[11px] text-slate-400 font-mono">
                  {activityItems.findIndex(
                    (a) => a.id === activeSpotlightActivity?.id,
                  ) + 1}{" "}
                  من {activityItems.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevSpotlight}
                    title="الفعالية السابقة (يمين)"
                    className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-amber-400 hover:text-slate-950 text-slate-300 border border-white/[0.08] transition cursor-pointer active:scale-95"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextSpotlight}
                    title="الفعالية التالية (يسار)"
                    className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-amber-400 hover:text-slate-950 text-slate-300 border border-white/[0.08] transition cursor-pointer active:scale-95"
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SPOTLIGHT HERO CARD: Displays the currently selected or featured activity with professional animations */}
          <div className="relative min-h-[420px]">
            <AnimatePresence mode="wait" custom={spotlightDirection}>
              {activeSpotlightActivity && (
                <motion.div
                  key={activeSpotlightActivity.id}
                  custom={spotlightDirection}
                  variants={spotlightVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="rounded-3xl bg-gradient-to-br from-[#141c33] via-[#0e1424] to-[#080c16] border border-amber-500/30 p-6 sm:p-8 lg:p-10 shadow-2xl relative overflow-hidden"
                >
                  {/* Management action buttons on spotlight */}
                  {(isInlineEditing || canEditCms) && (
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActivityToEdit(activeSpotlightActivity);
                          setIsActivityEditorOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md hover:bg-amber-400 cursor-pointer"
                      >
                        <Edit3 size={13} />
                        <span>تعديل هذه الفعالية</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActivityToDelete(activeSpotlightActivity)
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white text-xs font-bold border border-rose-500/30 transition flex items-center gap-1 shadow cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    </div>
                  )}

                  <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                    {/* Left Content Column */}
                    <div className="lg:col-span-7 space-y-6">
                      {/* Category, Status & Mode Tags */}
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1.5">
                          <Sparkles size={12} />
                          <span>
                            {activeSpotlightActivity.category ||
                              "حراك ومبادرة فكرية"}
                          </span>
                        </span>

                        <span
                          className={`px-3 py-1 rounded-full font-bold border ${
                            activeSpotlightActivity.status === "ONGOING"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : activeSpotlightActivity.status === "UPCOMING"
                                ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {activeSpotlightActivity.status === "ONGOING"
                            ? "فعالية جارية الآن"
                            : activeSpotlightActivity.status === "UPCOMING"
                              ? "فعالية قادمة"
                              : "فعالية منجزة وموثقة"}
                        </span>

                        <span className="px-2.5 py-1 rounded-full bg-white/[0.05] text-slate-300 border border-white/[0.08] font-medium">
                          النمط:{" "}
                          {activeSpotlightActivity.mode === "ONLINE"
                            ? "عن بُعد"
                            : activeSpotlightActivity.mode === "HYBRID"
                              ? "مدمج (حضوري وعن بعد)"
                              : "حضوري"}
                        </span>

                        <span className="text-[11px] text-amber-400/80 font-mono bg-amber-500/5 px-2 py-0.5 rounded-lg border border-amber-500/15">
                          الفعالية في الصدارة ★
                        </span>
                      </div>

                      {/* Title & Subtitle */}
                      <div>
                        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-snug">
                          {activeSpotlightActivity.title}
                        </h3>
                        <p className="text-sm sm:text-base text-amber-200/90 font-medium mt-2 leading-relaxed">
                          {activeSpotlightActivity.shortDescription}
                        </p>
                      </div>

                      {/* Metadata Chips */}
                      <div className="flex flex-wrap gap-4 text-xs text-slate-300 pt-1">
                        {activeSpotlightActivity.startDate && (
                          <div className="flex items-center gap-1.5 bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                            <Calendar size={14} className="text-amber-400" />
                            <span>{activeSpotlightActivity.startDate}</span>
                          </div>
                        )}
                        {activeSpotlightActivity.location && (
                          <div className="flex items-center gap-1.5 bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                            <MapPin size={14} className="text-amber-400" />
                            <span>{activeSpotlightActivity.location}</span>
                          </div>
                        )}
                        {activeSpotlightActivity.organizers &&
                          activeSpotlightActivity.organizers.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/[0.06]">
                              <Users size={14} className="text-amber-400" />
                              <span>
                                الجهة المنظمة:{" "}
                                {activeSpotlightActivity.organizers.join("، ")}
                              </span>
                            </div>
                          )}
                      </div>

                      {/* Document Points or Key Highlights */}
                      {activeSpotlightActivity.id === "act-youth-manifesto" ? (
                        <div className="space-y-2.5 pt-1">
                          <span className="text-xs font-bold text-slate-200 block">
                            محاور وأهداف وثيقة بيان الشباب العربي:
                          </span>
                          <div className="grid sm:grid-cols-2 gap-2.5">
                            {(
                              cmsContent.youthManifesto?.documentPoints ||
                              DEFAULT_CMS_CONTENT.youthManifesto
                                ?.documentPoints ||
                              []
                            ).map((point, pIdx) => (
                              <div
                                key={pIdx}
                                className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed"
                              >
                                <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {pIdx + 1}
                                </span>
                                <span>{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-xs sm:text-sm text-slate-300 leading-relaxed space-y-2">
                          <span className="text-xs font-bold text-amber-300 block">
                            نبذة تفصيلية عن الفعالية:
                          </span>
                          <p className="line-clamp-4">
                            {activeSpotlightActivity.fullDescription ||
                              activeSpotlightActivity.shortDescription}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap items-center gap-3.5 pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedActivity(activeSpotlightActivity)
                          }
                          className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 transition shadow-lg shadow-amber-400/20 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        >
                          <FileBadge2 size={17} />
                          <span>قراءة تفاصيل الفعالية كاملة</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => scrollTo("contact")}
                          className="px-5 py-3 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer"
                        >
                          <Users size={16} />
                          <span>الانضمام أو الاستفسار</span>
                        </button>
                      </div>
                    </div>

                    {/* Right Visual Panel */}
                    <div className="lg:col-span-5">
                      <div className="relative rounded-3xl overflow-hidden border border-white/[0.12] shadow-2xl group bg-slate-900">
                        <div className="h-80 sm:h-96 w-full overflow-hidden relative">
                          <AnimatePresence mode="wait">
                            <motion.img
                              key={
                                activeSpotlightActivity.coverImage ||
                                activeSpotlightActivity.id
                              }
                              src={
                                activeSpotlightActivity.coverImage ||
                                (activeSpotlightActivity.id ===
                                  "act-youth-manifesto" &&
                                  cmsContent.images?.youthManifesto) ||
                                "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1000&q=80"
                              }
                              alt={activeSpotlightActivity.title}
                              initial={{ opacity: 0.3, scale: 1.06 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0.3 }}
                              transition={{
                                duration: 0.4,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                          </AnimatePresence>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-[#090d18] via-[#090d18]/40 to-transparent flex flex-col justify-end p-6">
                          <span className="text-xs font-bold text-amber-400">
                            {activeSpotlightActivity.category ||
                              "فعالية ومبادرة ثقافية"}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-1">
                            {activeSpotlightActivity.title}
                          </h4>
                          <p className="text-[11px] text-slate-300 mt-1">
                            {activeSpotlightActivity.location || "منصة إنصات"} •{" "}
                            {activeSpotlightActivity.startDate || "مستمرة"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ALL ACTIVITIES GRID & SWITCHER */}
          <div className="space-y-6 pt-4">
            {/* Filter & Search Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-3xl border border-white/[0.06]">
              {/* Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none text-xs">
                <span className="text-slate-400 font-bold ml-1 flex items-center gap-1 shrink-0">
                  <Filter size={13} />
                  <span>التصنيف:</span>
                </span>
                {[
                  { key: "ALL", label: "الكل" },
                  { key: "CULTURAL_SESSION", label: "جلسات فكرية وثقافية" },
                  { key: "WORKSHOP", label: "ورش تدريبية" },
                  { key: "BOOK_CLUB", label: "أندية قراءة" },
                  { key: "WEBINAR", label: "ندوات وملتقيات" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActivityCategoryFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer ${
                      activityCategoryFilter === tab.key
                        ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                        : "bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative min-w-[220px]">
                <Search
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={activitySearchQuery}
                  onChange={(e) => setActivitySearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الموضوع..."
                  className="w-full bg-slate-950 border border-white/[0.1] rounded-xl pr-9 pl-8 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                />
                {activitySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setActivitySearchQuery("")}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Activities Cards Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredActivities.map((act) => {
                const isSpotlighted = act.id === activeSpotlightActivity?.id;
                return (
                  <div
                    key={act.id}
                    onClick={() => switchSpotlightActivity(act.id, true)}
                    className={`group rounded-3xl border transition-all duration-300 flex flex-col justify-between p-6 shadow-xl relative cursor-pointer ${
                      isSpotlighted
                        ? "bg-[#141b2f] border-amber-400/80 ring-2 ring-amber-400/40 shadow-amber-500/10 scale-[1.01]"
                        : "bg-[#0f1424] border-white/[0.08] hover:bg-[#13192c] hover:border-amber-400/50 hover:-translate-y-1"
                    }`}
                  >
                    {/* Management buttons on card */}
                    {(isInlineEditing || canEditCms) && (
                      <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-white/10 opacity-90 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          title="تعديل الفعالية"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityToEdit(act);
                            setIsActivityEditorOpen(true);
                          }}
                          className="p-1.5 text-amber-400 hover:bg-amber-400/20 rounded-lg transition cursor-pointer"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          title="حذف الفعالية"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActivityToDelete(act);
                          }}
                          className="p-1.5 text-rose-400 hover:bg-rose-400/20 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}

                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            act.status === "UPCOMING"
                              ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                              : act.status === "ONGOING"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {act.status === "UPCOMING"
                            ? "قادمة"
                            : act.status === "ONGOING"
                              ? "جارية"
                              : "مكتملة"}
                        </span>

                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Calendar size={12} className="text-amber-400/80" />
                          <span>{act.startDate}</span>
                        </span>
                      </div>

                      {/* Card Title */}
                      <h4 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {act.title}
                      </h4>

                      {/* Excerpt */}
                      <p className="text-xs text-slate-300 leading-relaxed mt-2 line-clamp-3">
                        {act.shortDescription}
                      </p>
                    </div>

                    {/* Footer Controls */}
                    <div className="mt-5 pt-4 border-t border-white/[0.08] flex items-center justify-between text-xs gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          switchSpotlightActivity(act.id, true);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer ${
                          isSpotlighted
                            ? "bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/30"
                            : "bg-white/[0.05] text-slate-300 hover:bg-amber-400/20 hover:text-amber-300"
                        }`}
                      >
                        <Sparkles size={12} />
                        <span>
                          {isSpotlighted ? "المعروضة بالأعلى ★" : "عرض بالأعلى"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedActivity(act);
                        }}
                        className="text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>التفاصيل الكاملة</span>
                        <span>←</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Add New Activity Card for Editors */}
              {(isInlineEditing || canEditCms) && (
                <div
                  onClick={() => {
                    setActivityToEdit(null);
                    setIsActivityEditorOpen(true);
                  }}
                  className="rounded-3xl border-2 border-dashed border-amber-500/30 hover:border-amber-400/70 bg-amber-500/[0.02] hover:bg-amber-500/[0.06] p-6 flex flex-col items-center justify-center text-center gap-3 transition-all cursor-pointer min-h-[220px]"
                >
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">
                      إضافة فعالية أو مبادرة جديدة
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      أضف ندوة، ورشة عمل، حراك ثقافي أو لقاء قرائي جديد
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* AUDIO LIBRARY SECTION */}
      <section
        id="library"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-[#090d16] relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isInlineEditing && canEditCms && (
            <div className="absolute top-6 left-6 z-10">
              <button
                type="button"
                onClick={() => {
                  setLibraryToEdit(null);
                  setIsLibraryEditorOpen(true);
                }}
                className="px-4 py-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg shadow-amber-500/10 cursor-pointer"
              >
                <Plus size={16} />
                إضافة تسجيل جديد
              </button>
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-end justify-between gap-4 mb-10"
          >
            <div>
              <span className="text-xs font-bold text-amber-400 tracking-wider">
                المكتبة الصوتية
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
                إنتاجات تبدأ من الكتاب وتصل إلى أذنك
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                استمع إلى مختارات من الكتب والتسجيلات المعتمدة من فريق التدقيق
                والهندسة الصوتية.
              </p>
            </div>

            <button
              type="button"
              onClick={onOpenWorkspace}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-all duration-150 hover:-translate-x-1 cursor-pointer"
            >
              <span>دخول منصة الإنتاج للأعضاء</span>
              <ArrowLeft size={16} />
            </button>
          </motion.div>

          {/* Search & Topic Filters */}
          <div className="space-y-4 mb-8">
            <div className="relative">
              <Search
                size={18}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="ابحث بالعنوان، أو اسم الكاتب، أو الراوي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-11 pl-4 py-3.5 bg-[#111728] border border-white/[0.08] focus:border-amber-400/60 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none transition-all shadow-inner"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <button
                type="button"
                onClick={() => setSelectedTopic("all")}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                  selectedTopic === "all"
                    ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 scale-105"
                    : "bg-[#111728] text-slate-300 hover:text-white border border-white/[0.08] hover:border-amber-400/30"
                }`}
              >
                جميع التصنيفات
              </button>
              {topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTopic(t.name)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-150 whitespace-nowrap cursor-pointer ${
                    selectedTopic === t.name
                      ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 scale-105"
                      : "bg-[#111728] text-slate-300 hover:text-white border border-white/[0.08] hover:border-amber-400/30"
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {/* Audio Grid with Animated Cards */}
          {filteredLibrary.length === 0 ? (
            <div className="text-center py-16 bg-[#111728]/50 rounded-3xl border border-white/[0.06]">
              <Headphones size={36} className="mx-auto text-slate-500 mb-3" />
              <h3 className="text-base font-bold text-slate-300">
                لا توجد تسجيلات مطابقة للبحث
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                جرب تغيير كلمات البحث أو التصنيف.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLibrary.map((item, idx) => {
                const isPlaying = currentPlayingItem?.id === item.id;
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-30px" }}
                    transition={{
                      duration: 0.32,
                      delay: Math.min(idx * 0.05, 0.25),
                      ease: [0.22, 1, 0.36, 1] as const,
                    }}
                    className={`rounded-3xl border transition-all duration-200 p-6 flex flex-col justify-between group hover:-translate-y-1.5 shadow-lg ${
                      isPlaying
                        ? "border-amber-400/70 bg-[#161f36] shadow-xl shadow-amber-500/10 ring-1 ring-amber-400/30"
                        : "border-white/[0.08] bg-[#111728] hover:border-amber-400/40 hover:bg-[#141c30]"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                            {item.category || "أدب وفكر"}
                          </span>
                          {isInlineEditing && canEditCms && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLibraryToEdit(item);
                                setIsLibraryEditorOpen(true);
                              }}
                              className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition flex items-center gap-1 cursor-pointer"
                            >
                              تعديل
                            </button>
                          )}
                        </div>
                        {item.durationSeconds > 0 && (
                          <span className="text-[11px] text-slate-400 font-mono">
                            {Math.floor(item.durationSeconds / 60)}:
                            {(item.durationSeconds % 60)
                              .toString()
                              .padStart(2, "0")}{" "}
                            د
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                      {item.authorName && (
                        <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                          المؤلف: {item.authorName}
                        </p>
                      )}

                      <p className="text-xs text-slate-300 leading-relaxed mt-3 line-clamp-3">
                        {item.shortDescription ||
                          "تسجيل صوتي محقق وفق معايير إنصات للإنتاج الثقافي."}
                      </p>

                      <div className="mt-4 pt-3 border-t border-white/[0.06] text-[11px] text-slate-400 space-y-1">
                        {item.narratorName && (
                          <div>
                            بصوت:{" "}
                            <span className="text-slate-200 font-medium">
                              {item.narratorName}
                            </span>
                          </div>
                        )}
                        {item.audioEngineerName && (
                          <div>
                            هندسة:{" "}
                            <span className="text-slate-200 font-medium">
                              {item.audioEngineerName}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3">
                      <button
                        type="button"
                        onClick={() => setCurrentPlayingItem(item)}
                        className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                          isPlaying
                            ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 scale-[1.02]"
                            : "bg-white/[0.08] hover:bg-amber-400 hover:text-slate-950 text-white hover:shadow-lg hover:shadow-amber-500/20"
                        }`}
                      >
                        <Play size={14} fill="currentColor" />
                        <span>{isPlaying ? "قيد التشغيل الآن" : "استماع"}</span>
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* JOURNEY & PRODUCTION PIPELINE SECTION with Authentic Visuals */}
      <section
        id="journey"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-[#090d16]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="text-center max-w-2xl mx-auto mb-16"
          >
            <span className="text-xs font-bold text-amber-400 tracking-wider">
              رحلة الإنتاج ومعايير الجودة
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-2">
              كيف يولد الكتاب الصوتي في إنصات؟
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              مسار احترافي محكم يضمن سلامة النص العربي ودقة الهندسة الصوتية قبل
              أي نشر عام.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                title: "انتقاء المادة وتجهيزها",
                desc: "اختيار الكتب والمقالات الرصينة، وضبط علامات الترقيم وتشكيل النص للتيسير على الراوي.",
                icon: <BookOpen className="text-amber-400" size={22} />,
                image:
                  cmsContent.images?.journeyStage1 ||
                  "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=500&q=80",
                badge: "إعداد وتحقيق النص",
              },
              {
                step: "02",
                title: "التسجيل الصوتي الخام",
                desc: "تسجيل فصول الكتاب بأصوات مدربة وفق مواصفات عزل وميكروفونات احترافية.",
                icon: <Mic className="text-amber-400" size={22} />,
                image:
                  cmsContent.images?.journeyStage2 ||
                  "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=500&q=80",
                badge: "أداء استوديوهات معزولة",
              },
              {
                step: "03",
                title: "الهندسة الصوتية والمونتاج",
                desc: "تنقية التشويش، موازنة مستويات الصوت (LUFS)، وإضافة الفواصل الموسيقية المعتمدة.",
                icon: <Volume2 className="text-amber-400" size={22} />,
                image:
                  cmsContent.images?.journeyStage3 ||
                  "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=500&q=80",
                badge: "ماسترينغ إذاعي Broadcast",
              },
              {
                step: "04",
                title: "التدقيق اللغوي والاعتماد",
                desc: "مراجعة شاملة لصحة الأداء والنطق والماسترينغ النهائي قبل النشر والأرشفة في Google Drive.",
                icon: <CheckCircle2 className="text-amber-400" size={22} />,
                image:
                  cmsContent.images?.journeyStage4 ||
                  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80",
                badge: "اعتماد وأرشفة دائمة",
              },
            ].map((stage, idx) => (
              <motion.div
                key={stage.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{
                  duration: 0.32,
                  delay: Math.min(idx * 0.06, 0.25),
                  ease: [0.22, 1, 0.36, 1] as const,
                }}
                className="rounded-3xl border border-white/[0.08] bg-[#111728] overflow-hidden hover:border-amber-400/40 hover:-translate-y-1.5 transition-all duration-200 shadow-lg flex flex-col justify-between group"
              >
                {/* Visual Thumbnail */}
                <div className="h-36 w-full relative overflow-hidden">
                  <img
                    src={stage.image}
                    alt={stage.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111728] via-[#111728]/40 to-transparent" />
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-amber-300 border border-white/10">
                    {stage.badge}
                  </span>
                  <span className="absolute bottom-2 left-3 text-2xl font-black text-amber-400/40 group-hover:text-amber-400/80 transition-colors">
                    {stage.step}
                  </span>
                </div>

                <div className="p-6 pt-2 space-y-2.5 grow flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/10 flex items-center justify-center -mt-6 relative z-10 border border-amber-400/20 shadow-md">
                      {stage.icon}
                    </div>
                    <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                      {stage.title}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {stage.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* VOLUNTEER CTA SECTION */}
      <section
        id="join"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-gradient-to-b from-[#0c111d] to-[#090c15] relative"
      >
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-3xl bg-amber-400/15 text-amber-300 mx-auto flex items-center justify-center shadow-xl shadow-amber-400/10 border border-amber-400/25">
            <HeartHandshake size={32} />
          </div>

          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            صوتك أو مهاراتك قد تُحدث فارقاً في وعي مستمع
          </h2>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
            سواء كنت تمتلك خامة صوتية دافئة، أو خبرة في المونتاج والهندسة
            الصوتية، أو شغفاً بالتدقيق اللغوي وتنسيق الأنشطة؛ نرحب بانضمامك إلى
            أسرة إنصات.
          </p>

          <div className="pt-4 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setIsVolunteerModalOpen(true)}
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm flex items-center gap-2.5 transition-all duration-200 shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              <Send size={16} />
              <span>تقديم طلب تطوع الآن</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPinModalOpen(true)}
              className="px-7 py-4 rounded-2xl border border-slate-700/80 hover:border-amber-400/50 bg-slate-900/60 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-sm flex items-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 backdrop-blur-sm cursor-pointer"
            >
              <KeyRound size={16} className="text-amber-400" />
              <span>لديك كود تفعيل أو حساب سابق؟ فعّله هنا</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 pt-2">
            * يتم فحص ومراجعة جميع الطلبات بعناية من قِبل إدارة المبادرة،
            والتواصل مع المقبولين لإتمام إجراءات التفعيل.
          </p>
        </motion.div>
      </section>

      {/* PROMINENT OFFICIAL CONTACT SECTION */}
      <section
        id="contact"
        className="py-20 md:py-28 border-b border-white/[0.08] bg-[#070b14] relative"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-14">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-400 tracking-wider">
                  قنوات التواصل والمتابعة
                </span>
                {isInlineEditing && canEditCms && (
                  <button
                    type="button"
                    onClick={() => handleOpenTextEditor("contact")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold hover:bg-amber-500/30 transition cursor-pointer"
                  >
                    <Edit3 size={12} />
                    <span>تعديل بيانات التواصل الرسمي</span>
                  </button>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-white mt-1">
                {cmsContent.contactTitle ||
                  "تواصل مع إدارة إنصات والقنوات الرسمية"}
              </h2>
              <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
                {cmsContent.contactDescription ||
                  "تسعد إدارة المنصة باستقبال استفساراتكم، مقترحات الكتب والمشاريع، طلبات الشراكة الثقافية والمؤسسية، وتنسيق تفعيل الحسابات الموحدة."}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 bg-white/[0.04] border border-white/[0.08] px-3.5 py-2 rounded-2xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>فريق التواصل متاح للرد خلال 24 ساعة</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Direct Official Channels Column (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Email Card */}
              <div className="p-6 rounded-3xl bg-[#0e1424] border border-white/[0.08] hover:border-amber-400/40 transition-all duration-300 shadow-xl group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0">
                    <Mail size={22} />
                  </div>
                  <div className="grow">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      البريد الإلكتروني المعتمد
                    </span>
                    <a
                      href={`mailto:${cmsContent.contactEmail || "contact@ensat.org"}`}
                      className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 transition-colors block mt-0.5 break-all"
                    >
                      {cmsContent.contactEmail || "contact@ensat.org"}
                    </a>
                    <p className="text-xs text-slate-400 mt-1">
                      للمراسلات الرسمية والشراكات ومقترحات الأعمال الصوتية
                    </p>

                    <div className="flex items-center gap-2.5 mt-4">
                      <button
                        type="button"
                        onClick={() => {
                          const email =
                            cmsContent.contactEmail || "contact@ensat.org";
                          navigator.clipboard.writeText(email);
                          setEmailCopied(true);
                          setTimeout(() => setEmailCopied(false), 2500);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-bold border border-white/[0.1] transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {emailCopied ? (
                          <>
                            <CheckCircle2
                              size={13}
                              className="text-emerald-400"
                            />
                            <span className="text-emerald-300">
                              تم نسخ البريد
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>نسخ البريد</span>
                          </>
                        )}
                      </button>

                      <a
                        href={`mailto:${cmsContent.contactEmail || "contact@ensat.org"}`}
                        className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-400/20"
                      >
                        <Send size={13} />
                        <span>إرسال بريد الآن</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone & WhatsApp Card */}
              <div className="p-6 rounded-3xl bg-[#0e1424] border border-white/[0.08] hover:border-emerald-400/40 transition-all duration-300 shadow-xl group">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
                    <Phone size={22} />
                  </div>
                  <div className="grow">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                      الهاتف وواتساب المباشر
                    </span>
                    <a
                      href={`tel:${cmsContent.contactPhone || "+96522000000"}`}
                      dir="ltr"
                      className="text-base sm:text-lg font-bold text-white group-hover:text-emerald-300 transition-colors block mt-0.5 font-mono text-right"
                    >
                      {cmsContent.contactPhone || "+965 2200 0000"}
                    </a>
                    <p className="text-xs text-slate-400 mt-1">
                      خدمة الاستفسارات وتنسيق التسجيلات عن بُعد
                    </p>

                    <div className="flex items-center gap-2.5 mt-4">
                      <a
                        href={`https://wa.me/${(cmsContent.contactPhone || "96522000000").replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                      >
                        <MessageSquare size={13} />
                        <span>محادثة واتساب فورية</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Channels Card */}
              <div className="p-6 rounded-3xl bg-[#0e1424] border border-white/[0.08] space-y-3 shadow-xl">
                <span className="text-xs font-bold text-slate-300 block">
                  قنوات ومجتمعات إنصات الرقمية
                </span>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <a
                    href={
                      cmsContent.contactTelegram || "https://t.me/ensat_audio"
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-200 hover:text-amber-300 transition flex items-center justify-between group"
                  >
                    <span className="font-bold">قناة تيليجرام</span>
                    <ExternalLink
                      size={13}
                      className="text-slate-500 group-hover:text-amber-400"
                    />
                  </a>
                  <a
                    href={
                      cmsContent.contactTwitter || "https://x.com/ensat_audio"
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-200 hover:text-amber-300 transition flex items-center justify-between group"
                  >
                    <span className="font-bold">منصة X (تويتر)</span>
                    <ExternalLink
                      size={13}
                      className="text-slate-500 group-hover:text-amber-400"
                    />
                  </a>
                </div>
              </div>
            </div>

            {/* Direct Message Form (7 cols) */}
            <div className="lg:col-span-7">
              <div className="p-6 sm:p-8 rounded-3xl bg-[#0e1424] border border-white/[0.08] shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                    <Send size={16} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      إرسال استفسار أو طلب مباشر
                    </h3>
                    <p className="text-xs text-slate-400">
                      يصل إشعار فوري لفريق العمل للرد على رسالتك
                    </p>
                  </div>
                </div>

                {contactFormSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-center space-y-3 py-10"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 className="text-base font-bold text-white">
                      تم استلام رسالتك بنجاح!
                    </h4>
                    <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                      شكراً لتواصلك مع إنصات. سيقوم المشرف المختص بمراجعة رسالتك
                      والتواصل معك عبر البريد أو الهاتف المدخل بأقرب وقت.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setContactFormSubmitted(false);
                        setContactFormData({
                          name: "",
                          emailOrPhone: "",
                          subject: "استفسار عام",
                          message: "",
                        });
                      }}
                      className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-bold transition cursor-pointer"
                    >
                      إرسال رسالة أخرى
                    </button>
                  </motion.div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!contactFormData.name || !contactFormData.message)
                        return;
                      setContactFormSubmitted(true);
                    }}
                    className="space-y-4"
                  >
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          الاسم الكريم *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactFormData.name}
                          onChange={(e) =>
                            setContactFormData({
                              ...contactFormData,
                              name: e.target.value,
                            })
                          }
                          placeholder="مثال: د. عبد الله السالم"
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          البريد الإلكتروني أو رقم الهاتف *
                        </label>
                        <input
                          type="text"
                          required
                          value={contactFormData.emailOrPhone}
                          onChange={(e) =>
                            setContactFormData({
                              ...contactFormData,
                              emailOrPhone: e.target.value,
                            })
                          }
                          placeholder="مثال: name@example.com أو واتساب"
                          className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        موضوع الرسالة
                      </label>
                      <select
                        value={contactFormData.subject}
                        onChange={(e) =>
                          setContactFormData({
                            ...contactFormData,
                            subject: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 rounded-xl bg-[#090d18] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-amber-400 transition"
                      >
                        <option value="استفسار عام">
                          استفسار عام عن المبادرة
                        </option>
                        <option value="اقتراح كتاب أو مشروع صوتي">
                          اقتراح كتاب أو مشروع صوتي
                        </option>
                        <option value="طلب شراكة ثقافية أو مؤسسية">
                          طلب شراكة ثقافية أو مؤسسية
                        </option>
                        <option value="متابعة تفعيل الحساب الموحد">
                          متابعة تفعيل الحساب الموحد
                        </option>
                        <option value="انضمام لبيان الشباب العربي">
                          انضمام لبيان الشباب العربي
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        نص الرسالة أو المقترح *
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={contactFormData.message}
                        onChange={(e) =>
                          setContactFormData({
                            ...contactFormData,
                            message: e.target.value,
                          })
                        }
                        placeholder="اكتب تفاصيل استفسارك أو اقتراحك هنا..."
                        className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 transition resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-400/20 hover:shadow-amber-400/35 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                    >
                      <Send size={16} />
                      <span>إرسال الرسالة إلى إدارة إنصات</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shadow-md">
            <Headphones size={18} />
          </div>
          <span className="text-slate-300 font-bold">
            منصة إنصات للإنتاج الصوتي © {new Date().getFullYear()}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-slate-400">
          {isInlineEditing && (
            <button
              type="button"
              onClick={() => handleOpenTextEditor("terms")}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition flex items-center gap-1 cursor-pointer"
            >
              <Edit3 size={12} />
              <span>تعديل الشروط والخصوصية</span>
            </button>
          )}
          {isInlineEditing && (
            <button
              type="button"
              onClick={() => handleOpenTextEditor("contact")}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/30 transition flex items-center gap-1 cursor-pointer"
            >
              <Edit3 size={12} />
              <span>تعديل بيانات التواصل</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveInfoModal("privacy")}
            className="hover:text-amber-400 transition cursor-pointer"
          >
            الخصوصية والأمان
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal("terms")}
            className="hover:text-amber-400 transition"
          >
            الشروط والأحكام
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal("projects")}
            className="hover:text-amber-400 transition"
          >
            فهرس المشاريع
          </button>
          <button
            type="button"
            onClick={() => setActiveInfoModal("countries")}
            className="hover:text-amber-400 transition"
          >
            الدول المشاركة
          </button>
        </div>
      </footer>

      {/* STICKY AUDIO PLAYER BAR */}
      <AudioPlayerBar
        item={currentPlayingItem}
        onClose={() => setCurrentPlayingItem(null)}
      />

      {/* ACTIVITY DETAIL MODAL */}
      <ActivityDetailModal
        activity={selectedActivity}
        onClose={() => setSelectedActivity(null)}
        canEdit={isInlineEditing && canEditCms}
        onEdit={(act) => {
          setActivityToEdit(act);
          setIsActivityEditorOpen(true);
        }}
      />

      {/* ACTIVITY EDITOR MODAL */}
      <ActivityEditorModal
        isOpen={isActivityEditorOpen}
        activity={activityToEdit}
        onClose={() => setIsActivityEditorOpen(false)}
        onSaved={handleActivitySaved}
        onDeleted={handleActivityDeleted}
      />

      {/* ACTIVITY DELETE CONFIRMATION MODAL */}
      {activityToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/30 p-6 text-white shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white">
                تأكيد حذف الفعالية
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                هل أنت متأكد من حذف فعالية{" "}
                <span className="font-bold text-amber-400">
                  «{activityToDelete.title}»
                </span>
                ؟ سيتم إزالتها نهائياً من الموقع وقاعدة البيانات المحلية.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDeletingActivity}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                {isDeletingActivity ? "جارٍ الحذف..." : "نعم، احذف الفعالية"}
              </button>
              <button
                type="button"
                disabled={isDeletingActivity}
                onClick={() => setActivityToDelete(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIBRARY EDITOR MODAL */}
      <LibraryEditorModal
        isOpen={isLibraryEditorOpen}
        item={libraryToEdit}
        onClose={() => setIsLibraryEditorOpen(false)}
        onSaved={() => fetchSiteData(previewMode)}
        onDeleted={() => fetchSiteData(previewMode)}
      />

      {/* VOLUNTEER FORM MODAL */}
      <VolunteerFormModal
        isOpen={isVolunteerModalOpen}
        onClose={() => setIsVolunteerModalOpen(false)}
        availableForms={volunteerForms}
      />

      {/* ACCOUNT ACTIVATION MODAL (NEW MEMBERS & LEGACY MIGRATION) */}
      <AccountActivationModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        onSuccessLogin={() => {
          setIsPinModalOpen(false);
          onOpenWorkspace();
        }}
      />

      {/* CMS TEXT EDITOR MODAL */}
      <CmsTextEditorModal
        isOpen={isTextEditorOpen}
        initialTab={textEditorInitialTab}
        content={cmsContent}
        onClose={() => setIsTextEditorOpen(false)}
        onSave={(updated) => {
          setCmsContent(updated);
          setIsTextEditorOpen(false);
        }}
      />

      {/* METRIC MODALS (Countries, Projects, Privacy, Terms) */}
      {activeInfoModal && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setActiveInfoModal(null)}
        >
          <div
            className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {activeInfoModal === "countries" &&
                  "الدول العربية والأعضاء المتطوعون"}
                {activeInfoModal === "volunteers" && "الأعضاء المتطوعون"}
                {activeInfoModal === "projects" && "قائمة مشاريع الكتب الصوتية"}
                {activeInfoModal === "privacy" &&
                  "سياسة الخصوصية وحماية البيانات"}
                {activeInfoModal === "terms" && "الشروط والأحكام ومعايير العمل"}
              </h3>
              <button
                type="button"
                onClick={() => setActiveInfoModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto space-y-3 text-xs leading-relaxed">
              {activeInfoModal === "volunteers" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-wrap gap-2">
                    <p className="text-slate-300 font-bold text-sm">
                      الأعضاء الموحدون في منصة إنصات (
                      {metrics.memberNames?.length || metrics.volunteers} عضو):
                    </p>
                    <span className="text-xs text-amber-400 font-mono bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-bold">
                      {metrics.memberNames?.length || metrics.volunteers} عضو
                      ومشارك
                    </span>
                  </div>

                  {metrics.memberNames && metrics.memberNames.length > 8 && (
                    <div className="relative">
                      <input
                        type="text"
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        placeholder="ابحث عن اسم عضو..."
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1 max-h-72 overflow-y-auto pr-1">
                    {metrics.memberNames?.length ? (
                      metrics.memberNames
                        .filter(
                          (name) =>
                            !memberSearchQuery.trim() ||
                            (name &&
                              name
                                .toLowerCase()
                                .includes(
                                  memberSearchQuery.trim().toLowerCase(),
                                )),
                        )
                        .map((name, i) => (
                          <span
                            key={i}
                            className="bg-slate-900/90 text-amber-200 border border-slate-700/80 text-xs px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-sm hover:border-amber-400/40 transition"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                            {name}
                          </span>
                        ))
                    ) : (
                      <div className="text-slate-400 p-4 text-center w-full">
                        يضم فريق إنصات أكثر من {metrics.volunteers} عضواً
                        ومشاركاً معتمداً.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {activeInfoModal === "countries" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <p className="text-slate-400 font-bold">
                      تضم منصة إنصات متطوعين ومشاركين من (
                      {metrics.countries?.length || 5}) بلدان عربية:
                    </p>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(metrics.countries?.length
                      ? metrics.countries
                      : [
                          {
                            name: "العراق",
                            count: 42,
                            members: ["فريق إنصات - العراق"],
                          },
                          {
                            name: "مصر",
                            count: 27,
                            members: ["فريق إنصات - مصر"],
                          },
                          {
                            name: "المغرب",
                            count: 4,
                            members: ["فريق إنصات - المغرب"],
                          },
                          {
                            name: "سوريا",
                            count: 1,
                            members: ["فريق إنصات - سوريا"],
                          },
                          {
                            name: "فلسطين",
                            count: 1,
                            members: ["فريق إنصات - فلسطين"],
                          },
                        ]
                    ).map((c, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-sm flex items-center gap-2">
                            <span className="text-xl">
                              {getCountryFlag(c.name)}
                            </span>
                            <span>{c.name}</span>
                          </span>
                          <span className="text-amber-400 font-mono font-bold bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 text-xs">
                            {c.count} متطوع
                          </span>
                        </div>
                        {c.members && c.members.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-900">
                            {c.members.map((m, idx) => (
                              <span
                                key={idx}
                                className="bg-slate-800/80 text-slate-300 text-[11px] px-2.5 py-0.5 rounded-lg border border-slate-700/60 font-medium"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeInfoModal === "projects" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <p className="text-slate-400 font-bold">
                      المشاريع والكتب المنجزة أو المعتمدة في منصة إنصات (
                      {metrics.projectsList?.length ||
                        libraryItems.length ||
                        metrics.projects}{" "}
                      كتاب):
                    </p>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(metrics.projectsList && metrics.projectsList.length > 0
                      ? metrics.projectsList
                      : libraryItems.length > 0
                        ? libraryItems
                        : [
                            {
                              id: "b-1",
                              title: "مقدمة ابن خلدون",
                              authorName: "ابن خلدون",
                              category: "الفكر والتاريخ",
                              totalParts: 14,
                              completedParts: 14,
                            },
                            {
                              id: "b-2",
                              title: "طوق الحمامة في الألفة والألاف",
                              authorName: "ابن حزم الأندلسي",
                              category: "الأدب والرواية",
                              totalParts: 10,
                              completedParts: 8,
                            },
                            {
                              id: "b-3",
                              title: "حي بن يقظان",
                              authorName: "ابن طفيل",
                              category: "الفلسفة والأدب",
                              totalParts: 6,
                              completedParts: 6,
                            },
                            {
                              id: "b-4",
                              title: "كليلة ودمنة",
                              authorName: "ابن المقفع",
                              category: "الأدب الكلاسيكي",
                              totalParts: 8,
                              completedParts: 8,
                            },
                          ]
                    ).map((b: any, idx) => (
                      <div
                        key={b.id || idx}
                        className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-white block text-sm">
                            📖 {b.title}
                          </span>
                          {(b.authorName || b.author) && (
                            <span className="text-[11px] text-slate-400">
                              للمؤلف: {b.authorName || b.author}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-amber-400 text-[11px] font-bold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            {b.category || "كتاب صوتي"}
                          </span>
                          {b.totalParts && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {b.completedParts || 0} / {b.totalParts} جزء
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeInfoModal === "privacy" && (
                <div className="space-y-3 text-slate-300 whitespace-pre-line leading-relaxed">
                  {cmsContent.privacyBody ||
                    `تلتزم منصة «إنصات» باحترام خصوصية جميع المتطوعين والزوار، وعدم مشاركة بيانات التواصل الشخصية مع أي طرف ثالث.`}
                </div>
              )}

              {activeInfoModal === "terms" && (
                <div className="space-y-3 text-slate-300 whitespace-pre-line leading-relaxed">
                  {cmsContent.termsBody ||
                    `جميع المواد الصوتية المنتجة في منصة «إنصات» مخصصة للنشر الثقافي والمعرفي غير الربحي.`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
