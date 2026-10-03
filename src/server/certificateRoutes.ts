import { Router } from "express";
import { getFirebaseAdminFirestore } from "./firebaseAdmin";
import { requireRbacAction } from "./authMiddleware";
import crypto from "crypto";

export const certificateRouter = Router();

function formatCertificateCode(rawCode?: string): string {
  if (!rawCode || typeof rawCode !== "string") {
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `INS-${randomHex}`;
  }
  let cleaned = rawCode.trim().toUpperCase();
  cleaned = cleaned.replace(/[^A-Z0-9_-]/g, "");
  if (!cleaned.startsWith("INS-")) {
    cleaned = `INS-${cleaned.replace(/^INS-?/i, "")}`;
  }
  return cleaned;
}

function parseIssueDate(rawDate?: string): string {
  if (!rawDate || typeof rawDate !== "string") {
    return new Date().toISOString();
  }
  const parsed = new Date(rawDate);
  if (isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
}

// List certificates (admin)
certificateRouter.get(
  "/all",
  requireRbacAction("issue_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    try {
      const snap = await db
        .collection("certificates")
        .orderBy("issuedAt", "desc")
        .limit(150)
        .get();
      const certs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return res.json({ success: true, certificates: certs });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to load certificates",
      });
    }
  },
);

// Get single certificate
certificateRouter.get(
  "/:id",
  requireRbacAction("issue_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const { id } = req.params;
    try {
      const docRef = db.collection("certificates").doc(id);
      let snap = await docRef.get();
      if (!snap.exists) {
        const q = await db
          .collection("certificates")
          .where("code", "==", id)
          .limit(1)
          .get();
        if (!q.empty) snap = q.docs[0];
      }
      if (!snap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "Certificate not found" });
      }
      return res.json({
        success: true,
        certificate: { id: snap.id, ...snap.data() },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to fetch certificate",
      });
    }
  },
);

// Create certificate
certificateRouter.post(
  "/issue",
  requireRbacAction("issue_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const {
      targetUid,
      targetName,
      recipientName,
      achievement,
      reason,
      role,
      points,
      certType,
      code,
      customCode,
      issuedAt,
      issueDate,
      grantingEntity,
      responsibleName,
    } = req.body;

    const finalName = (recipientName || targetName || "").trim();
    const finalAchievement = (achievement || reason || "").trim();

    if (!finalName) {
      return res
        .status(400)
        .json({ success: false, error: "Recipient name is required" });
    }
    if (!finalAchievement) {
      return res.status(400).json({
        success: false,
        error: "Certificate achievement / reason is required",
      });
    }

    const id = crypto.randomBytes(16).toString("hex");
    const finalCode = formatCertificateCode(code || customCode);

    try {
      // Check if code is already used by another certificate
      const existingWithCode = await db
        .collection("certificates")
        .where("code", "==", finalCode)
        .limit(1)
        .get();
      if (!existingWithCode.empty) {
        return res.status(400).json({
          success: false,
          error: `Certificate code "${finalCode}" is already in use. Please enter a different code.`,
        });
      }

      const finalTargetUid = targetUid
        ? String(targetUid).trim()
        : `manual_${id.slice(0, 8)}`;
      const finalIssuedAt = parseIssueDate(issuedAt || issueDate);

      const certData = {
        id,
        code: finalCode,
        targetUid: finalTargetUid,
        memberId: finalTargetUid,
        targetName: finalName,
        recipientName: finalName,
        achievement: finalAchievement,
        reason: finalAchievement,
        certType: certType || "Certificate of Appreciation",
        grantingEntity: grantingEntity || "Ensat Initiative Administration",
        responsibleName: responsibleName || "General Supervisor",
        role: role || "MEMBER",
        points: Number(points) || 0,
        issuedAt: finalIssuedAt,
        issuedBy: req.user?.uid || "system",
        status: "valid",
        publiclyVerifiable: true,
        updatedAt: new Date().toISOString(),
      };

      await db.collection("certificates").doc(id).set(certData);

      await db.collection("audit_logs").add({
        action: "ISSUE_CERTIFICATE",
        certificateId: id,
        code: finalCode,
        recipientName: finalName,
        targetUid: finalTargetUid,
        issuedAt: finalIssuedAt,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        id,
        code: finalCode,
        certificate: certData,
        message: "Certificate issued successfully",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to issue certificate",
      });
    }
  },
);

