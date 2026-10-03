import React, { useState } from "react";
import {
  Award,
  Crown,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { HonorBadgeDef, RewardMember } from "../types";

interface HallOfFameViewProps {
  members: RewardMember[];
  userPoints: number;
  onNominationSuccess: () => void;
}

const HONOR_BADGES_CATALOG: HonorBadgeDef[] = [
  {
    key: "audio_mastery",
    title: "وسام الإتقان الصوتي",
    icon: "🎙️",
    description:
      "يُمنح للمتطوع الذي تميزت تسجيلاته بالوضوح الفائق، النبرة المؤثرة، والالتزام بأعلى معايير الجودة الصوتية.",
    color: "#8A53FF",
  },
  {
    key: "collaboration",
    title: "وسام التعاون المثالي",
    icon: "🤝",
    description:
      "يُمنح للعضو الأكثر دعماً ومساندة لزملائه في تدقيق النصوص، تبادل الخبرات، والمساعدة بروح الفريق.",
    color: "#2E9E5B",
  },
  {
    key: "speed_achievement",
    title: "وسام السرعة والإنجاز",
    icon: "⚡",
    description:
      "يُمنح لمن أظهر سرعة استثنائية في تسليم المهام مع الحفاظ على الدقة والإتقان التام.",
    color: "#F5A600",
  },
  {
    key: "leadership_inspiration",
    title: "وسام القيادة والإلهام",
    icon: "👑",
    description:
      "يُمنح للمبادرين الذين يلهمون الفريق بحماسهم، أفكارهم التطويرية، وطاقتهم الإيجابية المستمرة.",
    color: "#D8473F",
  },
  {
    key: "narration_excellence",
    title: "وسام القراءة المتميزة",
    icon: "📖",
    description:
      "يُمنح للأداء التعبيري البارع الذي ينقل مشاعر الكتاب ويجذب المستمعين بأسلوب سردي جذاب.",
    color: "#1F5B78",
  },
];

export const HallOfFameView: React.FC<HallOfFameViewProps> = ({
  members,
  userPoints,
  onNominationSuccess,
}) => {
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedBadge, setSelectedBadge] = useState(
    HONOR_BADGES_CATALOG[0].key,
  );
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const NOMINATION_COST = 7;
  const canAfford = userPoints >= NOMINATION_COST;

  const handleSubmitNomination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) {
      setStatusMessage({ kind: "error", text: "يرجى اختيار الزميل المرشح" });
      return;
    }
    if (reason.trim().length < 10) {
      setStatusMessage({
        kind: "error",
        text: "يرجى كتابة سبب مفصل للترشيح (10 أحرف على الأقل)",
      });
      return;
    }
    if (!canAfford) {
      setStatusMessage({
        kind: "error",
        text: `رصيدك (${userPoints} نقطة) لا يكفي لرسوم الترشيح (${NOMINATION_COST} نقاط)`,
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch("/api/rewards/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateUid: selectedMember,
          badgeKey: selectedBadge,
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إرسال الترشيح");
      }

      setStatusMessage({
        kind: "ok",
        text: "تم رفع ترشيحك بنجاح إلى الإدارة! خُصمت 7 نقاط كرسوم ترشيح موثقة.",
      });
      setReason("");
      setSelectedMember("");
      onNominationSuccess();
    } catch (err) {
      setStatusMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر إرسال الترشيح",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rew-hof-layout" dir="rtl">
      {/* Introduction Hero */}
      <div className="rew-card rew-hof-intro">
        <div className="rew-hof-intro-content">
          <div className="rew-hof-intro-tag">
            <Crown size={18} />
            <span>لوحة الشرف والأوسمة</span>
          </div>
          <h2>تقدير البصمات الاستثنائية في مسيرة إنصات</h2>
          <p>
            أوسمة الشرف ليست مجرد أرقام، بل هي اعتراف مجتمعي ورسمي بالعطاء
            المتميز. يمكنك ترشيح زميلك المبدع لينال وساماً رسمياً يُضاف إلى ملفه
            الدائم.
          </p>
        </div>
      </div>

      <div className="rew-hof-grid">
        {/* ================= Catalog of 5 Honor Badges ================= */}
        <div className="rew-col-badges">
          <div className="rew-card rew-catalog-card">
            <div className="rew-card-head">
              <div className="rew-card-title-group">
                <Award size={18} />
                <h4>كتالوج أوسمة الشرف</h4>
              </div>
              <span className="rew-card-tag">5 أوسمة</span>
            </div>

            <div className="rew-badges-catalog-list">
              {HONOR_BADGES_CATALOG.map((badge) => (
                <div key={badge.key} className="rew-catalog-badge-item">
                  <div
                    className="rew-catalog-badge-icon"
                    style={{
                      backgroundColor: `${badge.color}15`,
                      borderColor: badge.color,
                    }}
                  >
                    <span>{badge.icon}</span>
                  </div>
                  <div className="rew-catalog-badge-meta">
                    <strong style={{ color: badge.color }}>
                      {badge.title}
                    </strong>
                    <p>{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= Nomination Form ================= */}
        <div className="rew-col-nomination">
          <div className="rew-card rew-nominate-card">
            <div className="rew-card-head">
              <div className="rew-card-title-group">
                <Sparkles size={18} />
                <h4>رشّح زميلاً للحصول على وسام</h4>
              </div>
              <span className="rew-cost-tag">
                تكلفة الترشيح: {NOMINATION_COST} نقاط
              </span>
            </div>

            <p className="rew-card-subdesc">
              تُخصم {NOMINATION_COST} نقاط من رصيدك عند إرسال الترشيح لضمان جدية
              الترشيحات ومصداقيتها. تراجع لجنة الإشراف الترشيح وتعتمد الوسام.
            </p>

            <form
              onSubmit={handleSubmitNomination}
              className="rew-nominate-form"
            >
              <div className="rew-field-group">
                <label>اختر الزميل المرشح</label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
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
                <label>الوسام المقترح</label>
                <select
                  value={selectedBadge}
                  onChange={(e) => setSelectedBadge(e.target.value)}
                  required
                >
                  {HONOR_BADGES_CATALOG.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.icon} {b.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rew-field-group">
                <label>سبب الترشيح والأثر الملاحظ (مطلوب)</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ما هو الموقف أو الإنجاز الاستثنائي الذي أظهره هذا الزميل ويستحق عليه التكريم؟"
                  rows={4}
                  required
                />
              </div>

              {statusMessage && (
                <div className={`rew-form-notice ${statusMessage.kind}`}>
                  {statusMessage.kind === "ok" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <div className="rew-form-footer">
                <span className="rew-wallet-hint">
                  رصيدك الحالي: <strong>{userPoints} نقطة</strong>
                </span>
                <button
                  type="submit"
                  className="rew-btn-primary"
                  disabled={
                    isSubmitting ||
                    !canAfford ||
                    !selectedMember ||
                    reason.trim().length < 10
                  }
                >
                  <Send size={15} />
                  <span>
                    {isSubmitting ? "جارٍ الإرسال..." : "رفع الترشيح للإدارة"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
