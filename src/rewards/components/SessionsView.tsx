import React, { useState } from "react";
import { Mic2, Play, Gem, ExternalLink } from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { SessionItem, RewardMember } from "../types";

interface SessionsViewProps {
  sessions: SessionItem[];
  members: RewardMember[];
  userGems: number;
  onGiftSpeaker: (speakerName: string) => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessions,
  members,
  userGems,
  onGiftSpeaker,
}) => {
  const [localReactions, setLocalReactions] = useState<
    Record<string, Record<string, number>>
  >({});

  const handleReact = async (sessionId: string, emoji: string) => {
    // Optimistic UI update
    setLocalReactions((prev) => {
      const sessionCounts = prev[sessionId] || {};
      return {
        ...prev,
        [sessionId]: {
          ...sessionCounts,
          [emoji]: (sessionCounts[emoji] || 0) + 1,
        },
      };
    });

    try {
      await apiFetch(`/api/rewards/sessions/${sessionId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
    } catch {
      // Silent catch
    }
  };

  const getYouTubeEmbedUrl = (url: string) => {
    try {
      if (!url) return "";
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtube.com")) {
        const v = parsed.searchParams.get("v");
        if (v) return `https://www.youtube.com/embed/${v}`;
      }
      if (parsed.hostname.includes("youtu.be")) {
        const id = parsed.pathname.slice(1);
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      return url;
    } catch {
      return url;
    }
  };

  const REACTION_TYPES = [
    { key: "heart", emoji: "❤️", label: "إعجاب" },
    { key: "fire", emoji: "🔥", label: "حماس" },
    { key: "clap", emoji: "👏", label: "تصفيق" },
    { key: "mic", emoji: "🎙️", label: "صوت ذهبي" },
    { key: "bulb", emoji: "💡", label: "إلهام" },
  ];

  return (
    <div className="rew-sessions-layout" dir="rtl">
      <div className="rew-card rew-sessions-intro">
        <div className="rew-sessions-intro-content">
          <div className="rew-sessions-tag">
            <Mic2 size={18} />
            <span>جلسات وورش عمل إنصات</span>
          </div>
          <h2>أرشيف المعرفة والتدريب الصوتي</h2>
          <p>
            شاهد الجلسات والورش التفاعلية السابقة، تفاعل معها، وادعم المتحدثين
            بجواهر التقدير عرفاناً بوقتهم ومعارفهم التي شاركوها مع الفريق.
          </p>
        </div>
      </div>

      {sessions.length > 0 ? (
        <div className="rew-sessions-grid">
          {sessions.map((sess) => {
            const embedUrl = getYouTubeEmbedUrl(sess.youtubeUrl);
            const counts = localReactions[sess.id] || sess.reactions || {};

            return (
              <article key={sess.id} className="rew-card rew-session-card">
                {/* Video Area */}
                <div className="rew-session-media">
                  {embedUrl.startsWith("https://www.youtube.com/embed/") ? (
                    <iframe
                      src={embedUrl}
                      title={sess.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="rew-session-iframe"
                    />
                  ) : (
                    <div className="rew-session-placeholder">
                      <Play size={40} />
                      <a
                        href={sess.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rew-btn-primary"
                      >
                        <span>مشاهدة التسجيل على YouTube</span>
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  )}
                </div>

                <div className="rew-session-info">
                  <h3 className="rew-session-title">{sess.title}</h3>
                  <p className="rew-session-desc">{sess.description}</p>

                  {/* Speakers Row */}
                  {sess.speakers && sess.speakers.length > 0 && (
                    <div className="rew-session-speakers">
                      <span className="rew-speakers-label">المتحدثون:</span>
                      <div className="rew-speakers-list">
                        {sess.speakers.map((spk, idx) => (
                          <div key={idx} className="rew-speaker-chip">
                            <span>{spk}</span>
                            <button
                              type="button"
                              className="rew-speaker-gift-btn"
                              title={`إهداء جوهرة لـ ${spk}`}
                              onClick={() => onGiftSpeaker(spk)}
                            >
                              <Gem size={13} />
                              <span>دعم</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reactions Bar */}
                  <div className="rew-session-reactions-bar">
                    <span className="rew-reactions-label">
                      تفاعل مع الجلسة:
                    </span>
                    <div className="rew-reaction-buttons">
                      {REACTION_TYPES.map((rx) => {
                        const count = counts[rx.key] || 0;
                        return (
                          <button
                            key={rx.key}
                            type="button"
                            className="rew-reaction-btn"
                            onClick={() => handleReact(sess.id, rx.key)}
                            title={rx.label}
                          >
                            <span className="rx-emoji">{rx.emoji}</span>
                            {count > 0 && (
                              <span className="rx-count">{count}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rew-card rew-empty-sessions">
          <Mic2 size={36} />
          <h4>لم تُنشر أي جلسات مسجلة بعد</h4>
          <p>
            ستقوم إدارة المبادرة برفع تسجيلات الورش واللقاءات الدورية هنا
            قريباً.
          </p>
        </div>
      )}
    </div>
  );
};
