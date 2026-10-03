import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PlatformGuard } from "../auth/PlatformGuard";
import { useAuth } from "../auth/useAuth";
import { ErrorBoundary } from "../shared/components/ErrorBoundary";
import { FullPageSpinner } from "../shared/components/Spinner";
import { apiFetch } from "../lib/api";
import type { GemTransaction, LeaderboardEntry, RewardBalance } from "../types";
import type {
  RewardsNavTab,
  RewardMember,
  ActivityItem,
  SessionItem,
  UserHonorBadge,
  NotificationItem,
} from "./types";
import { RewardsHeader } from "./components/RewardsHeader";
import { ActivitiesRow } from "./components/ActivitiesRow";
import { HomeView } from "./components/HomeView";
import { PostsView } from "./components/PostsView";
import { HallOfFameView } from "./components/HallOfFameView";
import { SupportView } from "./components/SupportView";
import { StoreView } from "./components/StoreView";
import { CertificatesView } from "./components/CertificatesView";
import { SessionsView } from "./components/SessionsView";
import { AdminRewardsPanel } from "./components/AdminRewardsPanel";
import { UserProfileModal } from "../components/UserProfileModal";
import "./styles/rewards.css";

export function RewardsApp() {
  return (
    <ErrorBoundary>
      <PlatformGuard platform="rewards">
        <RewardsWorkspace />
      </PlatformGuard>
    </ErrorBoundary>
  );
}

