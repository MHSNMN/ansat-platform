import { QRCodeSVG } from "qrcode.react";
import React, { useState, useEffect, useCallback } from "react";
import {
  BadgeCheck,
  Search,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Award,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { CertificateRecord } from "../types";

export const CertificatesView: React.FC = () => {
  const [searchCode, setSearchCode] = useState("");
  const [verifiedCert, setVerifiedCert] = useState<CertificateRecord | null>(
    null,
  );
  const [myCertificates, setMyCertificates] = useState<CertificateRecord[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchMyCertificates = useCallback(async () => {
    try {
      const res = await apiFetch("/api/rewards/certificates/me");
      const data = await res.json();
      if (res.ok && data.success) {
        setMyCertificates(data.certificates || []);
      }
    } catch {
      // Silent error
    }
  }, []);

  useEffect(() => {
    void fetchMyCertificates();
  }, [fetchMyCertificates]);

  const handleVerify = async (codeToVerify?: string) => {
    const code = (codeToVerify || searchCode).trim().toUpperCase();
    if (!code) {
      setVerifyError("Please enter a certificate code to verify.");
      return;
    }

    setIsVerifying(true);
    setVerifyError("");
    setVerifiedCert(null);

    try {
      const res = await apiFetch(
        `/api/public/certificates/${encodeURIComponent(code)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error ||
            "No official certificate found with this code in Ensat registry.",
        );
      }
      setVerifiedCert(data.certificate);
      setSearchCode(code);
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Unable to verify certificate.",
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyVerificationUrl = () => {
    if (!verifiedCert) return;
    const url = `${window.location.origin}/verify/${verifiedCert.code}`;
    void navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);

  const handlePrint = async () => {
    if (!verifiedCert) return;
    try {
      setIsGeneratingPdf(true);
      const [{ jsPDF }, { default: QRCode }] = await Promise.all([
        import("jspdf"),
        import("qrcode"),
      ]);

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const verifyCode = verifiedCert.code || verifiedCert.id;
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
      doc.text(
        verifiedCert.certType || "Certificate of Appreciation",
        160,
        53,
        { align: "center" },
      );

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
      doc.text(verifiedCert.recipientName || "Valued Recipient", 160, 94, {
        align: "center",
      });

      // Gold line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.6);
      doc.line(95, 99, 225, 99);

      // Achievement Reason
      doc.setTextColor(60, 70, 85);
      doc.setFontSize(12);
      const reasonText =
        verifiedCert.reason ||
        "In recognition of outstanding dedication, volunteer excellence, and valuable contributions to the Ensat Initiative.";
      doc.text(reasonText, 160, 114, { align: "center", maxWidth: 195 });

      // Revocation Watermark if revoked
      const isRevoked = String(verifiedCert.status).toLowerCase() === "revoked";
      if (isRevoked) {
        doc.setTextColor(225, 29, 72);
        doc.setFontSize(40);
        doc.text("REVOKED / INVALID", 160, 136, { align: "center" });
      }

      // Left Signer
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(11);
      doc.text(verifiedCert.responsibleName || "General Supervisor", 75, 154, {
        align: "center",
      });
      doc.setLineWidth(0.3);
      doc.setDrawColor(170, 170, 170);
      doc.line(48, 160, 102, 160);
      doc.setFontSize(9.5);
      doc.setTextColor(110, 110, 110);
      doc.text(
        verifiedCert.grantingEntity || "Ensat Initiative Administration",
        75,
        166,
        { align: "center" },
      );
      doc.text(`Issue Date: ${formatDate(verifiedCert.issuedAt)}`, 75, 172, {
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

      doc.save(`Certificate-${verifyCode}.pdf`);
    } catch (error) {
      console.error("Error generating PDF", error);
      alert("Unable to generate PDF certificate.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "-";
    try {
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="rew-cert-layout" dir="ltr">
      {/* ================= Verification Input Section ================= */}
      <div className="rew-card rew-cert-verifier-card">
        <div className="rew-card-head">
          <div className="rew-card-title-group">
            <ShieldCheck size={18} />
            <h4>Official Certificate Verification Registry</h4>
          </div>
          <span className="rew-card-tag">Official Digital Credential</span>
        </div>

        <p className="rew-card-subdesc">
          Enter the unique credential identifier printed on the certificate
          (e.g. <code>INS-XXXXXX</code>) to verify authenticity and view the
          official digital document.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleVerify();
          }}
          className="rew-cert-search-form"
        >
          <div className="rew-cert-input-wrap">
            <Search size={18} />
            <input
              type="text"
              placeholder="INS-XXXXXX"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
              maxLength={40}
            />
          </div>
          <button
            type="submit"
            className="rew-btn-primary"
            disabled={isGeneratingPdf || isVerifying || !searchCode.trim()}
          >
            {isVerifying ? "Verifying..." : "Verify Certificate"}
          </button>
        </form>

        {verifyError && (
          <div className="rew-form-notice error mt-4">
            <AlertCircle size={16} />
            <span>{verifyError}</span>
          </div>
        )}
      </div>

      {/* ================= Authentic Certificate Display ================= */}
      {verifiedCert && (
        <div className="rew-cert-presentation-wrap">
          <div className="rew-cert-toolbar">
            <div className="rew-cert-status-badge">
              <BadgeCheck size={16} />
              <span>
                {verifiedCert.status === "revoked"
                  ? "Revoked Certificate (Invalid)"
                  : "Active & Valid Official Certificate"}
              </span>
            </div>
            <div className="rew-cert-actions">
              <button
                type="button"
                className="rew-cert-tool-btn"
                onClick={handleCopyVerificationUrl}
              >
                {copiedLink ? <Check size={15} /> : <Copy size={15} />}
                <span>
                  {copiedLink ? "Link Copied" : "Copy Verification Link"}
                </span>
              </button>
              <button
                type="button"
                className="rew-cert-tool-btn primary"
                onClick={handlePrint}
              >
                {isGeneratingPdf ? (
                  <span>Generating PDF...</span>
                ) : (
                  <>
                    <Printer size={15} />
                    <span>Download PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Authentic High-Value Certificate Frame */}
          <div
            className="rew-official-certificate-frame"
            id="printable-certificate"
          >
            <div className="rew-cert-bg-pattern"></div>
            <div className="rew-cert-content-wrapper">
              <div className="rew-cert-header">
                <div></div>
                <div className="rew-cert-title-container">
                  <h1 className="rew-cert-title">
                    {verifiedCert.certType || "Certificate of Appreciation"}
                  </h1>
                  <p className="rew-cert-subtitle">
                    Official Recognition & Volunteer Excellence
                  </p>
                </div>
                <div className="rew-cert-logo">
                  <div className="rew-cert-logo-circle">
                    <Award size={36} />
                  </div>
                  <span className="rew-cert-logo-text">Ensat Initiative</span>
                </div>
              </div>

              <div className="rew-cert-body">
                <p className="rew-cert-intro">
                  The Administration of Ensat Initiative proudly presents this
                  certificate to:
                </p>
                <h2 className="rew-cert-recipient">
                  {verifiedCert.recipientName}
                </h2>
                <p className="rew-cert-statement">
                  {verifiedCert.reason ||
                    "In recognition of outstanding dedication, volunteer excellence, and valuable contributions to the Ensat Initiative."}
                </p>
              </div>

              <div className="rew-cert-footer">
                <div className="rew-cert-meta">
                  <div className="rew-cert-barcode">
                    <svg width="100" height="40" viewBox="0 0 100 40">
                      <rect width="2" height="40" x="0" />
                      <rect width="4" height="40" x="5" />
                      <rect width="1" height="40" x="12" />
                      <rect width="3" height="40" x="15" />
                      <rect width="2" height="40" x="22" />
                      <rect width="5" height="40" x="27" />
                      <rect width="1" height="40" x="35" />
                      <rect width="3" height="40" x="39" />
                      <rect width="2" height="40" x="45" />
                      <rect width="1" height="40" x="50" />
                      <rect width="4" height="40" x="54" />
                      <rect width="2" height="40" x="60" />
                      <rect width="1" height="40" x="65" />
                      <rect width="5" height="40" x="70" />
                      <rect width="3" height="40" x="78" />
                      <rect width="1" height="40" x="84" />
                      <rect width="2" height="40" x="88" />
                      <rect width="4" height="40" x="93" />
                      <rect width="1" height="40" x="99" />
                    </svg>
                  </div>
                  <div className="rew-cert-meta-text">
                    <span>Certificate ID:</span>
                    <code>{verifiedCert.code}</code>
                  </div>
                </div>

                <div className="rew-cert-signer">
                  <div className="rew-cert-signer-name">
                    {verifiedCert.responsibleName || "General Supervisor"}
                  </div>
                  <div className="rew-cert-signer-role">
                    {verifiedCert.grantingEntity ||
                      "Ensat Initiative Administration"}
                  </div>
                  <div className="rew-cert-signer-date">
                    Date: {formatDate(verifiedCert.issuedAt)}
                  </div>
                </div>

                <div className="rew-cert-qr">
                  <QRCodeSVG
                    value={`${window.location.origin}/verify/${verifiedCert.code}`}
                    size={80}
                    level="M"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= User's Certificates List ================= */}
      <div className="rew-card rew-my-certs-card">
        <div className="rew-card-head">
          <div className="rew-card-title-group">
            <BadgeCheck size={18} />
            <h4>My Awarded Certificates</h4>
          </div>
          <span className="rew-card-tag">
            {myCertificates.length} Certificates
          </span>
        </div>

        {myCertificates.length > 0 ? (
          <div className="rew-my-certs-grid">
            {myCertificates.map((cert) => (
              <div key={cert.id || cert.code} className="rew-my-cert-item">
                <div className="rew-my-cert-icon">
                  <Award size={24} />
                </div>
                <div className="rew-my-cert-info">
                  <strong>
                    {cert.certType || "Certificate of Appreciation"}
                  </strong>
                  <p>{cert.reason}</p>
                  <div className="rew-my-cert-footer">
                    <code>{cert.code}</code>
                    <small>{formatDate(cert.issuedAt)}</small>
                  </div>
                </div>
                <button
                  type="button"
                  className="rew-my-cert-view-btn"
                  onClick={() => handleVerify(cert.code)}
                >
                  <span>View & Verify</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rew-empty-card-state">
            <BadgeCheck size={32} />
            <h4>No certificates issued to your account yet</h4>
            <p>
              When the administration issues you an official certificate of
              appreciation or milestone completion, it will appear here and you
              can download or verify it anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
