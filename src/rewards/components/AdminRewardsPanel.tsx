import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Coins,
  FileSpreadsheet,
  BadgeCheck,
  Calendar,
  Mic2,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  RotateCcw,
  Plus,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { RewardMember, SupportRequestItem } from "../types";
import { CertificateManager } from "../../components/CertificateManager";

interface AdminRewardsPanelProps {
  members: RewardMember[];
  onDataChanged: () => void;
}

export const AdminRewardsPanel: React.FC<AdminRewardsPanelProps> = ({
  members,
  onDataChanged,
}) => {
  const [adminTab, setAdminTab] = useState<
    "points" | "requests" | "certs" | "activities" | "sessions"
  >("points");

  // Points/Transactions State
  const [targetUid, setTargetUid] = useState("");
  const [pointsAmount, setPointsAmount] = useState("");
  const [pointsReason, setPointsReason] = useState("");
  const [reverseTxId, setReverseTxId] = useState("");
  const [reverseReason, setReverseReason] = useState("");

  // Requests State
  const [allRequests, setAllRequests] = useState<SupportRequestItem[]>([]);
  const [requestReviewModal, setRequestReviewModal] =
    useState<SupportRequestItem | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"approved" | "rejected">(
    "approved",
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewPointsToGrant, setReviewPointsToGrant] = useState("0");

  // Activities State
  const [actTitle, setActTitle] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [actDatetime, setActDatetime] = useState("");
  const [actPoints, setActPoints] = useState("20");
  const [actLink, setActLink] = useState("");

  // Sessions State
  const [sessTitle, setSessTitle] = useState("");
  const [sessDesc, setSessDesc] = useState("");
  const [sessYoutubeUrl, setSessYoutubeUrl] = useState("");
  const [sessSpeakers, setSessSpeakers] = useState("");

  // UI status
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);

  const fetchAdminRequests = useCallback(async () => {
    try {
      const res = await apiFetch("/api/rewards/admin/requests");
      const data = await res.json();
      if (res.ok && data.success) {
        setAllRequests(data.requests || []);
      }
    } catch {
      // Silent error
    }
  }, []);

  useEffect(() => {
    if (adminTab === "requests") {
      void fetchAdminRequests();
    }
  }, [adminTab, fetchAdminRequests]);

  const handleGrantOrDeductPoints = async (isDeduct = false) => {
    const amount = Number(pointsAmount);
    if (
      !targetUid ||
      Number.isNaN(amount) ||
      amount <= 0 ||
      !pointsReason.trim()
    ) {
      setStatusMessage({
        kind: "error",
        text: "يرجى ملء جميع حقول النقاط والعضو والسبب",
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const endpoint = isDeduct
        ? "/api/rewards/admin/deduct-points"
        : "/api/rewards/grant";
      const body = isDeduct
        ? { targetUid, points: amount, reason: pointsReason.trim() }
        : { uid: targetUid, points: amount, reason: pointsReason.trim() };

      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر تعديل النقاط");
      }

      setStatusMessage({
        kind: "ok",
        text: `تم ${isDeduct ? "خصم" : "إضافة"} ${amount} نقطة للعضو بنجاح وتوثيق العملية في السجل.`,
      });
      setPointsAmount("");
      setPointsReason("");
      onDataChanged();
    } catch (err) {
      setStatusMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر تعديل النقاط",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReverseTransaction = async () => {
    if (!reverseTxId.trim() || !reverseReason.trim()) {
      setStatusMessage({
        kind: "error",
        text: "يرجى إدخال معرف المعاملة وسبب العكس",
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch("/api/rewards/admin/reverse-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: reverseTxId.trim(),
          reason: reverseReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر عكس المعاملة");
      }

      setStatusMessage({
        kind: "ok",
        text: "تم عكس المعاملة بنجاح واسترداد الرصيد!",
      });
      setReverseTxId("");
      setReverseReason("");
      onDataChanged();
    } catch (err) {
      setStatusMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر عكس المعاملة",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReviewRequest = async () => {
    if (!requestReviewModal) return;
    setBusy(true);
    setStatusMessage(null);

    try {
      const res = await apiFetch(
        `/api/rewards/admin/requests/${requestReviewModal.id}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: reviewStatus,
            adminNotes: reviewNotes.trim(),
            pointsGranted:
              reviewStatus === "approved"
                ? Number(reviewPointsToGrant) || 0
                : 0,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر مراجعة الطلب");
      }

      setStatusMessage({
        kind: "ok",
        text: "تم حفظ قرار المراجعة وتحديث حالة الطلب بنجاح.",
      });
      setRequestReviewModal(null);
      setReviewNotes("");
      setReviewPointsToGrant("0");
      await fetchAdminRequests();
      onDataChanged();
    } catch (err) {
      setStatusMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر مراجعة الطلب",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim() || !actDesc.trim() || !actDatetime.trim()) {
      setStatusMessage({
        kind: "error",
        text: "العنوان والوصف والموعد مطلوبة",
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const res = await apiFetch("/api/rewards/admin/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: actTitle.trim(),
          description: actDesc.trim(),
          datetime: new Date(actDatetime).toISOString(),
          points: Number(actPoints) || 0,
          link: actLink.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إضافة النشاط");
      }

      setStatusMessage({
        kind: "ok",
        text: "تمت إضافة الفعالية بنجاح وستظهر في الشريط العلوي.",
      });
      setActTitle("");
      setActDesc("");
      setActDatetime("");
      setActLink("");
      onDataChanged();
    } catch (err) {
      setStatusMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر إضافة النشاط",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessTitle.trim() || !sessYoutubeUrl.trim()) {
      setStatusMessage({
        kind: "error",
        text: "عنوان الجلسة ورابط YouTube مطلوبان",
      });
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    try {
      const speakersArray = sessSpeakers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiFetch("/api/rewards/admin/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessTitle.trim(),
          description: sessDesc.trim(),
          youtubeUrl: sessYoutubeUrl.trim(),
          speakers: speakersArray,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "تعذر إضافة الجلسة");
      }

      setStatusMessage({
        kind: "ok",
        text: "تمت إضافة الجلسة المسجلة بنجاح إلى أرشيف الجلسات.",
      });
      setSessTitle("");
      setSessDesc("");
      setSessYoutubeUrl("");
      setSessSpeakers("");
      onDataChanged();
    } catch (err) {
      setStatusMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر إضافة الجلسة",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await apiFetch("/api/rewards/admin/export");
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "تعذر تصدير البيانات");

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ansat-rewards-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatusMessage({
        kind: "error",
        text: err instanceof Error ? err.message : "تعذر التصدير",
      });
    }
  };

  return (
    <div className="rew-admin-layout" dir="rtl">
      {/* Header Banner */}
      <div className="rew-card rew-admin-header-card">
        <div className="rew-admin-title-row">
          <div className="rew-admin-title-group">
            <ShieldCheck size={24} />
            <div>
              <h3>لوحة الإشراف وإدارة منصة التقدير</h3>
              <small>صلاحية إدارية خاصة بمشرفي مكافآت ونقاط مبادرة إنصات</small>
            </div>
          </div>
          <button
            type="button"
            className="rew-export-btn"
            onClick={handleExportBackup}
          >
            <Download size={15} />
            <span>تصدير نسخة احتياطية JSON</span>
          </button>
        </div>

        {/* Admin Navigation Pills */}
        <div className="rew-admin-nav-tabs">
          <button
            type="button"
            className={`rew-admin-tab-btn ${adminTab === "points" ? "active" : ""}`}
            onClick={() => setAdminTab("points")}
          >
            <Coins size={15} />
            <span>إدارة النقاط</span>
          </button>

          <button
            type="button"
            className={`rew-admin-tab-btn ${adminTab === "requests" ? "active" : ""}`}
            onClick={() => setAdminTab("requests")}
          >
            <FileSpreadsheet size={15} />
            <span>
              مراجعة الطلبات (
              {allRequests.filter((r) => r.status === "pending").length})
            </span>
          </button>

          <button
            type="button"
            className={`rew-admin-tab-btn ${adminTab === "certs" ? "active" : ""}`}
            onClick={() => setAdminTab("certs")}
          >
            <BadgeCheck size={15} />
            <span>نظام الشهادات (Certificates)</span>
          </button>

          <button
            type="button"
            className={`rew-admin-tab-btn ${adminTab === "activities" ? "active" : ""}`}
            onClick={() => setAdminTab("activities")}
          >
            <Calendar size={15} />
            <span>إدارة الفعاليات</span>
          </button>

          <button
            type="button"
            className={`rew-admin-tab-btn ${adminTab === "sessions" ? "active" : ""}`}
            onClick={() => setAdminTab("sessions")}
          >
            <Mic2 size={15} />
            <span>إدارة الجلسات</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`rew-form-notice ${statusMessage.kind} my-4`}>
          {statusMessage.kind === "ok" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* ================= TAB 1: Points Management ================= */}
      {adminTab === "points" && (
        <div className="rew-admin-tab-content">
          <div className="rew-admin-2col">
            {/* Grant / Deduct Card */}
            <div className="rew-card">
              <div className="rew-card-head">
                <div className="rew-card-title-group">
                  <Coins size={18} />
                  <h4>إضافة أو خصم نقاط لعضو</h4>
                </div>
              </div>

              <div className="rew-admin-form-box">
                <div className="rew-field-group">
                  <label>اختر العضو المستهدف</label>
                  <select
                    value={targetUid}
                    onChange={(e) => setTargetUid(e.target.value)}
                    required
                  >
                    <option value="">-- اضغط لاختيار العضو --</option>
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.name} ({m.points || 0} نقطة حالياً)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rew-field-group">
                  <label>عدد النقاط</label>
                  <input
                    type="number"
                    min="1"
                    max="50000"
                    placeholder="مثال: 50"
                    value={pointsAmount}
                    onChange={(e) => setPointsAmount(e.target.value)}
                  />
                </div>

                <div className="rew-field-group">
                  <label>سبب العملية (يُسجل في السجل الدائم للأعضاء)</label>
                  <input
                    type="text"
                    placeholder="مثال: مكافأة تسجيل كتاب صوتي كامل / تدقيق 5 ساعات"
                    value={pointsReason}
                    onChange={(e) => setPointsReason(e.target.value)}
                    maxLength={300}
                  />
                </div>

                <div className="rew-admin-btn-row">
                  <button
                    type="button"
                    className="rew-btn-primary green"
                    disabled={
                      busy ||
                      !targetUid ||
                      !pointsAmount ||
                      !pointsReason.trim()
                    }
                    onClick={() => void handleGrantOrDeductPoints(false)}
                  >
                    <Plus size={15} />
                    <span>إضافة النقاط (+)</span>
                  </button>

                  <button
                    type="button"
                    className="rew-btn-primary danger"
                    disabled={
                      busy ||
                      !targetUid ||
                      !pointsAmount ||
                      !pointsReason.trim()
                    }
                    onClick={() => void handleGrantOrDeductPoints(true)}
                  >
                    <Trash2 size={15} />
                    <span>خصم النقاط (-)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Reverse Transaction Card */}
            <div className="rew-card">
              <div className="rew-card-head">
                <div className="rew-card-title-group">
                  <RotateCcw size={18} />
                  <h4>عكس معاملة سابقة (استرداد)</h4>
                </div>
              </div>

              <div className="rew-admin-form-box">
                <p className="rew-card-subdesc">
                  أدخل رقم المعاملة من السجل لاسترجاع رصيد النقاط أو الجواهر في
                  حالة الخطأ.
                </p>

                <div className="rew-field-group">
                  <label>معرف المعاملة (Transaction ID)</label>
                  <input
                    type="text"
                    placeholder="مثال: 1726278192-abcdef"
                    value={reverseTxId}
                    onChange={(e) => setReverseTxId(e.target.value)}
                  />
                </div>

                <div className="rew-field-group">
                  <label>سبب الاسترداد / العكس</label>
                  <input
                    type="text"
                    placeholder="مثال: تصحيح خطأ في القيمة الممنوحة"
                    value={reverseReason}
                    onChange={(e) => setReverseReason(e.target.value)}
                    maxLength={300}
                  />
                </div>

                <button
                  type="button"
                  className="rew-btn-primary"
                  disabled={
                    busy || !reverseTxId.trim() || !reverseReason.trim()
                  }
                  onClick={handleReverseTransaction}
                >
                  <RotateCcw size={15} />
                  <span>تنفيذ عكس المعاملة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: Support Requests Review ================= */}
      {adminTab === "requests" && (
        <div className="rew-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <FileSpreadsheet size={18} />
              <h4>طلبات الأعضاء وشكاويهم المرفوعة</h4>
            </div>
          </div>

          <div className="rew-admin-requests-table">
            <div className="rew-table-head">
              <span>العضو</span>
              <span>النوع</span>
              <span>البيان</span>
              <span>النقاط المطلوبة</span>
              <span>الحالة</span>
              <span>الإجراء</span>
            </div>

            {allRequests.length > 0 ? (
              allRequests.map((req) => (
                <div
                  key={req.id}
                  className={`rew-table-row status-${req.status}`}
                >
                  <span>
                    {req.memberName || req.memberId?.slice(0, 8) || "عضو"}
                  </span>
                  <span>
                    {req.type === "complaint"
                      ? "شكوى"
                      : req.type === "points"
                        ? "مراجعة نقاط"
                        : "طلب شهادة"}
                  </span>
                  <span className="truncate">{req.text}</span>
                  <span>{req.pointsRequested || "—"}</span>
                  <span className={`rew-status-badge ${req.status}`}>
                    {req.status === "approved"
                      ? "مقبول"
                      : req.status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                  </span>
                  <div>
                    <button
                      type="button"
                      className="rew-btn-small"
                      onClick={() => {
                        setRequestReviewModal(req);
                        setReviewStatus("approved");
                        setReviewNotes("");
                        setReviewPointsToGrant(
                          String(req.pointsRequested || 0),
                        );
                      }}
                    >
                      مراجعة والبت
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rew-empty-table-state">
                <p>لا توجد طلبات معلقة حالياً.</p>
              </div>
            )}
          </div>

          {/* Request Review Modal */}
          {requestReviewModal && (
            <div
              className="rew-modal-backdrop"
              onClick={() => setRequestReviewModal(null)}
            >
              <div
                className="rew-modal-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="rew-modal-head">
                  <h4>مراجعة طلب العضو</h4>
                  <button
                    type="button"
                    onClick={() => setRequestReviewModal(null)}
                  >
                    ×
                  </button>
                </div>
                <div className="rew-modal-body">
                  <p>
                    <strong>تفاصيل الطلب:</strong> {requestReviewModal.text}
                  </p>
                  <div className="rew-field-group mt-3">
                    <label>القرار:</label>
                    <select
                      value={reviewStatus}
                      onChange={(e) =>
                        setReviewStatus(
                          e.target.value as "approved" | "rejected",
                        )
                      }
                    >
                      <option value="approved">قبول الطلب ✅</option>
                      <option value="rejected">رفض الطلب ❌</option>
                    </select>
                  </div>

                  {reviewStatus === "approved" &&
                    requestReviewModal.type === "points" && (
                      <div className="rew-field-group">
                        <label>عدد النقاط الممنوحة للعضو:</label>
                        <input
                          type="number"
                          value={reviewPointsToGrant}
                          onChange={(e) =>
                            setReviewPointsToGrant(e.target.value)
                          }
                        />
                      </div>
                    )}

                  <div className="rew-field-group">
                    <label>ملاحظات ورد الإدارة على العضو:</label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="اكتب ملاحظاتك أو سبب القرار..."
                      rows={3}
                    />
                  </div>

                  <div className="rew-modal-action-row">
                    <button
                      type="button"
                      className="rew-btn-primary"
                      disabled={busy}
                      onClick={handleReviewRequest}
                    >
                      <span>حفظ القرار وإبلاغ العضو</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: Issue & Manage Certificates ================= */}
      {adminTab === "certs" && (
        <div className="rew-admin-tab-content">
          <CertificateManager users={members} />
        </div>
      )}

      {/* ================= TAB 4: Upcoming Activities ================= */}
      {adminTab === "activities" && (
        <div className="rew-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <Calendar size={18} />
              <h4>إضافة فعالية أو نشاط قادم</h4>
            </div>
          </div>

          <form onSubmit={handleAddActivity} className="rew-admin-form-box">
            <div className="rew-form-row-2">
              <div className="rew-field-group">
                <label>عنوان النشاط</label>
                <input
                  type="text"
                  placeholder="مثال: ماراثون تسجيل الكتب التاريخية"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  required
                />
              </div>

              <div className="rew-field-group">
                <label>تاريخ وموعد النشاط</label>
                <input
                  type="datetime-local"
                  value={actDatetime}
                  onChange={(e) => setActDatetime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rew-form-row-2">
              <div className="rew-field-group">
                <label>مكافأة المشاركة (نقاط)</label>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={actPoints}
                  onChange={(e) => setActPoints(e.target.value)}
                />
              </div>

              <div className="rew-field-group">
                <label>رابط التسجيل / الانضمام (اختياري)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={actLink}
                  onChange={(e) => setActLink(e.target.value)}
                />
              </div>
            </div>

            <div className="rew-field-group">
              <label>وصف النشاط والشروط</label>
              <textarea
                value={actDesc}
                onChange={(e) => setActDesc(e.target.value)}
                placeholder="تفاصيل النشاط وشروطه وما هو مطلوب من المتطوعين..."
                rows={3}
                required
              />
            </div>

            <button
              type="submit"
              className="rew-btn-primary"
              disabled={
                busy ||
                !actTitle.trim() ||
                !actDesc.trim() ||
                !actDatetime.trim()
              }
            >
              <Calendar size={16} />
              <span>نشر الفعالية في شريط الأنشطة</span>
            </button>
          </form>
        </div>
      )}

      {/* ================= TAB 5: Recorded Sessions ================= */}
      {adminTab === "sessions" && (
        <div className="rew-card">
          <div className="rew-card-head">
            <div className="rew-card-title-group">
              <Mic2 size={18} />
              <h4>إضافة ورشة عمل أو جلسة مسجلة</h4>
            </div>
          </div>

          <form onSubmit={handleAddSession} className="rew-admin-form-box">
            <div className="rew-form-row-2">
              <div className="rew-field-group">
                <label>عنوان الجلسة</label>
                <input
                  type="text"
                  placeholder="مثال: ورشة أسرار المونتاج الصوتي وإزالة الضوضاء"
                  value={sessTitle}
                  onChange={(e) => setSessTitle(e.target.value)}
                  required
                />
              </div>

              <div className="rew-field-group">
                <label>رابط YouTube للجلسة</label>
                <input
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={sessYoutubeUrl}
                  onChange={(e) => setSessYoutubeUrl(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="rew-field-group">
              <label>المتحدثون (مفصولين بفاصلة)</label>
              <input
                type="text"
                placeholder="مثال: م. علي الحسين, أ. رغد نزار"
                value={sessSpeakers}
                onChange={(e) => setSessSpeakers(e.target.value)}
              />
            </div>

            <div className="rew-field-group">
              <label>وصف ملخص للجلسة وأبرز محاورها</label>
              <textarea
                value={sessDesc}
                onChange={(e) => setSessDesc(e.target.value)}
                placeholder="شرح مختصر لما تم تناوله في الورشة من مهارات وأدوات..."
                rows={3}
              />
            </div>

            <button
              type="submit"
              className="rew-btn-primary"
              disabled={busy || !sessTitle.trim() || !sessYoutubeUrl.trim()}
            >
              <Mic2 size={16} />
              <span>نشر الجلسة في الأرشيف</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