function operationKey() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function RewardsWorkspace() {
  const { user, refreshUser } = useAuth();
  const [currentTab, setCurrentTab] = useState<RewardsNavTab>("home");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [balance, setBalance] = useState<RewardBalance | null>(null);
  const [history, setHistory] = useState<GemTransaction[]>([]);
  const [leaderboard, setLeaderboard] = useState<
    (LeaderboardEntry & { points?: number })[]
  >([]);
  const [members, setMembers] = useState<RewardMember[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [userBadges, setUserBadges] = useState<UserHonorBadge[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [globalNotice, setGlobalNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const canManage = useMemo(() => {
    if (!user) return false;
    if (user.is_super_admin) return true;
    const adminRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "REWARDS_MANAGER",
      "CERTIFICATE_MANAGER",
    ];
    return adminRoles.includes(user.role || "");
  }, [user]);

  const loadAllData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [balRes, ldrRes, memRes, commRes] = await Promise.all([
          apiFetch("/api/rewards/me"),
          apiFetch("/api/rewards/leaderboard"),
          apiFetch("/api/rewards/members"),
          apiFetch("/api/rewards/community"),
        ]);

        const parseJsonSafe = async (r: Response) => {
          try {
            const text = await r.text();
            return text ? JSON.parse(text) : { success: false };
          } catch {
            return { success: false };
          }
        };

        const balData = await parseJsonSafe(balRes);
        const ldrData = await parseJsonSafe(ldrRes);
        const memData = await parseJsonSafe(memRes);
        const commData = await parseJsonSafe(commRes);

        if (balRes.ok && balData.success) {
          setBalance({
            uid: user?.id || "",
            points: balData.points || 0,
            gems: balData.gems || 0,
            receivedGems: balData.receivedGems || 0,
            leaderboardPoints: balData.leaderboardPoints || 0,
            lastRestDay: balData.lastRestDay,
          });
          setHistory(Array.isArray(balData.history) ? balData.history : []);
          setUserBadges(Array.isArray(balData.badges) ? balData.badges : []);
        }

        if (ldrRes.ok && ldrData.success) {
          setLeaderboard(
            Array.isArray(ldrData.leaderboard) ? ldrData.leaderboard : [],
          );
        }

        if (memRes.ok && memData.success) {
          setMembers(Array.isArray(memData.members) ? memData.members : []);
        }

        if (commRes.ok && commData.success) {
          setActivities(
            Array.isArray(commData.activities) ? commData.activities : [],
          );
          setSessions(
            Array.isArray(commData.sessions) ? commData.sessions : [],
          );
        }

        // Mock sample notification if empty
        setNotifications((prev) => {
          if (prev.length > 0) return prev;
          return [
            {
              id: "notif-welcome",
              title: "مرحباً بك في منصة التقدير",
              message: "استكشف رصيد نقاطك وجواهر الشكر في مساحتك الخاصة.",
              type: "points",
              createdAt: "اليوم",
              read: false,
            },
          ];
        });
      } catch (err) {
        setGlobalNotice({
          kind: "error",
          text:
            err instanceof Error
              ? err.message
              : "تعذر تحميل بيانات منصة النقاط",
        });
      } finally {
        setLoading(false);
      }
    },
    [user?.id],
  );

  useEffect(() => {
    void loadAllData();
  }, [loadAllData]);

  // Actions
  const handlePurchaseGems = async (quantity: number): Promise<boolean> => {
    setBusyAction(`buy-${quantity}`);
    setGlobalNotice(null);
    try {
      const res = await apiFetch("/api/rewards/purchase-gems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": operationKey(),
        },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر شراء باقة الجواهر");
      }
      await loadAllData(true);
      return true;
    } catch (err) {
      setGlobalNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر شراء باقة الجواهر",
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleGiftGems = async (
    toUid: string,
    quantity: number,
    note?: string,
  ): Promise<boolean> => {
    setBusyAction("gift");
    setGlobalNotice(null);
    try {
      const res = await apiFetch("/api/rewards/gift-gems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": operationKey(),
        },
        body: JSON.stringify({ toUid, quantity, note }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إهداء الجواهر");
      }
      await loadAllData(true);
      return true;
    } catch (err) {
      setGlobalNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر إهداء الجواهر",
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleClaimRestDay = async (): Promise<boolean> => {
    setBusyAction("rest");
    setGlobalNotice(null);
    try {
      const res = await apiFetch("/api/rewards/rest-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": operationKey(),
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر طلب يوم الراحة");
      }
      await loadAllData(true);
      return true;
    } catch (err) {
      setGlobalNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر طلب يوم الراحة",
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleGiftSpeaker = (speakerName: string) => {
    // Navigate to store tab with note preset
    setCurrentTab("store");
    setGlobalNotice({
      kind: "ok",
      text: `انتقلت إلى المتجر لإهداء جوهرة تقديراً لـ: ${speakerName}`,
    });
  };

  const handleMarkNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  if (loading) {
    return <FullPageSpinner label="جارٍ تشغيل لوحة التقدير والنقاط..." />;
  }

  // Find user's rank in leaderboard
  const myRank = leaderboard.find((row) => row.uid === user?.id)?.rank || 0;

  return (
    <div className="rewards-platform" dir="rtl">
      {/* Top Header */}
      <RewardsHeader
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        canManage={canManage}
        userName={user?.name || "عضو إنصات"}
        userId={user?.id || ""}
        notifications={notifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      <main className="rewards-main">
        {/* Global Notice */}
        {globalNotice && (
          <div className={`reward-notice ${globalNotice.kind}`} role="status">
            <span>{globalNotice.text}</span>
            <button type="button" onClick={() => setGlobalNotice(null)}>
              ×
            </button>
          </div>
        )}

        {/* Upcoming Activities Row (displayed on home and sessions) */}
        {["home", "sessions"].includes(currentTab) && (
          <ActivitiesRow activities={activities} />
        )}

        {/* Active Tab View */}
        {currentTab === "home" && (
          <HomeView
            balance={balance}
            history={history}
            leaderboard={leaderboard}
            userBadges={userBadges}
            userName={user?.name || "عضو إنصات"}
            userRole={user?.role || "عضو مبادرة"}
            userId={user?.id || ""}
            userJoinedAt={
              user?.createdAt ? user.createdAt.slice(0, 10) : undefined
            }
            currentRank={myRank}
          />
        )}

        {currentTab === "posts" && (
          <PostsView currentUserId={user?.id || ""} canModerate={canManage} />
        )}

        {currentTab === "hof" && (
          <HallOfFameView
            members={members}
            userPoints={balance?.points || 0}
            onNominationSuccess={() => void loadAllData(true)}
          />
        )}

        {currentTab === "support" && <SupportView />}

        {currentTab === "store" && (
          <StoreView
            balance={balance}
            members={members}
            busyAction={busyAction}
            onPurchaseGems={handlePurchaseGems}
            onGiftGems={handleGiftGems}
            onClaimRestDay={handleClaimRestDay}
          />
        )}

        {currentTab === "cert" && <CertificatesView />}

        {currentTab === "sessions" && (
          <SessionsView
            sessions={sessions}
            members={members}
            userGems={balance?.gems || 0}
            onGiftSpeaker={handleGiftSpeaker}
          />
        )}

        {currentTab === "admin" && canManage && (
          <AdminRewardsPanel
            members={members}
            onDataChanged={() => void loadAllData(true)}
          />
        )}
      </main>

      {/* User Profile Modal */}
      {showProfileModal && user && (
        <UserProfileModal
          currentUser={user as any}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          theme="dark"
          onUpdated={() => {
            refreshUser();
            void loadAllData(true);
          }}
        />
      )}
    </div>
  );
}

export default RewardsApp;
