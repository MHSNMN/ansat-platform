// @ts-nocheck
import { Router } from "express";
import { requireRbacAction } from "../../server/authMiddleware";
import {
  getFirebaseAdminAuth,
  getFirebaseAdminFirestore,
} from "../../server/firebaseAdmin";

const adminRouter = Router();
const activeRequests = new Set<string>();

adminRouter.post(
  "/users",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { name, username, email, password, role, department } = req.body;
    const idempotencyKey = req.headers["idempotency-key"] as string;

    if (!idempotencyKey) {
      return res
        .status(400)
        .json({ success: false, error: "Idempotency-Key header is required" });
    }

    if (activeRequests.has(idempotencyKey)) {
      return res
        .status(409)
        .json({ success: false, error: "Request is already processing" });
    }

    // Basic validation
    if (!name || typeof name !== "string")
      return res.status(400).json({ success: false, error: "الاسم مطلوب" });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res
        .status(400)
        .json({ success: false, error: "بريد إلكتروني غير صالح" });
    if (!username || !/^[a-zA-Z0-9_]{4,32}$/.test(username)) {
      return res.status(400).json({
        success: false,
        error:
          "اسم المستخدم يجب أن يكون بين 4 و 32 رمزاً ويحتوي على حروف وأرقام وشرطة سفلية فقط",
      });
    }
    if (
      !password ||
      password.length < 8 ||
      !/\d/.test(password) ||
      !/[a-zA-Z]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "كلمة المرور يجب ألا تقل عن 8 رموز وتحتوي على حرف ورقم على الأقل",
      });
    }

    const validRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "NARRATOR",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "دور غير صالح" });
    }

    // A normal admin cannot grant SUPER_ADMIN
    if (role === "SUPER_ADMIN" && req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, error: "لا يمكنك منح صلاحية الإدارة العليا" });
    }

    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminFirestore();
    if (!auth || !db)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin is not configured" });

    const usernameNormalized = username.trim().toLowerCase();

    activeRequests.add(idempotencyKey);
    let createdUid: string | null = null;
    let transactionFailed = false;

    try {
      // 1. Transaction to reserve username
      const usernameRef = db.collection("usernames").doc(usernameNormalized);

      await db.runTransaction(async (t) => {
        const doc = await t.get(usernameRef);
        if (doc.exists) {
          transactionFailed = true;
          throw new Error("USERNAME_TAKEN");
        }

        // We reserve it with a temporary placeholder, updated later
        t.set(usernameRef, {
          createdAt: new Date().toISOString(),
          createdBy: req.user?.uid || "system",
        });
      });

      if (transactionFailed) {
        activeRequests.delete(idempotencyKey);
        return res
          .status(409)
          .json({ success: false, error: "اسم المستخدم محجوز مسبقاً" });
      }

      // 2. Create User in Firebase Auth
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
      });
      createdUid = userRecord.uid;

      // 3. Set Custom Claims
      await auth.setCustomUserClaims(userRecord.uid, {
        role,
        account_status: "active",
      });

      // 4. Create Firestore Document
      const userDocRef = db.collection("users").doc(userRecord.uid);
      const roleDisplayAr =
        role === "SUPER_ADMIN"
          ? "مدير عام"
          : role === "ADMIN"
            ? "مدير"
            : role === "AUDIO_ENGINEER"
              ? "مهندس صوت"
              : role === "QA_REVIEWER"
                ? "مراجع جودة"
                : "راوي";

      await userDocRef.set({
        uid: userRecord.uid,
        name,
        username,
        usernameNormalized,
        email,
        role,
        roleDisplayAr,
        department: department || "",
        status: "active",
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: req.user?.uid || "system",
        updatedAt: new Date().toISOString(),
      });

      // Update username reservation with actual UID
      await usernameRef.update({ uid: userRecord.uid });

      // 5. Audit Log (No password)
      await db.collection("audit_logs").add({
        action: "USER_CREATED",
        targetUid: userRecord.uid,
        role,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        user: {
          uid: userRecord.uid,
          name,
          username,
          email,
          role,
          roleDisplayAr,
          department,
          status: "active",
          isActive: true,
        },
      });
    } catch (error: any) {
      if (error.message === "USERNAME_TAKEN") {
        activeRequests.delete(idempotencyKey);
        return res
          .status(409)
          .json({ success: false, error: "اسم المستخدم محجوز مسبقاً" });
      }

      // Rollback
      console.error("User creation failed, rolling back:", error);
      try {
        if (createdUid) {
          await auth.deleteUser(createdUid);
        }
        await db.collection("usernames").doc(usernameNormalized).delete();
      } catch (rbError) {
        console.error("Rollback failed:", rbError);
        activeRequests.delete(idempotencyKey);
        return res.status(500).json({
          success: false,
          error: "partial_failure",
          message: "حدث خطأ أثناء الإنشاء، وفشل التراجع",
        });
      }

      res.status(500).json({ success: false, error: "حدث خطأ أثناء الإنشاء" });
    } finally {
      activeRequests.delete(idempotencyKey);
    }
  },
);

