import React, { useEffect, useState } from "react";
import { Loader2, XCircle, ShieldCheck, Download } from "lucide-react";
import { apiFetch } from "../lib/api";

function formatEnglishDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function CertificateVerificationPage() {
  const [cert, setCert] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const id = window.location.pathname.split("/verify/")[1];

  useEffect(() => {
    if (!id) {
      setError("Invalid verification link.");
      setLoading(false);
      return;
    }

    apiFetch(`/api/public/certificate/verify/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.certificate) {
          setCert(data.certificate);
        } else {
          setError(data.error || "Certificate verification record not found.");
        }
      })
      .catch(() => setError("Unable to connect to the verification registry."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDownloadPDF = async () => {
    if (!cert) return;
    setIsGeneratingPdf(true);
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

      // Gold vertical ribbon
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

      // Presentation
      doc.setTextColor(90, 90, 90);
      doc.setFontSize(13);
      doc.text("This official certificate is proudly presented to", 160, 76, {
        align: "center",
      });

      // Recipient name
      doc.setTextColor(24, 32, 47);
      doc.setFontSize(26);
      doc.text(
        cert.recipientName || cert.targetName || "Valued Recipient",
        160,
        94,
        { align: "center" },
      );

      // Gold line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.6);
      doc.line(95, 99, 225, 99);

      // Achievement Reason
      doc.setTextColor(60, 70, 85);
      doc.setFontSize(12);
      const reasonText =
        cert.reason ||
        cert.achievement ||
        "In recognition of outstanding dedication and volunteer excellence.";
      doc.text(reasonText, 160, 114, { align: "center", maxWidth: 195 });

      // Revoked Watermark
      const isRevoked = cert.status === "revoked" || cert.status === "REVOKED";
      if (isRevoked) {
        doc.setTextColor(225, 29, 72);
        doc.setFontSize(40);
        doc.text("REVOKED / INVALID", 160, 136, { align: "center" });
      }

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
      doc.text(`Issue Date: ${formatEnglishDate(cert.issuedAt)}`, 75, 172, {
        align: "center",
      });

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

      // Bottom Barcode simulation and Footer
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.4);
      doc.line(35, 192, 280, 192);

      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Official Digital Verification Record: ${verifyUrl}`, 160, 197, {
        align: "center",
      });

      doc.save(`Certificate_${verifyCode}.pdf`);
    } catch (e) {
      console.error("PDF download error:", e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-amber-400 font-semibold p-6"
        dir="ltr"
      >
        <Loader2 className="animate-spin mb-4" size={44} />
        <span className="text-sm">
          Verifying official digital credentials...
        </span>
      </div>
    );
  }

  if (error || !cert) {
    return (
      <div
        className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center"
        dir="ltr"
      >
        <div className="w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-500/20">
          <XCircle size={36} />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">
          Certificate Not Verified
        </h1>
        <p className="text-slate-400 max-w-md text-sm">
          {error || "No valid certificate matches this reference identifier."}
        </p>
        <a
          href="/"
          className="mt-6 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
        >
          Return to Ensat Home
        </a>
      </div>
    );
  }

  const isRevoked =
    cert.status === "revoked" ||
    cert.status === "REVOKED" ||
    cert.status === "cancelled";
  const isValid =
    !isRevoked && (cert.status === "valid" || cert.status === "ISSUED");

  return (
    <div
      className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-8 font-sans"
      dir="ltr"
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden mb-6">
        {/* Top Status Stripe */}
        {isValid ? (
          <div className="absolute top-0 right-0 left-0 h-2 bg-emerald-500"></div>
        ) : (
          <div className="absolute top-0 right-0 left-0 h-2 bg-rose-500"></div>
        )}

        {/* Verification Icon Badge */}
        <div className="flex justify-center mb-4">
          {isValid ? (
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck size={36} />
            </div>
          ) : (
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center border border-rose-500/30">
              <XCircle size={36} />
            </div>
          )}
        </div>

        {/* Title & Status */}
        <h1
          className={`text-2xl font-black text-center mb-1 ${isValid ? "text-emerald-400" : "text-rose-400"}`}
        >
          {isValid
            ? "Authentic & Verified Certificate"
            : "Revoked Certificate (Invalid)"}
        </h1>
        <p className="text-center text-xs text-slate-400 mb-6">
          {isValid
            ? "Official record successfully verified against Ensat Initiative Digital Credential Registry."
            : "This certificate has been formally revoked or invalidated by the administration."}
        </p>

        {/* Details Card */}
        <div className="space-y-4 text-slate-300 bg-slate-950 p-5 rounded-2xl border border-slate-800">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Recipient Name
            </span>
            <strong className="text-xl text-white block">
              {cert.recipientName || cert.targetName}
            </strong>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Certificate Type
            </span>
            <span className="text-sm font-bold text-amber-400">
              {cert.certType || "Certificate of Appreciation"}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Achievement / Citation
            </span>
            <p className="text-sm text-slate-300 leading-relaxed">
              {cert.reason || cert.achievement}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-900">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Certificate ID
              </span>
              <span className="text-xs font-mono text-amber-400 font-bold bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 inline-block">
                {cert.code || cert.id}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Registry Status
              </span>
              <span
                className={`text-xs font-black px-2.5 py-1 rounded-full inline-block ${
                  isValid
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                }`}
              >
                {isValid ? "Active & Valid" : "Revoked"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Date of Issuance
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {formatEnglishDate(cert.issuedAt)}
              </span>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Issuing Authority
              </span>
              <span className="text-xs font-semibold text-slate-300">
                {cert.grantingEntity || "Ensat Initiative Administration"}
              </span>
            </div>
          </div>

          {/* Revocation Warning */}
          {isRevoked && (
            <div className="pt-4 mt-4 border-t border-rose-500/30 text-rose-300 text-xs bg-rose-950/40 p-3 rounded-xl">
              <strong className="block text-rose-400 font-bold mb-0.5">
                Revocation Notice:
              </strong>
              <span>
                {cert.revokeReason ||
                  "This certificate has been revoked by the issuing administration."}
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => void handleDownloadPDF()}
            disabled={isGeneratingPdf}
            className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-lg shadow-amber-400/20"
          >
            {isGeneratingPdf ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span>Download Official PDF Certificate</span>
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-500">
        Ensat Initiative Digital Credential System &bull; Cryptographically
        verifiable
      </div>
    </div>
  );
}
