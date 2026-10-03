import { Headphones, CheckSquare, Coins, ArrowLeft } from "lucide-react";
import { MainTab, ThemeMode, User } from "../types";

export function PlatformHub({
  currentUser,
  theme,
  onOpen,
}: {
  currentUser: User;
  theme: ThemeMode;
  onOpen: (tab: MainTab) => void;
}) {
  const surface =
    theme === "dark"
      ? "border-slate-800 bg-slate-900/80"
      : "border-slate-200 bg-white";
  const cards: {
    tab: MainTab;
    title: string;
    description: string;
    icon: typeof Headphones;
    tone: string;
  }[] = [
    {
      tab: "tasks",
      title: "منصة المهام",
      description: "تابع المهام المسندة إليك وحالة مشاريع إنصات.",
      icon: CheckSquare,
      tone: "text-amber-400",
    },
    {
      tab: "studio",
      title: "منصة التسجيل والإنتاج",
      description: "رفع التسجيلات ومراحل المراجعة والهندسة إلى Google Drive.",
      icon: Headphones,
      tone: "text-indigo-400",
    },
    {
      tab: "rewards",
      title: "منصة النقاط",
      description: "راجع نقاطك وجواهرك وسجل المكافآت.",
      icon: Coins,
      tone: "text-emerald-400",
    },
  ];
  return (
    <section dir="rtl" className="space-y-8">
      <div>
        <p className="text-sm font-bold text-amber-400">مساحة إنصات</p>
        <h1 className="mt-2 text-3xl font-black">
          اختر المنصة التي تريد الدخول إليها
        </h1>
        <p className="mt-3 text-slate-400">
          مرحباً {currentUser.name || "بك"}. كل منصة مستقلة وصلاحياتها تُطبق من
          الخادم.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {cards.map(({ tab, title, description, icon: Icon, tone }) => (
          <button
            key={tab}
            onClick={() => onOpen(tab)}
            disabled={tab === "studio" && !currentUser.can_access_studio}
            className={`group text-right rounded-3xl border p-6 transition hover:-translate-y-1 hover:border-amber-400/60 disabled:cursor-not-allowed disabled:opacity-45 ${surface}`}
          >
            <Icon className={tone} size={34} />
            <h2 className="mt-7 text-xl font-black">{title}</h2>
            <p className="mt-3 min-h-14 text-sm leading-7 text-slate-400">
              {description}
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-amber-300">
              فتح المنصة{" "}
              <ArrowLeft
                size={16}
                className="transition group-hover:-translate-x-1"
              />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
