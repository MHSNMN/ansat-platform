import React, { useState, useMemo } from "react";
import {
  Trophy,
  Award,
  Gem,
  Medal,
  Clock,
  Search,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import type {
  GemTransaction,
  LeaderboardEntry,
  RewardBalance,
} from "../../types";
import type { UserHonorBadge } from "../types";

interface HomeViewProps {
  balance: RewardBalance | null;
  history: GemTransaction[];
  leaderboard: (LeaderboardEntry & { points?: number })[];
  userBadges: UserHonorBadge[];
  userName: string;
  userRole: string;
  userId: string;
  userJoinedAt?: string;
  currentRank: number;
}

const LEVEL_DEFINITIONS = [
  { min: 0, name: "بداية الأثر", symbol: "◌", badgeClass: "lvl-start" },
  { min: 75, name: "المعدني", symbol: "◈", badgeClass: "lvl-metallic" },
  { min: 150, name: "البرونزي", symbol: "◆", badgeClass: "lvl-bronze" },
  { min: 225, name: "الفضي", symbol: "✦", badgeClass: "lvl-silver" },
  { min: 350, name: "الذهبي", symbol: "✹", badgeClass: "lvl-gold" },
  { min: 600, name: "الماسي", symbol: "✧", badgeClass: "lvl-diamond" },
] as const;

export const HomeView: React.FC<HomeViewProps> = ({
  balance,
  history,
  leaderboard,
  userBadges,
  userName,
  userRole,
  userId,
  userJoinedAt,
  currentRank,
}) => {
  const [leaderSearch, setLeaderSearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<
    "all" | "earned" | "spent" | "gifts"
  >("all");

  const points = balance?.points || 0;
  const receivedGems = balance?.receivedGems || 0;
  const impactPoints = balance?.leaderboardPoints || 0;

  // Level Progression Calculation
  const currentLevel = useMemo(() => {
    return (
      [...LEVEL_DEFINITIONS].reverse().find((lvl) => points >= lvl.min) ||
      LEVEL_DEFINITIONS[0]
    );
  }, [points]);

  const nextLevel = useMemo(() => {
    return LEVEL_DEFINITIONS.find((lvl) => lvl.min > points);
  }, [points]);

  const progressPercent = useMemo(() => {
    if (!nextLevel) return 100;
    const prevMin = currentLevel.min;
    const span = nextLevel.min - prevMin;
    const currInSpan = points - prevMin;
    return Math.min(100, Math.max(0, Math.round((currInSpan / span) * 100)));
  }, [points, currentLevel, nextLevel]);

  // Filtered Leaderboard
  const filteredLeaderboard = useMemo(() => {
    if (!leaderSearch.trim()) return leaderboard;
    const q = leaderSearch.toLowerCase();
    return leaderboard.filter((item) =>
      (item.name || "").toLowerCase().includes(q),
    );
  }, [leaderboard, leaderSearch]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (historyFilter === "all") return history;
    if (historyFilter === "earned")
      return history.filter((t) => (t.points || 0) > 0);
    if (historyFilter === "spent")
      return history.filter((t) => (t.points || 0) < 0);
    if (historyFilter === "gifts")
      return history.filter((t) => (t.type || "").includes("gift"));
    return history;
  }, [history, historyFilter]);

  const formatTimestamp = (ts?: string) => {
    if (!ts) return "—";
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return "—";
      return new Intl.DateTimeFormat("ar-IQ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return "—";
    }
  };

  const initialLetter = userName.trim() ? userName.trim().charAt(0) : "ع";

  return (
    <div className="rew-home-layout" dir="rtl">
      {/* ================= COLUMN 1: Profile, Hero, Stats, Track ================= */}
      <div className="rew-col-primary">
        {/* Profile Card */}
        <div className="rew-card rew-profile-card">
          <div className="rew-profile-top">
            <div className="rew-profile-avatar-box">
              <span className="rew-profile-initial">{initialLetter}</span>
            </div>
            <div className="rew-profile-meta">
              <div className="rew-profile-name-row">
                <h3>{userName}</h3>
                <span className="rew-status-pill active">نشط</span>
              </div>
              <div className="rew-profile-sub-row">
                <span className="rew-id-badge">
                  ID: {userId ? userId.slice(0, 10) : "INS-0001"}
                </span>
                <span className="rew-role-badge">
                  {userRole || "عضو إنصات"}
                </span>
              </div>
            </div>
          </div>
          {userJoinedAt && (
            <div className="rew-profile-footer">
              <Clock size={13} />
              <span>تاريخ الانضمام: {userJoinedAt}</span>
            </div>
          )}
        </div>

        {/* Hero Points Card (Ink & Yellow Neo-Brutalist) */}
        <div className="rew-card rew-hero-card">
          <div className="rew-hero-header">
            <div className="rew-hero-tag">
              <Sparkles size={15} />
              <span>رصيد مساهماتك الفعلي</span>
            </div>
            <span className="rew-hero-badge">
              {currentLevel.symbol} {currentLevel.name}
            </span>
          </div>

          <div className="rew-hero-score-row">
            <div className="rew-hero-points-wrap">
              <span className="rew-hero-points-mono">
                {points.toLocaleString("ar-IQ")}
              </span>
              <span className="rew-hero-points-label">نقطة متاحة</span>
            </div>
            <div
              className="rew-hero-impact-pill"
              title="مجموع نقاط الأثر المحسوبة في الترتيب"
            >
              <span>{impactPoints}</span>
              <small>نقطة أثر</small>
            </div>
          </div>

          <div className="rew-hero-progress-section">
            <div className="rew-hero-progress-labels">
              <span>تقدمك نحو الرتبة التالية</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div className="rew-hero-progress-track">
              <div
                className="rew-hero-progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="rew-hero-progress-hint">
              {nextLevel
                ? `باقي ${nextLevel.min - points} نقطة للوصول إلى مرتبة (${nextLevel.name})`
                : "تهانينا! لقد وصلت إلى أعلى مرتبة في مسار إنصات (الماسي)"}
            </p>
          </div>
        </div>

        {/* 4 Quick Stat Cards */}
        <div className="rew-stats-grid">
          <div className="rew-stat-box">
            <div className="rew-stat-icon gold">
              <Trophy size={18} />
            </div>
            <span className="rew-stat-label">الترتيب العام</span>
            <strong className="rew-stat-value">
              {currentRank > 0 ? `#${currentRank}` : "—"}
            </strong>
          </div>

          <div className="rew-stat-box">
            <div className="rew-stat-icon purple">
              <Medal size={18} />
            </div>
            <span className="rew-stat-label">الرتبة الحالية</span>
            <strong className="rew-stat-value">{currentLevel.name}</strong>
          </div>

          <div className="rew-stat-box">
            <div className="rew-stat-icon amber">
              <Award size={18} />
            </div>
            <span className="rew-stat-label">الأوسمة المكتسبة</span>
            <strong className="rew-stat-value">{userBadges.length}</strong>
          </div>

          <div className="rew-stat-box">
            <div className="rew-stat-icon blue">
              <Gem size={18} />
            </div>
            <span className="rew-stat-label">جواهر أُهديت لي</span>
            <strong className="rew-stat-value">{receivedGems} 💎</strong>
          </div>
        </div>

        {/* 5 Rank Badges Progression Track */}
        <div className="rew-card rew-rank-track-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <Award size={18} />
              <h4>مسار الأوسمة والرتب</h4>
            </div>
            <span className="rew-card-tag">5 مستويات</span>
          </div>

          <div className="rew-rank-steps">
            {LEVEL_DEFINITIONS.slice(1).map((lvl) => {
              const isAchieved = points >= lvl.min;
              const isCurrent = currentLevel.name === lvl.name;
              return (
                <div
                  key={lvl.name}
                  className={`rew-rank-step ${isAchieved ? "completed" : ""} ${isCurrent ? "current" : ""}`}
                >
                  <div className="rew-rank-step-icon">
                    <span>{lvl.symbol}</span>
                  </div>
                  <div className="rew-rank-step-info">
                    <strong>{lvl.name}</strong>
                    <small>{lvl.min}+ نقطة</small>
                  </div>
                  <div className="rew-rank-step-status">
                    {isAchieved ? (
                      <span className="rew-badge-status done">
                        <CheckCircle2 size={14} />
                        مكتمل
                      </span>
                    ) : (
                      <span className="rew-badge-status locked">مقفل</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Special Badges Card */}
        <div className="rew-card rew-special-badges-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <Sparkles size={18} />
              <h4>أوسمتي التقديرية المميزة</h4>
            </div>
            <span className="rew-card-counter">{userBadges.length}</span>
          </div>

          {userBadges.length > 0 ? (
            <div className="rew-special-badges-list">
              {userBadges.map((badge) => (
                <div key={badge.id} className="rew-special-badge-item">
                  <div className="rew-special-badge-icon">
                    <Award size={20} />
                  </div>
                  <div className="rew-special-badge-meta">
                    <strong>{badge.badgeTitle}</strong>
                    <p>
                      {badge.reason ||
                        "تقديراً للإسهامات الاستثنائية والجهود المخلصة."}
                    </p>
                    <small>{formatTimestamp(badge.awardedAt)}</small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rew-empty-card-state">
              <Award size={26} />
              <p>لم يتم منح أوسمة تقديرية خاصة بعد.</p>
              <small>
                تُمنح الأوسمة التقديرية من الإدارة أو بترشيح الزملاء في لوحة
                الشرف.
              </small>
            </div>
          )}
        </div>
      </div>

      {/* ================= COLUMN 2: Leaderboard & Ledger ================= */}
      <div className="rew-col-secondary">
        {/* Leaderboard Card */}
        <div className="rew-card rew-leaderboard-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <Trophy size={18} />
              <h4>لائحة المتصدرين والأثر</h4>
            </div>
            <span className="rew-card-tag">{leaderboard.length} عضو</span>
          </div>

          <div className="rew-search-input-box">
            <Search size={15} />
            <input
              type="text"
              placeholder="ابحث عن زميل في اللائحة..."
              value={leaderSearch}
              onChange={(e) => setLeaderSearch(e.target.value)}
            />
          </div>

          <div className="rew-leaderboard-table">
            <div className="rew-leader-table-head">
              <span className="col-rank">#</span>
              <span className="col-member">العضو</span>
              <span className="col-pts">النقاط</span>
              <span className="col-gems">الجواهر</span>
              <span className="col-impact">مجموع الأثر</span>
            </div>

            <div className="rew-leader-table-body">
              {filteredLeaderboard.length > 0 ? (
                filteredLeaderboard.map((row) => {
                  const isMe = row.uid === userId;
                  const rank = row.rank || 0;
                  const medalBadge =
                    rank === 1
                      ? "🥇"
                      : rank === 2
                        ? "🥈"
                        : rank === 3
                          ? "🥉"
                          : null;

                  return (
                    <div
                      key={row.uid}
                      className={`rew-leader-row rank-${rank} ${isMe ? "is-me" : ""}`}
                    >
                      <div className="col-rank">
                        {medalBadge ? (
                          <span className="rew-medal-icon">{medalBadge}</span>
                        ) : (
                          <span className="rew-rank-number">{rank}</span>
                        )}
                      </div>

                      <div className="col-member">
                        <div className="rew-leader-avatar">
                          {(row.name || "ع").charAt(0)}
                        </div>
                        <div className="rew-leader-names">
                          <strong>{row.name || "عضو إنصات"}</strong>
                          {isMe && <span className="rew-me-tag">أنت</span>}
                        </div>
                      </div>

                      <div className="col-pts">
                        <span>{row.points || 0}</span>
                      </div>

                      <div className="col-gems">
                        <span>{row.receivedGems || 0} 💎</span>
                      </div>

                      <div className="col-impact">
                        <strong>{row.leaderboardPoints}</strong>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rew-empty-table-state">
                  <p>لا توجد نتائج مطابقة لبحثك</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Points History & Ledger Card */}
        <div className="rew-card rew-ledger-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <Clock size={18} />
              <h4>سجل الحركات والتقدير</h4>
            </div>
            {/* Filter Buttons */}
            <div className="rew-filter-buttons">
              <button
                type="button"
                className={`rew-filter-btn ${historyFilter === "all" ? "active" : ""}`}
                onClick={() => setHistoryFilter("all")}
              >
                الكل
              </button>
              <button
                type="button"
                className={`rew-filter-btn ${historyFilter === "earned" ? "active" : ""}`}
                onClick={() => setHistoryFilter("earned")}
              >
                مكتسبة
              </button>
              <button
                type="button"
                className={`rew-filter-btn ${historyFilter === "spent" ? "active" : ""}`}
                onClick={() => setHistoryFilter("spent")}
              >
                مخصومة
              </button>
              <button
                type="button"
                className={`rew-filter-btn ${historyFilter === "gifts" ? "active" : ""}`}
                onClick={() => setHistoryFilter("gifts")}
              >
                إهداء
              </button>
            </div>
          </div>

          <div className="rew-ledger-list">
            {filteredHistory.length > 0 ? (
              filteredHistory.map((tx) => {
                const isPositive =
                  (tx.points || 0) > 0 || tx.type === "gift_received";
                const hasGems = (tx.gems || 0) !== 0;

                return (
                  <div key={tx.id} className="rew-ledger-row">
                    <div
                      className={`rew-ledger-icon ${isPositive ? "plus" : "minus"}`}
                    >
                      {isPositive ? (
                        <ArrowDownLeft size={16} />
                      ) : (
                        <ArrowUpRight size={16} />
                      )}
                    </div>

                    <div className="rew-ledger-info">
                      <strong>{tx.reason || "عملية نقاط معتمدة"}</strong>
                      <small>{formatTimestamp(tx.createdAt)}</small>
                    </div>

                    <div className="rew-ledger-delta">
                      {(tx.points || 0) !== 0 && (
                        <span
                          className={`rew-delta-pts ${isPositive ? "positive" : "negative"}`}
                        >
                          {isPositive ? `+${tx.points}` : tx.points} نقطة
                        </span>
                      )}
                      {hasGems && (
                        <span className="rew-delta-gems">
                          {tx.gems > 0 ? `+${tx.gems}` : tx.gems} 💎
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rew-empty-card-state">
                <Clock size={24} />
                <p>لا توجد حركات مطابقة في السجل حتى الآن.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
