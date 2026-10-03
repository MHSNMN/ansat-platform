import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Award,
  Plus,
  Search,
  QrCode,
  Ban,
  Download,
  ExternalLink,
  Loader2,
  X,
  AlertTriangle,
  CheckCircle,
  Trash2,
  RefreshCw,
  Edit,
  Calendar,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Filter,
  Sparkles,
  User,
  Hash,
} from "lucide-react";
import { apiFetch } from "../lib/api";

interface CertificateManagerProps {
  users?: Array<{
    id?: string;
    uid?: string;
    name?: string;
    username?: string;
    email?: string;
  }>;
}

export interface CertificateItem {
  id: string;
  code: string;
  targetUid?: string;
  memberId?: string;
  targetName?: string;
  recipientName?: string;
  achievement?: string;
  reason?: string;
  certType?: string;
  grantingEntity?: string;
  responsibleName?: string;
  role?: string;
  points?: number;
  issuedAt?: string;
  issuedBy?: string;
  status: "valid" | "revoked" | string;
  revokedAt?: string | null;
  revokeReason?: string | null;
  publiclyVerifiable?: boolean;
}

const CERTIFICATE_TYPES = [
  "Certificate of Appreciation",
  "Certificate of Volunteer Excellence",
  "Certificate of Audio Production Excellence",
  "Certificate of Recognition & Honor",
  "Certificate of Completion",
  "Certificate of Outstanding Contribution",
];

function generateRandomCertCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "INS-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function toDateInputValue(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

function formatEnglishDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function CertificateManager({ users = [] }: CertificateManagerProps) {
  const [certs, setCerts] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "revoked">(
    "all",
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Issue Modal State
  const [showIssue, setShowIssue] = useState(false);
  const [issueData, setIssueData] = useState({
    targetUid: "",
    targetName: "",
    code: generateRandomCertCode(),
    issuedAt: toDateInputValue(),
    certType: "Certificate of Appreciation",
    achievement: "",
    role: "MEMBER",
  });

  // Edit Modal State
  const [editingCert, setEditingCert] = useState<CertificateItem | null>(null);
  const [editData, setEditData] = useState({
    code: "",
    recipientName: "",
    issuedAt: "",
    certType: "",
    achievement: "",
    status: "valid",
    revokeReason: "",
  });

  // Action modals
  const [revokingCert, setRevokingCert] = useState<CertificateItem | null>(
    null,
  );
  const [revokeReason, setRevokeReason] = useState("");
  const [deletingCert, setDeletingCert] = useState<CertificateItem | null>(
    null,
  );
  const [qrModalCert, setQrModalCert] = useState<CertificateItem | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  const [busy, setBusy] = useState<string>("");
  const [notice, setNotice] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const showToast = (
    text: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setNotice({ text, type });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const loadCerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/certificates/all");
      const data = await res.json();
      if (res.ok && data.success) {
        setCerts(data.certificates || []);
      } else {
        showToast(data.error || "Failed to load certificates", "error");
      }
    } catch (err: any) {
      showToast(
        "Network error while loading certificates: " + err.message,
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCerts();
  }, [loadCerts]);

  // Handle Copy Code
  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Open Issue Modal with fresh state
  const handleOpenIssueModal = () => {
    setIssueData({
      targetUid: "",
      targetName: "",
      code: generateRandomCertCode(),
      issuedAt: toDateInputValue(),
      certType: "Certificate of Appreciation",
      achievement: "",
      role: "MEMBER",
    });
    setShowIssue(true);
  };

  // Submit Issue
  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueData.targetName.trim()) {
      showToast("Please enter the recipient's name", "error");
      return;
    }
    if (!issueData.achievement.trim()) {
      showToast("Please enter the achievement / citation reason", "error");
      return;
    }
    if (!issueData.code.trim()) {
      showToast("Please enter or generate a certificate code", "error");
      return;
    }

    setBusy("issue");
    try {
      const res = await apiFetch("/api/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUid: issueData.targetUid || undefined,
          targetName: issueData.targetName.trim(),
          recipientName: issueData.targetName.trim(),
          code: issueData.code.trim().toUpperCase(),
          issuedAt: issueData.issuedAt,
          certType: issueData.certType,
          achievement: issueData.achievement.trim(),
          role: issueData.role,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Certificate (${data.code}) issued successfully!`, "success");
        setShowIssue(false);
        void loadCerts();
      } else {
        showToast(data.error || "Failed to issue certificate", "error");
      }
    } catch (err: any) {
      showToast("Error issuing certificate: " + err.message, "error");
    } finally {
      setBusy("");
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (cert: CertificateItem) => {
    setEditingCert(cert);
    setEditData({
      code: cert.code || cert.id,
      recipientName: cert.recipientName || cert.targetName || "",
      issuedAt: toDateInputValue(cert.issuedAt),
      certType: cert.certType || "Certificate of Appreciation",
      achievement: cert.reason || cert.achievement || "",
      status: cert.status || "valid",
      revokeReason: cert.revokeReason || "",
    });
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCert) return;

    if (!editData.recipientName.trim()) {
      showToast("Recipient name cannot be empty", "error");
      return;
    }
    if (!editData.code.trim()) {
      showToast("Certificate code cannot be empty", "error");
      return;
    }
    if (!editData.achievement.trim()) {
      showToast("Achievement / reason cannot be empty", "error");
      return;
    }

    setBusy("edit_" + editingCert.id);
    try {
      const res = await apiFetch(`/api/certificates/${editingCert.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editData.code.trim().toUpperCase(),
          recipientName: editData.recipientName.trim(),
          targetName: editData.recipientName.trim(),
          issuedAt: editData.issuedAt,
          certType: editData.certType,
          achievement: editData.achievement.trim(),
          reason: editData.achievement.trim(),
          status: editData.status,
          revokeReason:
            editData.status === "revoked" ? editData.revokeReason : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Certificate updated successfully!", "success");
        setEditingCert(null);
        void loadCerts();
      } else {
        showToast(data.error || "Failed to update certificate", "error");
      }
    } catch (err: any) {
      showToast("Network error: " + err.message, "error");
    } finally {
      setBusy("");
    }
  };

  // Revoke certificate
  const confirmRevoke = async () => {
    if (!revokingCert) return;
    setBusy("revoke_" + revokingCert.id);
    try {
      const res = await apiFetch(
        `/api/certificates/${revokingCert.id}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: revokeReason.trim() || "Revoked by administration",
          }),
        },
      );
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Certificate revoked successfully", "success");
        setRevokingCert(null);
        setRevokeReason("");
        void loadCerts();
      } else {
        showToast(data.error || "Failed to revoke certificate", "error");
      }
    } catch (err: any) {
      showToast("Error revoking certificate: " + err.message, "error");
    } finally {
      setBusy("");
    }
  };

  // Delete certificate permanently
  const confirmDelete = async () => {
    if (!deletingCert) return;
    setBusy("delete_" + deletingCert.id);
    try {
      const res = await apiFetch(`/api/certificates/${deletingCert.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Certificate record deleted permanently", "success");
        setDeletingCert(null);
        void loadCerts();
      } else {
        showToast(data.error || "Failed to delete certificate", "error");
      }
    } catch (err: any) {
      showToast("Error deleting certificate: " + err.message, "error");
    } finally {
      setBusy("");
    }
  };

  // Open QR modal
  const handleOpenQr = async (cert: CertificateItem) => {
    try {
      const { default: QRCode } = await import("qrcode");
      const verifyCode = cert.code || cert.id;
      const verifyUrl = `${window.location.origin}/verify/${verifyCode}`;
      const url = await QRCode.toDataURL(verifyUrl, { width: 320, margin: 2 });
      setQrDataUrl(url);
      setQrModalCert(cert);
    } catch {
      showToast("Could not generate QR code", "error");
    }
  };

  // Generate Authentic PDF in English
  const generatePDF = async (cert: CertificateItem) => {
    setBusy("pdf_" + cert.id);
    try {
      const [{ jsPDF }, { default: QRCode }] = await Promise.all([
        import("jspdf"),
        import("qrcode"),
      ]);
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const verifyCode = cert.code || cert.id;
      const verifyUrl = `${window.location.origin}/verify/${verifyCode}`;
      const qrImage = await QRCode.toDataURL(verifyUrl, {
        width: 250,
        margin: 1,
      });

      // Clean White Background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 297, 210, "F");

      // Gold vertical ribbon on left
      doc.setFillColor(212, 175, 55);
      doc.rect(0, 0, 18, 210, "F");
      doc.setFillColor(238, 216, 138);
      doc.rect(18, 0, 6, 210, "F");

      // Outer gold borders
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.8);
      doc.rect(28, 8, 260, 194);
      doc.setLineWidth(0.2);
      doc.rect(30, 10, 256, 190);

      // Top Crest
      doc.setFillColor(212, 175, 55);
      doc.circle(160, 32, 12, "F");
      doc.setFillColor(255, 255, 255);
      doc.circle(160, 32, 10, "F");
      doc.setTextColor(212, 175, 55);
      doc.setFontSize(10);
      doc.text("ENSAT", 160, 33.5, { align: "center" });

      // Header title
      doc.setTextColor(180, 130, 20);
      doc.setFontSize(24);
      doc.text(cert.certType || "Certificate of Appreciation", 160, 53, {
        align: "center",
      });

      doc.setTextColor(130, 130, 130);
      doc.setFontSize(10);
      doc.text("OFFICIAL DIGITAL RECOGNITION & VOLUNTEER EXCELLENCE", 160, 61, {
        align: "center",
      });

      // Presentation text
      doc.setTextColor(90, 90, 90);
      doc.setFontSize(13);
      doc.text("This official certificate is proudly presented to", 160, 76, {
        align: "center",
      });

      // Recipient name
      doc.setTextColor(24, 32, 47);
      doc.setFontSize(26);
      const recipientName =
        cert.recipientName || cert.targetName || "Valued Contributor";
      doc.text(recipientName, 160, 94, { align: "center" });

      // Underline gold line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.6);
      doc.line(95, 99, 225, 99);

      // Achievement Reason
      doc.setTextColor(60, 70, 85);
      doc.setFontSize(12);
      const reasonText =
        cert.reason ||
        cert.achievement ||
        "In recognition of outstanding dedication, volunteer excellence, and valuable contributions to the Ensat Initiative.";
      doc.text(reasonText, 160, 114, { align: "center", maxWidth: 195 });

      // Revoked Watermark if revoked
      const isRevoked = cert.status === "revoked" || cert.status === "REVOKED";
      if (isRevoked) {
        doc.setTextColor(225, 29, 72);
        doc.setFontSize(40);
        doc.text("REVOKED / INVALID", 160, 136, { align: "center" });
      }

      // Bottom section: Signer & Official QR Code
      const issuedDateStr = formatEnglishDate(cert.issuedAt);

      // Left Signer
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.text(cert.responsibleName || "General Supervisor", 75, 154, {
        align: "center",
      });
      doc.setLineWidth(0.3);
      doc.setDrawColor(170, 170, 170);
      doc.line(48, 160, 102, 160);
      doc.setFontSize(9.5);
      doc.setTextColor(110, 110, 110);
      doc.text(
        cert.grantingEntity || "Ensat Initiative Administration",
        75,
        166,
        { align: "center" },
      );
      doc.text(`Issue Date: ${issuedDateStr}`, 75, 172, { align: "center" });

      // Right QR Code
      doc.addImage(qrImage, "PNG", 215, 140, 35, 35);
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Certificate ID: ${verifyCode}`, 232.5, 180, {
        align: "center",
      });
      doc.text("Scan QR to verify authenticity", 232.5, 184, {
        align: "center",
      });

      // Bottom Barcode simulation line and Footer
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.4);
      doc.line(35, 192, 280, 192);

      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Official Digital Verification Record: ${verifyUrl}`, 160, 197, {
        align: "center",
      });

      doc.save(`Certificate_${verifyCode}.pdf`);
      showToast(
        "Certificate PDF generated and downloaded successfully!",
        "success",
      );
    } catch (err: any) {
      showToast("Failed to generate PDF: " + err.message, "error");
    } finally {
      setBusy("");
    }
  };

  // Filtered certificates
  const filteredCerts = useMemo(() => {
    return certs.filter((c) => {
      // Status filter
      const isRevoked = c.status === "revoked" || c.status === "REVOKED";
      if (statusFilter === "valid" && isRevoked) return false;
      if (statusFilter === "revoked" && !isRevoked) return false;

      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      return (
        (c.targetName || "").toLowerCase().includes(q) ||
        (c.recipientName || "").toLowerCase().includes(q) ||
        (c.code || "").toLowerCase().includes(q) ||
        (c.id || "").toLowerCase().includes(q) ||
        (c.certType || "").toLowerCase().includes(q) ||
        (c.achievement || "").toLowerCase().includes(q) ||
        (c.reason || "").toLowerCase().includes(q)
      );
    });
  }, [certs, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = certs.length;
    const revoked = certs.filter(
      (c) => c.status === "revoked" || c.status === "REVOKED",
    ).length;
    const valid = total - revoked;
    return { total, valid, revoked };
  }, [certs]);

  return (
    <div
      className="bg-slate-900 p-5 sm:p-7 rounded-2xl border border-slate-800 space-y-6 text-slate-100 font-sans"
      dir="ltr"
    >
      {/* ================= Header & Actions ================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-400/10 text-amber-400 rounded-xl border border-amber-400/20">
              <Award size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Certificate Management System
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Issue official certificates, customize INS- codes, adjust issue
                dates, and manage digital credentials.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => void loadCerts()}
            disabled={loading}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 transition flex items-center justify-center gap-1.5 text-xs font-bold shrink-0"
            title="Refresh certificate list"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin text-amber-400" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleOpenIssueModal}
            className="flex-1 sm:flex-initial bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 text-xs sm:text-sm transition cursor-pointer"
          >
            <Plus size={18} />
            <span>Issue New Certificate</span>
          </button>
        </div>
      </div>

      {/* ================= Notification Toast ================= */}
      {notice && (
        <div
          className={`p-3.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 shadow-md transition-all ${
            notice.type === "error"
              ? "bg-rose-950/80 border border-rose-500/80 text-rose-200"
              : notice.type === "info"
                ? "bg-sky-950/80 border border-sky-500/80 text-sky-200"
                : "bg-emerald-950/80 border border-emerald-500/80 text-emerald-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notice.type === "error" ? (
              <AlertTriangle size={18} className="text-rose-400 shrink-0" />
            ) : notice.type === "info" ? (
              <FileText size={18} className="text-sky-400 shrink-0" />
            ) : (
              <CheckCircle size={18} className="text-emerald-400 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="p-1 hover:opacity-75 text-slate-400"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ================= Stats and Quick Filters ================= */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setStatusFilter("all")}
          className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
            statusFilter === "all"
              ? "bg-slate-800/90 border-amber-400/60 shadow-md"
              : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Issued
            </span>
            <span className="text-xl sm:text-2xl font-black text-white">
              {stats.total}
            </span>
          </div>
          <Award size={22} className="text-amber-400 opacity-60" />
        </button>

        <button
          onClick={() => setStatusFilter("valid")}
          className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
            statusFilter === "valid"
              ? "bg-emerald-950/40 border-emerald-500/60 shadow-md"
              : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
              Active & Valid
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-300">
              {stats.valid}
            </span>
          </div>
          <ShieldCheck size={22} className="text-emerald-400 opacity-60" />
        </button>

        <button
          onClick={() => setStatusFilter("revoked")}
          className={`p-3.5 rounded-2xl border text-left transition flex items-center justify-between ${
            statusFilter === "revoked"
              ? "bg-rose-950/40 border-rose-500/60 shadow-md"
              : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
          }`}
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 block">
              Revoked
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-300">
              {stats.revoked}
            </span>
          </div>
          <Ban size={22} className="text-rose-400 opacity-60" />
        </button>
      </div>

      {/* ================= Search & Filter Bar ================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 flex items-center gap-2.5 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 focus-within:border-amber-400 transition">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by recipient name, certificate code (INS-XXXX), or achievement..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-xs sm:text-sm w-full text-white placeholder:text-slate-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-white p-1"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5 px-1">
            <Filter size={14} /> Filter:
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 outline-none focus:border-amber-400"
          >
            <option value="all">All Certificates ({stats.total})</option>
            <option value="valid">Active & Valid ({stats.valid})</option>
            <option value="revoked">Revoked ({stats.revoked})</option>
          </select>
        </div>
      </div>

      {/* ================= ISSUE CERTIFICATE MODAL ================= */}
      {showIssue && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleIssue}
            className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-xl space-y-4 shadow-2xl relative my-8"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-400/20 text-amber-400 rounded-xl">
                  <Award size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">
                    Issue Official Certificate
                  </h3>
                  <p className="text-xs text-slate-400">
                    Enter recipient name manually and customize code or date.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIssue(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipient Name (Manual Entry) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>Member / Recipient Full Name (Manual Entry) *</span>
                <span className="text-[11px] text-amber-400 font-normal">
                  Type any member name directly
                </span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. John Doe / Sarah Smith"
                value={issueData.targetName}
                onChange={(e) =>
                  setIssueData({ ...issueData, targetName: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400"
              />
            </div>

            {/* Optional autofill from member list */}
            {users.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5">
                  <User size={13} />
                  <span>
                    Quick autofill from registered members (Optional):
                  </span>
                </label>
                <select
                  value={issueData.targetUid}
                  onChange={(e) => {
                    const uid = e.target.value;
                    const u = users.find((x) => x.id === uid || x.uid === uid);
                    setIssueData({
                      ...issueData,
                      targetUid: uid,
                      targetName: u
                        ? u.name || issueData.targetName
                        : issueData.targetName,
                    });
                  }}
                  className="w-full bg-slate-950/70 border border-slate-800 p-2.5 rounded-xl text-slate-300 text-xs outline-none focus:border-amber-400"
                >
                  <option value="">
                    -- Choose member to auto-fill name (or type above manually)
                    --
                  </option>
                  {users.map((u) => (
                    <option key={u.id || u.uid} value={u.id || u.uid}>
                      {u.name}{" "}
                      {u.username
                        ? `(@${u.username})`
                        : u.email
                          ? `(${u.email})`
                          : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Certificate Code & Issue Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                    <Hash size={13} /> Certificate Code *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setIssueData({
                        ...issueData,
                        code: generateRandomCertCode(),
                      })
                    }
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-bold"
                  >
                    <Sparkles size={11} /> Generate
                  </button>
                </div>
                <input
                  required
                  type="text"
                  placeholder="INS-XXXXXX"
                  value={issueData.code}
                  onChange={(e) =>
                    setIssueData({
                      ...issueData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-amber-400 font-mono font-bold text-xs sm:text-sm outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Starts with INS-... (fully editable)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar size={13} /> Issuance Date *
                </label>
                <input
                  required
                  type="date"
                  value={issueData.issuedAt}
                  onChange={(e) =>
                    setIssueData({ ...issueData, issuedAt: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Select any date or keep today
                </span>
              </div>
            </div>

            {/* Certificate Type */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Certificate Type *
              </label>
              <select
                value={issueData.certType}
                onChange={(e) =>
                  setIssueData({ ...issueData, certType: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400"
              >
                {CERTIFICATE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Citation / Achievement Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Achievement / Citation Reason *
              </label>
              <textarea
                required
                rows={3}
                placeholder="e.g. In recognition of outstanding dedication and volunteer excellence in audio narration and production quality..."
                value={issueData.achievement}
                onChange={(e) =>
                  setIssueData({ ...issueData, achievement: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowIssue(false)}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs sm:text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy === "issue"}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md"
              >
                {busy === "issue" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Award size={16} />
                )}
                <span>Issue Certificate</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= EDIT CERTIFICATE MODAL ================= */}
      {editingCert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-xl space-y-4 shadow-2xl relative my-8"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
                  <Edit size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-white">
                    Edit Certificate Details
                  </h3>
                  <p className="text-xs text-slate-400">
                    Modify certificate code, recipient name, or issuance date.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCert(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Recipient Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Recipient Name *
              </label>
              <input
                required
                type="text"
                value={editData.recipientName}
                onChange={(e) =>
                  setEditData({ ...editData, recipientName: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 p-3 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400"
              />
            </div>

            {/* Certificate Code & Issue Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Hash size={13} /> Certificate Code (INS-...) *
                </label>
                <input
                  required
                  type="text"
                  value={editData.code}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      code: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-amber-400 font-mono font-bold text-xs sm:text-sm outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Editable code (e.g. INS-2026-001)
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Calendar size={13} /> Issuance Date *
                </label>
                <input
                  required
                  type="date"
                  value={editData.issuedAt}
                  onChange={(e) =>
                    setEditData({ ...editData, issuedAt: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Adjust the official issue date
                </span>
              </div>
            </div>

            {/* Certificate Type */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Certificate Type *
              </label>
              <select
                value={editData.certType}
                onChange={(e) =>
                  setEditData({ ...editData, certType: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400"
              >
                {CERTIFICATE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Citation Reason */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Achievement / Citation Reason *
              </label>
              <textarea
                required
                rows={3}
                value={editData.achievement}
                onChange={(e) =>
                  setEditData({ ...editData, achievement: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-amber-400 resize-none"
              />
            </div>

            {/* Status Selector */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-slate-300">
                Certificate Status
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-emerald-400 font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="editStatus"
                    value="valid"
                    checked={editData.status === "valid"}
                    onChange={() =>
                      setEditData({ ...editData, status: "valid" })
                    }
                  />
                  <span>Active & Valid</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-rose-400 font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="editStatus"
                    value="revoked"
                    checked={editData.status === "revoked"}
                    onChange={() =>
                      setEditData({ ...editData, status: "revoked" })
                    }
                  />
                  <span>Revoked</span>
                </label>
              </div>

              {editData.status === "revoked" && (
                <div className="pt-2">
                  <label className="block text-[11px] font-semibold text-rose-300 mb-1">
                    Reason for Revocation
                  </label>
                  <input
                    type="text"
                    value={editData.revokeReason}
                    onChange={(e) =>
                      setEditData({ ...editData, revokeReason: e.target.value })
                    }
                    placeholder="e.g. Expired, administrative cancellation..."
                    className="w-full bg-slate-900 border border-rose-500/50 p-2 rounded-lg text-white text-xs outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingCert(null)}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs sm:text-sm font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy.startsWith("edit_")}
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2 shadow-md"
              >
                {busy.startsWith("edit_") ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= REVOKE MODAL ================= */}
      {revokingCert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/50 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 rounded-2xl">
                <Ban size={22} />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  Revoke Official Certificate
                </h3>
                <span className="text-xs text-rose-300 font-mono font-bold">
                  {revokingCert.code || revokingCert.id}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This certificate issued to{" "}
              <strong className="text-white">
                "{revokingCert.recipientName || revokingCert.targetName}"
              </strong>{" "}
              will be marked as{" "}
              <strong className="text-rose-400">REVOKED</strong> on the public
              verification page and downloaded PDFs.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                Reason for Revocation:
              </label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Administrative decision / invalidated"
                className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRevokingCert(null)}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmRevoke()}
                disabled={Boolean(busy)}
                className="bg-rose-600 hover:bg-rose-500 text-white font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                {busy.startsWith("revoke_") ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Ban size={15} />
                )}
                <span>Confirm Revocation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE MODAL ================= */}
      {deletingCert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/50 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-2xl">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  Permanently Delete Certificate
                </h3>
                <span className="text-xs text-red-300 font-mono font-bold">
                  {deletingCert.code || deletingCert.id}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete this certificate
              record for{" "}
              <strong className="text-white">
                "{deletingCert.recipientName || deletingCert.targetName}"
              </strong>
              ? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCert(null)}
                className="px-4 py-2 text-slate-400 hover:text-white rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={Boolean(busy)}
                className="bg-red-600 hover:bg-red-500 text-white font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow"
              >
                {busy.startsWith("delete_") ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Trash2 size={15} />
                )}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= QR MODAL ================= */}
      {qrModalCert && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl max-w-sm w-full text-center space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-sm text-white flex items-center gap-1.5">
                <QrCode size={16} className="text-amber-400" /> Digital
                Verification QR Code
              </span>
              <button
                onClick={() => setQrModalCert(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-white p-4 rounded-2xl mx-auto inline-block shadow-inner">
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-52 h-52 mx-auto"
              />
            </div>

            <div>
              <strong className="text-white block text-base font-black">
                {qrModalCert.recipientName || qrModalCert.targetName}
              </strong>
              <span className="text-xs font-mono text-amber-400 font-bold block mt-1">
                {qrModalCert.code || qrModalCert.id}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Issued: {formatEnglishDate(qrModalCert.issuedAt)}
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <a
                href={`/verify/${qrModalCert.code || qrModalCert.id}`}
                target="_blank"
                rel="noreferrer"
                className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition shadow"
              >
                <ExternalLink size={14} /> Open Public Verification Page
              </a>
              <button
                onClick={() => setQrModalCert(null)}
                className="text-slate-400 hover:text-white text-xs py-1"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CERTIFICATES LIST GRID ================= */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-amber-400" size={36} />
          <span className="text-xs sm:text-sm font-semibold">
            Loading certificates registry...
          </span>
        </div>
      ) : filteredCerts.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <Award size={44} className="mx-auto text-slate-600 mb-3" />
          <h4 className="text-white font-bold text-base mb-1">
            No certificates found
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "No certificates match the current filter or search criteria."
              : "Click 'Issue New Certificate' above to create and issue your first official digital certificate."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCerts.map((cert) => {
            const isRevoked =
              cert.status === "revoked" || cert.status === "REVOKED";
            const code = cert.code || cert.id;
            const recipient =
              cert.recipientName || cert.targetName || "Valued Recipient";

            return (
              <div
                key={cert.id}
                className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow transition relative overflow-hidden"
              >
                {/* Accent Status Bar */}
                <div
                  className={`absolute top-0 right-0 left-0 h-1.5 ${isRevoked ? "bg-rose-500" : "bg-amber-400"}`}
                />

                <div>
                  {/* Top Bar: Code & Status */}
                  <div className="flex justify-between items-start gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono bg-slate-900 border border-slate-800 text-amber-400 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                        {code}
                      </span>
                      <button
                        onClick={() => handleCopyCode(code)}
                        className="text-slate-500 hover:text-amber-400 transition p-1"
                        title="Copy Certificate Code"
                      >
                        {copiedCode === code ? (
                          <Check size={13} className="text-emerald-400" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>

                    <span
                      className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                        isRevoked
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {isRevoked ? "Revoked" : "Active & Valid"}
                    </span>
                  </div>

                  {/* Recipient & Type */}
                  <h3 className="font-black text-white text-base leading-snug tracking-tight">
                    {recipient}
                  </h3>
                  <p className="text-xs text-amber-400/90 font-bold mt-0.5">
                    {cert.certType || "Certificate of Appreciation"}
                  </p>

                  {/* Citation */}
                  <p className="text-xs text-slate-300 mt-2 line-clamp-2 leading-relaxed">
                    {cert.reason || cert.achievement}
                  </p>

                  {/* Metadata info */}
                  <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-900 flex justify-between items-center">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Calendar size={12} /> Issued:
                    </span>
                    <span className="font-mono text-slate-300 font-semibold">
                      {formatEnglishDate(cert.issuedAt)}
                    </span>
                  </div>

                  {isRevoked && (
                    <div className="mt-2.5 text-[11px] bg-rose-950/40 text-rose-300 p-2.5 rounded-xl border border-rose-900/50">
                      <strong>Revocation Reason:</strong>{" "}
                      {cert.revokeReason || "Revoked by administration"}
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5 pt-3 border-t border-slate-900">
                  <button
                    onClick={() => handleOpenEditModal(cert)}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-200 py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition border border-slate-800 hover:text-amber-400"
                    title="Edit certificate code, recipient, or date"
                  >
                    <Edit size={13} className="text-amber-400" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => void handleOpenQr(cert)}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-200 py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition border border-slate-800 hover:text-sky-400"
                    title="View QR Code"
                  >
                    <QrCode size={13} className="text-sky-400" />
                    <span>QR</span>
                  </button>

                  <button
                    onClick={() => void generatePDF(cert)}
                    disabled={busy === "pdf_" + cert.id}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-200 py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition border border-slate-800 hover:text-emerald-400"
                    title="Download Official PDF"
                  >
                    {busy === "pdf_" + cert.id ? (
                      <Loader2
                        size={13}
                        className="animate-spin text-emerald-400"
                      />
                    ) : (
                      <Download size={13} className="text-emerald-400" />
                    )}
                    <span>PDF</span>
                  </button>

                  {!isRevoked ? (
                    <button
                      onClick={() => {
                        setRevokingCert(cert);
                        setRevokeReason("Revoked by administration");
                      }}
                      className="bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center transition"
                      title="Revoke Certificate"
                    >
                      <Ban size={13} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setDeletingCert(cert)}
                      className="bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 text-red-400 py-2 px-2 rounded-xl text-xs transition"
                      title="Permanently Delete Certificate"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
