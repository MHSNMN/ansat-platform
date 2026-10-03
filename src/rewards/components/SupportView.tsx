import React, { useState, useEffect, useCallback } from "react";
import {
  CircleHelp,
  AlertTriangle,
  Coins,
  BadgeCheck,
  Send,
  Clock,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { SupportRequestItem } from "../types";

export const SupportView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<
    "complaint" | "points" | "certificate"
  >("complaint");
  const [requests, setRequests] = useState<SupportRequestItem[]>([]);
  const [text, setText] = useState("");
  const [pointsRequested, setPointsRequested] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const fetchMyRequests = useCallback(async () => {
    try {
      const res = await apiFetch("/api/rewards/support-requests/me");
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.requests || []);
      }
    } catch {
      // Silent error
    }
  }, []);

  useEffect(() => {
    void fetchMyRequests();
  }, [fetchMyRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length < 5) {
      setNotice({
        kind: "error",
        text: "يرجى كتابة تفاصيل الطلب بشكل كافٍ (5 أحرف على الأقل)",
      });
      return;
    }

    setSubmitting(true);
    setNotice(null);
    try {
      const res = await apiFetch("/api/rewards/support-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeSubTab,
          text: text.trim(),
          pointsRequested:
            activeSubTab === "points"
              ? Number(pointsRequested) || 0
              : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إرسال الطلب");
      }

      setNotice({
        kind: "ok",
        text: "تم إرسال طلبك بنجاح إلى الإدارة وسيتم مراجعته والرد عليك قريباً.",
      });
      setText("");
      setPointsRequested("");
      await fetchMyRequests();
    } catch (err) {
      setNotice({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر إرسال الطلب",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat("ar-IQ", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  const getSubTabInfo = () => {
    switch (activeSubTab) {
      case "complaint":
        return {
          title: "تقديم شكوى أو ملاحظة سرية",
          desc: "إذا واجهت أي صعوبة أو ملاحظة تتعلق بسير العمل، التسجيلات، أو التعاملات، ارفعها هنا بسرية تامة للإشراف.",
          icon: AlertTriangle,
          placeholder: "اكتب تفاصيل الشكوى أو الملاحظة بوضوح ودقة...",
        };
      case "points":
        return {
          title: "طلب مراجعة أو احتساب نقاط",
          desc: "هل أنجزت مهمة أو تدقيقاً ولم تُحتسب نقاطه في رصيدك؟ ارفع طلب مراجعة مع تحديد المهمة وتاريخها.",
          icon: Coins,
          placeholder:
            "ما هي المهمة أو التسجيل الصوتي الذي تطلب احتساب نقاطه؟ اذكر الرابط أو اسم المهمة...",
        };
      case "certificate":
        return {
          title: "طلب إصدار شهادة تقديرية",
          desc: "المتطوعون الذين أتموا ساعات تسجيل معينة أو أسهموا بشكل ملحوظ يحق لهم طلب شهادة تقدير معتمدة.",
          icon: BadgeCheck,
          placeholder:
            "اذكر سبب طلب الشهادة، والاسم الثلاثي المطلوب ظهوره في الشهادة...",
        };
    }
  };

  const currentTabInfo = getSubTabInfo();
  const SubTabIcon = currentTabInfo.icon;

  return (
    <div className="rew-support-layout" dir="rtl">
      {/* ================= Request Submission Column ================= */}
      <div className="rew-col-request-form">
        <div className="rew-card rew-support-form-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <CircleHelp size={18} />
              <h4>مركز الدعم والتواصل مع الإدارة</h4>
            </div>
          </div>

          {/* 3 Sub-tabs */}
          <div className="rew-support-subtabs">
            <button
              type="button"
              className={`rew-subtab-btn ${activeSubTab === "complaint" ? "active" : ""}`}
              onClick={() => setActiveSubTab("complaint")}
            >
              <AlertTriangle size={15} />
              <span>تقديم شكوى</span>
            </button>

            <button
              type="button"
              className={`rew-subtab-btn ${activeSubTab === "points" ? "active" : ""}`}
              onClick={() => setActiveSubTab("points")}
            >
              <Coins size={15} />
              <span>مراجعة نقاط</span>
            </button>

            <button
              type="button"
              className={`rew-subtab-btn ${activeSubTab === "certificate" ? "active" : ""}`}
              onClick={() => setActiveSubTab("certificate")}
            >
              <BadgeCheck size={15} />
              <span>طلب شهادة</span>
            </button>
          </div>

          <div className="rew-subtab-info-box">
            <div className="rew-subtab-info-icon">
              <SubTabIcon size={18} />
            </div>
            <div>
              <strong>{currentTabInfo.title}</strong>
              <p>{currentTabInfo.desc}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rew-support-form">
            {activeSubTab === "points" && (
              <div className="rew-field-group">
                <label>عدد النقاط المتوقع احتسابها</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  placeholder="مثلاً: 25"
                  value={pointsRequested}
                  onChange={(e) => setPointsRequested(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="rew-field-group">
              <label>التفاصيل والبيان (مطلوب)</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={currentTabInfo.placeholder}
                rows={5}
                required
              />
            </div>

            {notice && (
              <div className={`rew-form-notice ${notice.kind}`}>
                {notice.kind === "ok" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <span>{notice.text}</span>
              </div>
            )}

            <div className="rew-form-footer">
              <button
                type="submit"
                className="rew-btn-primary"
                disabled={submitting || text.trim().length < 5}
              >
                <Send size={15} />
                <span>
                  {submitting ? "جارٍ الإرسال..." : "إرسال الطلب للإدارة"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ================= Past Requests Column ================= */}
      <div className="rew-col-request-history">
        <div className="rew-card rew-requests-history-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <Clock size={18} />
              <h4>سجل طلباتي السابقة</h4>
            </div>
            <span className="rew-card-tag">{requests.length} طلبات</span>
          </div>

          {requests.length > 0 ? (
            <div className="rew-req-list">
              {requests.map((req) => {
                const typeLabel =
                  req.type === "complaint"
                    ? "شكوى"
                    : req.type === "points"
                      ? `مراجعة نقاط (${req.pointsRequested || 0} نقطة)`
                      : "طلب شهادة";

                const statusClass =
                  req.status === "approved"
                    ? "status-approved"
                    : req.status === "rejected"
                      ? "status-rejected"
                      : "status-pending";

                const statusLabel =
                  req.status === "approved"
                    ? "معتمد"
                    : req.status === "rejected"
                      ? "مرفوض"
                      : "قيد المراجعة";

                return (
                  <div key={req.id} className="rew-req-item">
                    <div className="rew-req-item-top">
                      <span className="rew-req-type-pill">{typeLabel}</span>
                      <span className={`rew-req-status-pill ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <p className="rew-req-text">{req.text}</p>

                    {req.adminNotes && (
                      <div className="rew-req-admin-note">
                        <MessageSquare size={13} />
                        <div>
                          <strong>رد الإدارة:</strong>
                          <span>{req.adminNotes}</span>
                        </div>
                      </div>
                    )}

                    <div className="rew-req-item-meta">
                      <Clock size={12} />
                      <small>{formatDate(req.createdAt)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rew-empty-card-state">
              <CircleHelp size={28} />
              <p>لم تقدم أي طلبات أو شكاوى سابقة.</p>
              <small>
                أي طلب تقدمه سيظهر هنا مع تحديثات الإدارة وملاحظاتها.
              </small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
