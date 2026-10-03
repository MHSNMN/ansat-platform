import { useEffect, useState } from "react";
import {
  Coins,
  Gem,
  Gift,
  Award,
  Calendar,
  History,
  Send,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { ThemeMode, User } from "../types";

export interface RewardLedgerItem {
  id: string;
  type: string;
  points: number;
  gems: number;
  reason: string;
  createdAt: string;
}

export function RewardsPlatform({
  currentUser,
  theme,
  users = [],
}: {
  currentUser: User;
  theme: ThemeMode;
  users?: User[];
}) {
  const [activeTab, setActiveTab] = useState<
    "me" | "store" | "gift" | "leaderboard" | "grant"
  >("me");
  const [points, setPoints] = useState(0);
  const [ownedGems, setOwnedGems] = useState(0);
  const [receivedGems, setReceivedGems] = useState(0);
  const [leaderboardPoints, setLeaderboardPoints] = useState(0);
  const [history, setHistory] = useState<RewardLedgerItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Gift Form State
  const [giftRecipientUid, setGiftRecipientUid] = useState("");
  const [giftQuantity, setGiftQuantity] = useState(1);

  // Admin Grant Form State
  const [grantUid, setGrantUid] = useState("");
  const [grantPoints, setGrantPoints] = useState(10);
  const [grantReason, setGrantReason] = useState("");

  const generateIdempotencyKey = () =>
    `op_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;

  const loadBalance = async () => {
    setBusy(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/rewards/me");
      const data = await res.json();
      if (data.success) {
        setPoints(data.points || 0);
        setOwnedGems(data.gems || 0);
        setReceivedGems(data.receivedGems || 0);
        setLeaderboardPoints(data.leaderboardPoints || 0);
        setHistory(data.history || []);
      }
    } catch {
      setMessage("تعذر تحميل بيانات الرصيد حالياً.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void loadBalance();
  }, []);

  const handleBuyGems = async (quantity: number) => {
    setBusy(true);
    setMessage("");
    setSuccessMsg("");
    try {
      const res = await apiFetch("/api/rewards/purchase-gems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`تم شراء ${quantity} جواهر بنجاح!`);
        void loadBalance();
      } else {
        setMessage(data.error || "تعذر شراء الجواهر.");
      }
    } catch {
      setMessage("حدث خطأ أثناء شراء الجواهر.");
    } finally {
      setBusy(false);
    }
  };

  const handleClaimRestDay = async () => {
    setBusy(true);
    setMessage("");
    setSuccessMsg("");
    try {
      const res = await apiFetch("/api/rewards/rest-day", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": generateIdempotencyKey(),
        },
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("تم شراء يوم الراحة بنجاح! نتمنى لك يوماً سعيداً.");
        void loadBalance();
      } else {
        setMessage(data.error || "تعذر شراء يوم الراحة.");
      }
    } catch {
      setMessage("حدث خطأ أثناء الاتصال بالخادم.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftRecipientUid || giftQuantity < 1) return;
    setBusy(true);
    setMessage("");
    setSuccessMsg("");
    try {
      const res = await apiFetch("/api/rewards/gift-gems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({
          recipientUid: giftRecipientUid,
          quantity: giftQuantity,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("تم إهداء الجواهر بنجاح!");
        setGiftRecipientUid("");
        setGiftQuantity(1);
        void loadBalance();
      } else {
        setMessage(data.error || "تعذر إهداء الجواهر.");
      }
    } catch {
      setMessage("حدث خطأ أثناء إهداء الجواهر.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdminGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grantUid || !grantReason.trim()) return;
    setBusy(true);
    setMessage("");
    setSuccessMsg("");
    try {
      const res = await apiFetch("/api/rewards/grant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": generateIdempotencyKey(),
        },
        body: JSON.stringify({
          uid: grantUid,
          points: grantPoints,
          reason: grantReason.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("تم منح النقاط بنجاح!");
        setGrantUid("");
        setGrantReason("");
        void loadBalance();
      } else {
        setMessage(data.error || "فشل منح النقاط.");
      }
    } catch {
      setMessage("حدث خطأ أثناء منح النقاط.");
    } finally {
      setBusy(false);
    }
  };

  const surface =
    theme === "dark"
      ? "bg-slate-900 border-slate-800"
      : "bg-white border-slate-200";

  return (
    <div dir="rtl" className="space-y-6">
      {/* Overview Balance Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`rounded-3xl border p-6 ${surface}`}>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-bold">
              رصيد النقاط
            </span>
            <Coins className="text-amber-400" size={24} />
          </div>
          <strong className="mt-3 block text-3xl font-black text-amber-300">
            {points}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            نقطة متاحة للاستخدام
          </span>
        </div>

        <div className={`rounded-3xl border p-6 ${surface}`}>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-bold">
              الجواهر المقتناة
            </span>
            <Gem className="text-indigo-400" size={24} />
          </div>
          <strong className="mt-3 block text-3xl font-black text-indigo-300">
            {ownedGems}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            خاصة للإهداء فقط
          </span>
        </div>

        <div className={`rounded-3xl border p-6 ${surface}`}>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-bold">
              الجواهر المستلمة
            </span>
            <Gift className="text-emerald-400" size={24} />
          </div>
          <strong className="mt-3 block text-3xl font-black text-emerald-300">
            {receivedGems}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            تمنح نقاطاً في الترتيب
          </span>
        </div>

        <div className={`rounded-3xl border p-6 ${surface}`}>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm font-bold">
              نقاط الترتيب
            </span>
            <Award className="text-amber-500" size={24} />
          </div>
          <strong className="mt-3 block text-3xl font-black text-amber-400">
            {leaderboardPoints}
          </strong>
          <span className="mt-1 block text-xs text-slate-500">
            تعتمد على الجواهر المستلمة
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className={`rounded-3xl border p-6 ${surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab("me")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "me"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <History size={16} className="inline ml-1.5" /> رصيدي والسجل
            </button>
            <button
              onClick={() => setActiveTab("store")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "store"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Gem size={16} className="inline ml-1.5" /> متجر الجواهر
            </button>
            <button
              onClick={() => setActiveTab("gift")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "gift"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Gift size={16} className="inline ml-1.5" /> إهداء عضو
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "leaderboard"
                  ? "bg-amber-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Award size={16} className="inline ml-1.5" /> لوحة الشرف
            </button>
            {currentUser.can_manage_members && (
              <button
                onClick={() => setActiveTab("grant")}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  activeTab === "grant"
                    ? "bg-amber-400 text-slate-950"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <PlusCircle size={16} className="inline ml-1.5" /> منح نقاط
                (إداري)
              </button>
            )}
          </div>

          <button
            onClick={() => void loadBalance()}
            className="rounded-xl border border-white/10 p-2.5 text-slate-400 hover:bg-white/5 hover:text-white"
            aria-label="تحديث الرصيد"
          >
            <RefreshCw
              size={16}
              className={busy ? "animate-spin text-amber-400" : ""}
            />
          </button>
        </div>

        {message && (
          <p className="mt-4 text-sm text-rose-300 flex items-center gap-2">
            <AlertCircle size={16} /> {message}
          </p>
        )}

        {successMsg && (
          <p className="mt-4 text-sm text-emerald-300 flex items-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </p>
        )}

        {/* Tab 1: My Balance & Ledger History */}
        {activeTab === "me" && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-black">سجل العمليات الأخيرة</h2>
            <div className="space-y-3">
              {history.length > 0 ? (
                history.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div>
                      <p className="font-bold text-slate-200">
                        {item.reason || "عملية نقاط"}
                      </p>
                      <span className="text-xs text-slate-500">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString("ar-SA")
                          : "-"}
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      {item.points !== 0 && (
                        <span
                          className={`font-black text-sm ${
                            item.points > 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                          }`}
                        >
                          {item.points > 0 ? `+${item.points}` : item.points}{" "}
                          نقطة
                        </span>
                      )}
                      {item.gems !== 0 && (
                        <span
                          className={`font-black text-sm ${
                            item.gems > 0 ? "text-indigo-400" : "text-amber-400"
                          }`}
                        >
                          {item.gems > 0 ? `+${item.gems}` : item.gems} جوهرة
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">
                  لا توجد عمليات مسجلة سابقاً.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Gem Store & Rest Day */}
        {activeTab === "store" && (
          <div className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-black mb-1">متجر الجواهر</h2>
              <p className="text-xs text-slate-400">
                استبدل نقاطك بالجواهر للإهداء (الحد الأقصى: 5 جواهر كل 24 ساعة)
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { count: 1, cost: 5, label: "جوهرة واحدة" },
                { count: 3, cost: 12, label: "3 جواهر (توفير)" },
                { count: 5, cost: 18, label: "5 جواهر (الحد الأقصى)" },
              ].map(({ count, cost, label }) => (
                <div
                  key={count}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 text-center"
                >
                  <Gem className="mx-auto text-indigo-400 mb-3" size={32} />
                  <b className="block text-xl text-slate-100">{label}</b>
                  <span className="mt-1 block text-sm font-bold text-amber-300">
                    {cost} نقطة
                  </span>
                  <button
                    disabled={busy || points < cost}
                    onClick={() => void handleBuyGems(count)}
                    className="mt-4 w-full rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-400 disabled:opacity-40"
                  >
                    شراء الجواهر
                  </button>
                </div>
              ))}
            </div>

            {/* Rest Day Purchase */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/15 text-emerald-400">
                    <Calendar size={22} />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-100">
                      يوم راحة (Rest Day)
                    </h3>
                    <p className="text-xs text-slate-400">
                      تكلفة يوم الراحة: 30 نقطة. يُتاح مرة واحدة كل 7 أيام.
                    </p>
                  </div>
                </div>

                <button
                  disabled={busy || points < 30}
                  onClick={() => void handleClaimRestDay()}
                  className="rounded-xl bg-emerald-500 px-5 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                >
                  شراء يوم راحة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Gift Gems */}
        {activeTab === "gift" && (
          <div className="mt-6 max-w-lg space-y-4">
            <h2 className="text-lg font-black">
              إهداء جواهر لزميل في المبادرة
            </h2>
            <p className="text-xs text-slate-400">
              كل جوهرة مستلمة تمنح العضو المستلم +3 نقاط في الترتيب العام. لا
              يمكن إهداء الجواهر لنفسك.
            </p>

            <form onSubmit={handleSendGift} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  اختر العضو المستقبل
                </label>
                <select
                  required
                  value={giftRecipientUid}
                  onChange={(e) => setGiftRecipientUid(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none"
                >
                  <option value="">-- اختر عضواً --</option>
                  {users
                    .filter((u) => u.id !== currentUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role_display_ar})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  عدد الجواهر
                </label>
                <input
                  type="number"
                  min="1"
                  max={ownedGems || 1}
                  value={giftQuantity}
                  onChange={(e) => setGiftQuantity(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none"
                />
                <span className="mt-1 block text-xs text-slate-500">
                  رصيدك المتاح للإهداء: {ownedGems} جواهر
                </span>
              </div>

              <button
                disabled={busy || ownedGems < giftQuantity || !giftRecipientUid}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 font-black text-slate-950 hover:bg-amber-300 disabled:opacity-40"
              >
                <Send size={16} /> إرسال الهدية
              </button>
            </form>
          </div>
        )}

        {/* Tab 4: Admin Grant Points */}
        {activeTab === "grant" && currentUser.can_manage_members && (
          <div className="mt-6 max-w-lg space-y-4">
            <h2 className="text-lg font-black">منح نقاط إدارية لعضو</h2>
            <p className="text-xs text-slate-400">
              تُنفذ العملية عبر معاملة آمنة في الخادم وتستوجب كتابة سبب إلزامي
              لتوثيق السجل.
            </p>

            <form onSubmit={handleAdminGrant} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  العضو المستهدف
                </label>
                <select
                  required
                  value={grantUid}
                  onChange={(e) => setGrantUid(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none"
                >
                  <option value="">-- اختر عضواً --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role_display_ar})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  عدد النقاط (موجب للمنح، سالب للخصم)
                </label>
                <input
                  type="number"
                  value={grantPoints}
                  onChange={(e) => setGrantPoints(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  سبب التكريم أو التعديل (إلزامي)
                </label>
                <textarea
                  required
                  rows={3}
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="سبب إنجاز تسجيل أو مشاركة في نشاط..."
                  className="w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm outline-none"
                />
              </div>

              <button
                disabled={busy || !grantUid || !grantReason.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-3 font-black text-slate-950 hover:bg-amber-300 disabled:opacity-40"
              >
                <PlusCircle size={16} /> تأكيد منح النقاط
              </button>
            </form>
          </div>
        )}
        {/* Tab 5: Leaderboard */}
        {activeTab === "leaderboard" && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-black">لوحة الشرف</h2>
            <LeaderboardView />
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardView() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/rewards/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-slate-500 py-4">
        <RefreshCw className="animate-spin inline mr-2" size={16} /> جاري
        التحميل...
      </div>
    );
  if (!items.length)
    return (
      <div className="text-slate-500 py-4">لا توجد بيانات متاحة حالياً.</div>
    );

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={item.uid}
          className="flex items-center justify-between p-4 bg-black/20 border border-white/5 rounded-2xl"
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? "bg-amber-500 text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-orange-700 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              {i + 1}
            </div>
            <div>
              <div className="font-bold text-slate-200">
                {item.name || "عضو إنصات"}
              </div>
              <div className="text-xs text-slate-500">
                جواهر مستلمة: {item.receivedGems || 0}
              </div>
            </div>
          </div>
          <div className="font-black text-amber-400 text-xl">
            {item.leaderboardPoints || 0}
          </div>
        </div>
      ))}
    </div>
  );
}
