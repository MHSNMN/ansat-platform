/**
 * Centralized Audit Log Service
 * كل عملية حساسة في أي منصة تُسجَّل هنا.
 * لا يمكن للعميل الكتابة مباشرة — الكتابة عبر الخادم فقط.
 */
import type { Request } from "express";
import { getFirebaseAdminFirestore } from "../firebaseAdmin";

export interface AuditEntry {
  actorUid: string;
  action: string;
  platform: "recording" | "tasks" | "rewards" | "admin" | "system";
  target: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const nowIso = () => new Date().toISOString();
const actor = (req: Request) => req.user?.uid || "system";

export async function writeAuditLog(
  req: Request,
  action: string,
  platform: AuditEntry["platform"],
  target: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const db = getFirebaseAdminFirestore();
  if (!db) return; // لا نوقف العملية الأصلية إذا لم تتوفر قاعدة البيانات
  try {
    await db.collection("audit_logs").add({
      actorUid: actor(req),
      action,
      platform,
      target: String(target).slice(0, 200),
      metadata,
      createdAt: nowIso(),
    } satisfies AuditEntry);
  } catch (err) {
    console.error("[AuditService] Failed to write audit log:", err);
  }
}