// Update certificate
certificateRouter.put(
  "/:id",
  requireRbacAction("issue_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const { id } = req.params;
    const {
      code,
      customCode,
      recipientName,
      targetName,
      achievement,
      reason,
      certType,
      issuedAt,
      issueDate,
      status,
      revokeReason,
      grantingEntity,
      responsibleName,
      role,
    } = req.body;

    try {
      let docRef = db.collection("certificates").doc(id);
      let snap = await docRef.get();

      if (!snap.exists) {
        const querySnap = await db
          .collection("certificates")
          .where("code", "==", id)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          docRef = querySnap.docs[0].ref;
          snap = querySnap.docs[0];
        } else {
          return res
            .status(404)
            .json({ success: false, error: "Certificate not found" });
        }
      }

      const currentData = snap.data() || {};
      const updates: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      // If code is being modified
      if (code || customCode) {
        const newCode = formatCertificateCode(code || customCode);
        if (newCode !== currentData.code) {
          const codeCheck = await db
            .collection("certificates")
            .where("code", "==", newCode)
            .limit(1)
            .get();
          if (!codeCheck.empty && codeCheck.docs[0].id !== docRef.id) {
            return res.status(400).json({
              success: false,
              error: `Certificate code "${newCode}" is already in use by another certificate.`,
            });
          }
          updates.code = newCode;
        }
      }

      const resolvedName = recipientName || targetName;
      if (
        resolvedName !== undefined &&
        typeof resolvedName === "string" &&
        resolvedName.trim()
      ) {
        updates.recipientName = resolvedName.trim();
        updates.targetName = resolvedName.trim();
      }

      const resolvedReason = achievement || reason;
      if (
        resolvedReason !== undefined &&
        typeof resolvedReason === "string" &&
        resolvedReason.trim()
      ) {
        updates.achievement = resolvedReason.trim();
        updates.reason = resolvedReason.trim();
      }

      if (
        certType !== undefined &&
        typeof certType === "string" &&
        certType.trim()
      ) {
        updates.certType = certType.trim();
      }

      if (issuedAt || issueDate) {
        updates.issuedAt = parseIssueDate(issuedAt || issueDate);
      }

      if (
        status !== undefined &&
        ["valid", "revoked"].includes(status.toLowerCase())
      ) {
        updates.status = status.toLowerCase();
        if (status.toLowerCase() === "revoked") {
          updates.revokedAt = currentData.revokedAt || new Date().toISOString();
          updates.revokeReason = revokeReason
            ? String(revokeReason).trim()
            : currentData.revokeReason || "Revoked by administration";
        } else {
          updates.revokedAt = null;
          updates.revokeReason = null;
        }
      }

      if (grantingEntity !== undefined)
        updates.grantingEntity = String(grantingEntity).trim();
      if (responsibleName !== undefined)
        updates.responsibleName = String(responsibleName).trim();
      if (role !== undefined) updates.role = String(role).trim();

      await docRef.update(updates);

      const updatedSnap = await docRef.get();
      const finalData: any = { id: docRef.id, ...updatedSnap.data() };

      await db.collection("audit_logs").add({
        action: "UPDATE_CERTIFICATE",
        certificateId: docRef.id,
        certificateCode: finalData.code || docRef.id,
        updates,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "Certificate updated successfully",
        certificate: finalData,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to update certificate",
      });
    }
  },
);

// Revoke certificate
certificateRouter.post(
  "/:id/revoke",
  requireRbacAction("revoke_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const { id } = req.params;
    const { reason } = req.body;

    try {
      let docRef = db.collection("certificates").doc(id);
      let snap = await docRef.get();

      // If not found by direct doc ID, search by code or id field
      if (!snap.exists) {
        const querySnap = await db
          .collection("certificates")
          .where("code", "==", id)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          docRef = querySnap.docs[0].ref;
          snap = querySnap.docs[0];
        } else {
          const querySnap2 = await db
            .collection("certificates")
            .where("id", "==", id)
            .limit(1)
            .get();
          if (!querySnap2.empty) {
            docRef = querySnap2.docs[0].ref;
            snap = querySnap2.docs[0];
          } else {
            return res.status(404).json({
              success: false,
              error: "Certificate not found in records",
            });
          }
        }
      }

      const certData = snap.data() || {};
      const revokedPayload = {
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedBy: req.user?.uid || "system",
        revokeReason: reason
          ? String(reason).trim().slice(0, 500)
          : "Revoked by administration",
        updatedAt: new Date().toISOString(),
      };

      await docRef.update(revokedPayload);

      await db.collection("audit_logs").add({
        action: "REVOKE_CERTIFICATE",
        certificateId: docRef.id,
        certificateCode: certData.code || docRef.id,
        recipientName: certData.recipientName || certData.targetName || "",
        performedBy: req.user?.uid || "system",
        reason: reason || "Revoked by administration",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "Certificate has been successfully revoked",
        certificate: { id: docRef.id, ...certData, ...revokedPayload },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to revoke certificate",
      });
    }
  },
);

// Delete certificate permanently if needed
certificateRouter.delete(
  "/:id",
  requireRbacAction("revoke_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "Database not configured" });

    const { id } = req.params;

    try {
      let docRef = db.collection("certificates").doc(id);
      let snap = await docRef.get();

      if (!snap.exists) {
        const querySnap = await db
          .collection("certificates")
          .where("code", "==", id)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          docRef = querySnap.docs[0].ref;
          snap = querySnap.docs[0];
        }
      }

      if (!snap.exists) {
        return res
          .status(404)
          .json({ success: false, error: "Certificate not found" });
      }

      const certData = snap.data() || {};
      await docRef.delete();

      await db.collection("audit_logs").add({
        action: "DELETE_CERTIFICATE",
        certificateId: docRef.id,
        certificateCode: certData.code || docRef.id,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        message: "Certificate deleted permanently",
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || "Failed to delete certificate",
      });
    }
  },
);