adminRouter.get(
  "/users",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();

    try {
      let snapshotDocs: any[] = [];
      if (db) {
        try {
          const snapshot = await db.collection("users").get();
          snapshotDocs = snapshot.docs;
        } catch (dbErr) {
          console.warn("embedded users fetch warning:", dbErr);
        }
      }
      const users = snapshotDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
      res.json({ success: true, users });
    } catch (error: any) {
      console.error("embedded Failed to fetch users:", error);
      res.status(500).json({
        success: false,
        error: "تعذر تحميل قائمة الأعضاء",
        details: error?.message || error,
      });
    }
  },
);

adminRouter.patch(
  "/users/:uid/status",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const { status } = req.body;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (!["active", "pending", "disabled"].includes(status)) {
      return res.status(400).json({ success: false, error: "حالة غير صالحة" });
    }

    try {
      const userDocRef = db.collection("users").doc(uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists)
        return res
          .status(404)
          .json({ success: false, error: "المستخدم غير موجود" });

      if (status === "disabled") {
        const userData = userDoc.data();
        if (userData?.role === "SUPER_ADMIN") {
          const superAdmins = await db
            .collection("users")
            .where("role", "==", "SUPER_ADMIN")
            .where("status", "==", "active")
            .get();
          if (superAdmins.size <= 1) {
            return res.status(400).json({
              success: false,
              error: "لا يمكن تعطيل المدير العام الأخير",
            });
          }
        }
      }

      // Update Auth User & Claims
      const firebaseUser = await auth.getUser(uid);
      const currentClaims = firebaseUser.customClaims || {};
      await auth.setCustomUserClaims(uid, {
        ...currentClaims,
        account_status: status,
      });
      await auth.updateUser(uid, { disabled: status === "disabled" });

      // Update Firestore
      await userDocRef.update({
        status,
        isActive: status === "active",
        updatedAt: new Date().toISOString(),
      });

      res.json({ success: true, status });
    } catch (error) {
      res
        .status(500)
        .json({ success: false, error: "Failed to update status" });
    }
  },
);

adminRouter.patch(
  "/users/:uid/role",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const { role } = req.body;
    const db = getFirebaseAdminFirestore();
    const auth = getFirebaseAdminAuth();
    if (!db || !auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    const validRoles = [
      "SUPER_ADMIN",
      "ADMIN",
      "AUDIO_ENGINEER",
      "QA_REVIEWER",
      "NARRATOR",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: "دور غير صالح" });
    }

    if (role === "SUPER_ADMIN" && req.user?.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, error: "لا يمكنك منح صلاحية الإدارة العليا" });
    }

    try {
      const userDocRef = db.collection("users").doc(uid);
      const userDoc = await userDocRef.get();
      if (!userDoc.exists)
        return res
          .status(404)
          .json({ success: false, error: "المستخدم غير موجود" });

      const firebaseUser = await auth.getUser(uid);
      const currentClaims = firebaseUser.customClaims || {};

      await auth.setCustomUserClaims(uid, { ...currentClaims, role });

      const roleDisplayAr =
        role === "SUPER_ADMIN"
          ? "مدير عام"
          : role === "ADMIN"
            ? "مدير"
            : role === "AUDIO_ENGINEER"
              ? "مهندس صوت"
              : role === "QA_REVIEWER"
                ? "مراجع جودة"
                : "راوي";

      await userDocRef.update({
        role,
        roleDisplayAr,
        updatedAt: new Date().toISOString(),
      });

      await db.collection("audit_logs").add({
        action: "ROLE_CHANGED",
        targetUid: uid,
        newRole: role,
        performedBy: req.user?.uid || "system",
        timestamp: new Date().toISOString(),
      });

      res.json({ success: true, role });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to update role" });
    }
  },
);

adminRouter.post(
  "/users/:uid/password-reset",
  requireRbacAction("manage_members"),
  async (req, res) => {
    const { uid } = req.params;
    const { newPassword } = req.body;
    const auth = getFirebaseAdminAuth();
    if (!auth)
      return res
        .status(500)
        .json({ success: false, error: "Firebase Admin not configured" });

    if (
      !newPassword ||
      newPassword.length < 8 ||
      !/\d/.test(newPassword) ||
      !/[a-zA-Z]/.test(newPassword)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "كلمة المرور غير مطابقة للمتطلبات" });
    }

    try {
      await auth.updateUser(uid, { password: newPassword });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "فشل تعيين كلمة المرور" });
    }
  },
);

export { adminRouter };
