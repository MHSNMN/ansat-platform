import React from "react";
import {
  X,
  Calendar,
  MapPin,
  Users,
  Play,
  ExternalLink,
  Image as ImageIcon,
  Edit3,
} from "lucide-react";
import { ActivityItem } from "./activityTypes";

interface ActivityDetailModalProps {
  activity: ActivityItem | null;
  onClose: () => void;
  onPlayRecording?: (recordingUrl: string, title: string) => void;
  canEdit?: boolean;
  onEdit?: (activity: ActivityItem) => void;
}

export function ActivityDetailModal({
  activity,
  onClose,
  onPlayRecording,
  canEdit,
  onEdit,
}: ActivityDetailModalProps) {
  if (!activity) return null;

  const typeLabels: Record<string, string> = {
    WORKSHOP: "ورشة عمل تدريبية",
    CULTURAL_SESSION: "جلسة حوارية ثقافية",
    BOOK_CLUB: "نادي قراءة ومناقشة كتاب",
    WEBINAR: "ندوة افتراضية عبر الإنترنت",
    EXHIBITION: "معرض ثقافي",
    COMMUNITY_MEETUP: "لقاء مجتمعي",
  };

  const statusLabels: Record<string, { text: string; bg: string }> = {
    UPCOMING: {
      text: "فعالية قادمة",
      bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    },
    ONGOING: {
      text: "جارية الآن",
      bg: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    },
    COMPLETED: {
      text: "نشاط منجز وموثق",
      bg: "bg-slate-800 text-slate-300 border-slate-700",
    },
    RECORDED: {
      text: "تسجيل متاح للاستماع",
      bg: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    },
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-100 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs px-3 py-1 rounded-full font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {typeLabels[activity.activityType] || "نشاط ثقافي"}
              </span>
              {activity.status && statusLabels[activity.status] && (
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium border ${
                    statusLabels[activity.status].bg
                  }`}
                >
                  {statusLabels[activity.status].text}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white leading-snug">
              {activity.title}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(activity);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 size={13} />
                <span>تعديل الفعالية</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Cover Image if available */}
        {activity.coverImage && (
          <div className="mt-6 rounded-2xl overflow-hidden border border-slate-800 max-h-72 bg-slate-950">
            <img
              referrerPolicy="no-referrer"
              src={activity.coverImage}
              alt={activity.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Key Details Bar */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-sm">
          <div className="flex items-center gap-2.5 text-slate-300">
            <Calendar size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">التاريخ</p>
              <p className="font-medium">{activity.startDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <MapPin size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">المكان / النمط</p>
              <p className="font-medium">
                {activity.mode === "ONLINE"
                  ? "عن بُعد (افتراضي)"
                  : activity.location || "حضوري"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <Users size={18} className="text-amber-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-500">فريق التنظيم</p>
              <p className="font-medium truncate">
                {activity.organizers?.join("، ") || "فريق إنصات"}
              </p>
            </div>
          </div>
        </div>

        {/* Description Body */}
        <div className="mt-6 space-y-4 text-slate-300 leading-relaxed text-base">
          <p className="font-semibold text-white">
            {activity.shortDescription}
          </p>
          <div className="whitespace-pre-line text-sm text-slate-300">
            {activity.fullDescription || activity.shortDescription}
          </div>
        </div>

        {/* Audio Recording Link if recorded */}
        {activity.recordingUrl && (
          <div className="mt-6 p-4 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 text-indigo-300 flex items-center justify-center font-bold">
                <Play size={18} />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">
                  تسجيل الجلسة متاح
                </h4>
                <p className="text-xs text-indigo-300/80">
                  يمكنك الاستماع للتسجيل الكامل لهذه الفعالية
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onPlayRecording && activity.recordingUrl) {
                  onPlayRecording(activity.recordingUrl, activity.title);
                }
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-2 transition"
            >
              <Play size={14} /> استمع للتسجيل
            </button>
          </div>
        )}

        {/* Gallery if present */}
        {activity.galleryImages && activity.galleryImages.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <ImageIcon size={16} className="text-amber-400" /> معرض الصور
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {activity.galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  className="rounded-xl overflow-hidden border border-slate-800 h-28 bg-slate-950 group relative"
                >
                  <img
                    referrerPolicy="no-referrer"
                    src={img.url}
                    alt={img.caption || `صورة ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  {img.caption && (
                    <div className="absolute inset-x-0 bottom-0 p-1 bg-black/60 text-[10px] text-center text-slate-200 truncate">
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* External Links */}
        {activity.relatedLinks && activity.relatedLinks.length > 0 && (
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap gap-3">
            {activity.relatedLinks.map((link, idx) => (
              <a
                key={idx}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20"
              >
                <ExternalLink size={12} /> {link.title}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
