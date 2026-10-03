import React, { useState, useMemo } from "react";
import {
  ShoppingBag,
  Gift,
  Gem,
  Coins,
  CalendarCheck,
  Send,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import type { RewardBalance } from "../../types";
import type { RewardMember } from "../types";

interface StoreViewProps {
  balance: RewardBalance | null;
  members: RewardMember[];
  busyAction: string | null;
  onPurchaseGems: (quantity: number) => Promise<boolean>;
  onGiftGems: (
    toUid: string,
    quantity: number,
    note?: string,
  ) => Promise<boolean>;
  onClaimRestDay: () => Promise<boolean>;
}

const GEM_PACKS = [
  {
    quantity: 1,
    cost: 5,
    label: "باقة شكر بسيطة",
    badge: "ابتداءً من 5 نقاط",
    featured: false,
  },
  {
    quantity: 3,
    cost: 12,
    label: "باقة تقدير ثلاثية",
    badge: "وفر 3 نقاط",
    featured: false,
  },
  {
    quantity: 5,
    cost: 18,
    label: "باقة التميز الكبرى",
    badge: "أفضل قيمة",
    featured: true,
  },
] as const;

export const StoreView: React.FC<StoreViewProps> = ({
  balance,
  members,
  busyAction,
  onPurchaseGems,
  onGiftGems,
  onClaimRestDay,
}) => {
  const [giftRecipient, setGiftRecipient] = useState("");
  const [giftQty, setGiftQty] = useState(1);
  const [giftNote, setGiftNote] = useState("");
  const [actionMessage, setActionMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const points = balance?.points || 0;
  const readyGems = balance?.gems || 0;
  const receivedGems = balance?.receivedGems || 0;
  const lastRestDay = balance?.lastRestDay;

  // Rest day availability (7 days cooldown)
  const restAvailableAt = useMemo(() => {
    if (!lastRestDay) return 0;
    return new Date(lastRestDay).getTime() + 7 * 24 * 60 * 60 * 1000;
  }, [lastRestDay]);

  const isRestBlocked = restAvailableAt > Date.now();
  const restDaysRemaining = isRestBlocked
    ? Math.ceil((restAvailableAt - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;

  const handlePurchase = async (qty: number) => {
    setActionMessage(null);
    const success = await onPurchaseGems(qty);
    if (success) {
      setActionMessage({
        kind: "ok",
        text: `تم شراء ${qty} ${qty === 1 ? "جوهرة" : "جواهر"} بنجاح وأُضيفت إلى محفظة الإهداء!`,
      });
    }
  };

  const handleSendGift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftRecipient) {
      setActionMessage({
        kind: "error",
        text: "يرجى اختيار الزميل المستلم للجوهرة",
      });
      return;
    }
    if (readyGems < giftQty) {
      setActionMessage({
        kind: "error",
        text: "ليس لديك جواهر كافية للإهداء، يمكنك شراؤها من الباقات أدناه",
      });
      return;
    }

    setActionMessage(null);
    const success = await onGiftGems(giftRecipient, giftQty, giftNote.trim());
    if (success) {
      setActionMessage({
        kind: "ok",
        text: `تم إهداء ${giftQty} ${giftQty === 1 ? "جوهرة" : "جواهر"} لزميلك بنجاح! شكراً لصنع الأثر الطيب.`,
      });
      setGiftNote("");
      setGiftRecipient("");
      setGiftQty(1);
    }
  };

  const handleRestDay = async () => {
    setActionMessage(null);
    const success = await onClaimRestDay();
    if (success) {
      setActionMessage({
        kind: "ok",
        text: "تم تفعيل يوم الراحة بنجاح وخُصمت 30 نقطة من رصيدك. استمتع بيومك!",
      });
    }
  };

  return (
    <div className="rew-store-layout" dir="rtl">
      {/* Action Notification */}
      {actionMessage && (
        <div className={`rew-form-notice ${actionMessage.kind} store-notice`}>
          {actionMessage.kind === "ok" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Private Wallet Bar */}
      <div className="rew-card rew-wallet-summary-card">
        <div className="rew-wallet-head">
          <div className="rew-wallet-title">
            <Coins size={20} />
            <div>
              <h3>محفظة التقدير الخاصة</h3>
              <small>أرصدتك الشخصية المتاحة للاستخدام والإهداء</small>
            </div>
          </div>
          <span className="rew-wallet-lock-tag">
            <ShieldCheck size={14} />
            خاصة بك
          </span>
        </div>

        <div className="rew-wallet-grid">
          <div className="rew-wallet-item">
            <span className="rew-wallet-item-label">رصيد النقاط المتاحة</span>
            <strong className="rew-wallet-item-val gold">
              {points.toLocaleString("ar-IQ")}
            </strong>
            <small>تُستخدم لشراء الجواهر وأيام الراحة</small>
          </div>

          <div className="rew-wallet-item">
            <span className="rew-wallet-item-label">جواهر جاهزة للإهداء</span>
            <strong className="rew-wallet-item-val cyan">{readyGems} 💎</strong>
            <small>خاصة بك — لا تظهر في الترتيب</small>
          </div>

          <div className="rew-wallet-item">
            <span className="rew-wallet-item-label">
              جواهر أهداها لك الزملاء
            </span>
            <strong className="rew-wallet-item-val purple">
              {receivedGems} 💎
            </strong>
            <small>كل جوهرة تضيف +3 نقاط في لوحة الأثر</small>
          </div>

          <div className="rew-wallet-item">
            <span className="rew-wallet-item-label">رصيد يوم الراحة</span>
            <strong className="rew-wallet-item-val green">
              {isRestBlocked
                ? `متاح بعد ${restDaysRemaining} يوم`
                : "متاح الآن"}
            </strong>
            <small>30 نقطة (مرة كل 7 أيام)</small>
          </div>
        </div>
      </div>

      <div className="rew-store-columns">
        {/* ================= COLUMN 1: Gem Packages & Gift Form ================= */}
        <div className="rew-store-col-main">
          {/* Gem Packages */}
          <div className="rew-card rew-packages-card">
            <div className="rew-card-head">
              <div className="rew-card-title-group">
                <ShoppingBag size={18} />
                <h4>شراء جواهر التقدير</h4>
              </div>
              <span className="rew-card-tag">
                الحد الأقصى: 5 جواهر / 24 ساعة
              </span>
            </div>

            <p className="rew-card-subdesc">
              حوّل نقاطك إلى جواهر لتُهديها لزملائك كعربون شكر وتقدير على
              مساهماتهم وجهودهم.
            </p>

            <div className="rew-gem-packs-grid">
              {GEM_PACKS.map((pack) => {
                const canBuy = points >= pack.cost;
                const isBusy = busyAction === `buy-${pack.quantity}`;

                return (
                  <div
                    key={pack.quantity}
                    className={`rew-gem-pack-box ${pack.featured ? "featured" : ""}`}
                  >
                    <span className="rew-pack-badge">{pack.badge}</span>
                    <div className="rew-pack-gem-icons">
                      {Array.from({ length: pack.quantity }).map((_, i) => (
                        <Gem key={i} size={22} className="rew-pack-gem" />
                      ))}
                    </div>
                    <strong className="rew-pack-title">
                      {pack.quantity} {pack.quantity === 1 ? "جوهرة" : "جواهر"}
                    </strong>
                    <span className="rew-pack-cost">{pack.cost} نقطة</span>
                    <button
                      type="button"
                      className="rew-pack-buy-btn"
                      disabled={!canBuy || Boolean(busyAction)}
                      onClick={() => handlePurchase(pack.quantity)}
                    >
                      {isBusy ? "جارٍ الشراء..." : "شراء الباقة"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gift Gems Form */}
          <div className="rew-card rew-gift-card">
            <div className="rew-card-head">
              <div className="rew-card-title-group">
                <Gift size={18} />
                <h4>إهداء جوهرة لزميل</h4>
              </div>
              <span className="rew-gems-available-tag">
                رصيدك: {readyGems} 💎
              </span>
            </div>

            <p className="rew-card-subdesc">
              اختر زميلاً وأرسل له جوهرة مع كلمة شكر تعبّر عن تقديرك لمساعدته أو
              أدائه المتميز.
            </p>

            <form onSubmit={handleSendGift} className="rew-gift-form">
              <div className="rew-form-row-2">
                <div className="rew-field-group">
                  <label>إلى من تريد إهداء الجوهرة؟</label>
                  <select
                    value={giftRecipient}
                    onChange={(e) => setGiftRecipient(e.target.value)}
                    required
                  >
                    <option value="">-- اضغط لاختيار الزميل --</option>
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.name} ({m.role || "عضو"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rew-field-group">
                  <label>عدد الجواهر</label>
                  <input
                    type="number"
                    min="1"
                    max={Math.min(5, Math.max(1, readyGems))}
                    value={giftQty}
                    onChange={(e) =>
                      setGiftQty(Math.max(1, Number(e.target.value) || 1))
                    }
                    required
                  />
                </div>
              </div>

              <div className="rew-field-group">
                <label>رسالة شكر وتقدير (اختياري)</label>
                <input
                  type="text"
                  placeholder="شكراً لك على جهودك وتدقيقك الرائع اليوم..."
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="rew-form-footer">
                <button
                  type="submit"
                  className="rew-btn-primary"
                  disabled={
                    Boolean(busyAction) ||
                    !giftRecipient ||
                    readyGems < giftQty ||
                    giftQty <= 0
                  }
                >
                  <Send size={15} />
                  <span>
                    {busyAction === "gift"
                      ? "جارٍ الإهداء..."
                      : `إهداء ${giftQty} جوهرة الآن`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ================= COLUMN 2: Rest Day & Rules ================= */}
        <div className="rew-store-col-aside">
          {/* Rest Day Card */}
          <div className="rew-card rew-rest-card">
            <div className="rew-rest-icon-wrap">
              <CalendarCheck size={28} />
            </div>
            <h4>طلب يوم راحة</h4>
            <p>
              مكافأة تقديرية للاستراحة بعد فترات العمل المكثفة. تكلف 30 نقطة،
              ومتاحة بحد أقصى مرة واحدة كل 7 أيام.
            </p>

            <div className="rew-rest-price-pill">
              <Coins size={15} />
              <span>التكلفة: 30 نقطة</span>
            </div>

            {isRestBlocked && (
              <div className="rew-rest-cooldown-note">
                <AlertCircle size={14} />
                <span>
                  غير متاح حالياً (استُخدم مؤخراً). يمكنك الطلب بعد{" "}
                  {restDaysRemaining} أيام.
                </span>
              </div>
            )}

            <button
              type="button"
              className="rew-btn-primary"
              disabled={isRestBlocked || points < 30 || Boolean(busyAction)}
              onClick={handleRestDay}
            >
              {busyAction === "rest"
                ? "جارٍ الخصم والتفعيل..."
                : isRestBlocked
                  ? "غير متاح هذا الأسبوع"
                  : "تفعيل يوم الراحة الآن"}
            </button>
          </div>

          {/* System Rules Reminder */}
          <div className="rew-card rew-rules-card">
            <div className="rew-card-title-group">
              <HelpCircle size={16} />
              <h5>كيف يعمل نظام النقاط؟</h5>
            </div>
            <ul className="rew-rules-list">
              <li>
                النقاط تُكتسب من إنجاز المهام التطوعية، التدقيق، والمشاركة
                الفعالة.
              </li>
              <li>الجواهر المشتراة تظل خاصة بك حتى تهديها لزميلك.</li>
              <li>كل جوهرة تستلمها من زميل تضيف 3 نقاط أثر في ترتيبك العام.</li>
              <li>العمليات موثقة وغير قابلة للتراجع إلا عبر إدارة المبادرة.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
