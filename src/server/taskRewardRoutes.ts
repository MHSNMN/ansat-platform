import { Router, type Request } from "express";
import {
  canGiftGems,
  gemPackageCost,
  isWindowActive,
  leaderboardPointsForGems,
  REST_DAY_COST,
  REST_DAY_WINDOW_MS,
} from "../lib/rewardPolicy";
import {
  canUpdateTaskStatus,
  isTaskStatus,
  TASK_PRIORITIES,
} from "../lib/taskPolicy";
import { idempotencyDigest } from "../lib/idempotency";
import { requireRbacAction } from "./authMiddleware";

type Db = ReturnType<
  typeof import("./firebaseAdmin").getFirebaseAdminFirestore
>;
const uidPattern = /^[A-Za-z0-9_-]{1,128}$/;
const nowIso = () => new Date().toISOString();
const actor = (req: Request) => req.user?.uid || "unknown";

function safeTask(data: Record<string, unknown>, id: string) {
  return {
    id,
    title: String(data.title || ""),
    description: String(data.description || ""),
    assigneeUids: Array.isArray(data.assigneeUids)
      ? data.assigneeUids
          .filter((v): v is string => typeof v === "string")
          .slice(0, 50)
      : [],
    status: String(data.status || "TODO").toLowerCase(),
    priority: String(data.priority || "NORMAL").toLowerCase(),
    dueDate: typeof data.dueDate === "string" ? data.dueDate : null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function safeLedger(data: Record<string, unknown>, id: string) {
  return {
    id,
    type: String(data.type || "adjustment"),
    points: Number(data.points) || 0,
    gems: Number(data.gems) || 0,
    reason: String(data.reason || "").slice(0, 500),
    createdAt: data.createdAt,
  };
}

async function writeAudit(
  db: NonNullable<Db>,
  req: Request,
  action: string,
  target: string,
  metadata: Record<string, unknown> = {},
) {
  await db.collection("audit_logs").add({
    actorUid: actor(req),
    action,
    target: target.slice(0, 160),
    metadata,
    createdAt: nowIso(),
  });
}

export function createTaskRewardRouter(getDb: () => Db) {
  const router = Router();
  router.get("/tasks", async (req, res) => {
    const db = getDb();
    if (!db || !req.user)
      return res
        .status(503)
        .json({ success: false, error: "خدمة المهام غير مهيأة حالياً" });
    try {
      const isAdmin = req.user.canonicalRole === "ADMIN";
      const query = isAdmin
        ? db.collection("tasks").limit(200)
        : db
            .collection("tasks")
            .where("assigneeUids", "array-contains", req.user.uid)
            .limit(100);
      const snapshot = await query.get();
      return res.json({
        success: true,
        tasks: snapshot.docs.map((doc) => safeTask(doc.data(), doc.id)),
      });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تحميل المهام" });
    }
  });

  router.post("/tasks", requireRbacAction("manage_tasks"), async (req, res) => {
    const db = getDb();
    const title =
      typeof req.body?.title === "string"
        ? req.body.title.trim().slice(0, 180)
        : "";
    const description =
      typeof req.body?.description === "string"
        ? req.body.description.trim().slice(0, 4000)
        : "";
    const assigneeUids = Array.isArray(req.body?.assigneeUids)
      ? req.body.assigneeUids
          .filter(
            (id: unknown): id is string =>
              typeof id === "string" && uidPattern.test(id),
          )
          .slice(0, 50)
      : [];
    if (!db || !title)
      return res
        .status(400)
        .json({ success: false, error: "عنوان المهمة مطلوب" });
    try {
      const createdAt = nowIso();
      const priority =
        typeof req.body?.priority === "string" &&
        TASK_PRIORITIES.includes(req.body.priority.toUpperCase() as any)
          ? req.body.priority.toUpperCase()
          : "NORMAL";
      const ref = await db.collection("tasks").add({
        title,
        description,
        assigneeUids,
        status: "TODO",
        priority,
        dueDate:
          typeof req.body?.dueDate === "string"
            ? req.body.dueDate.slice(0, 30)
            : null,
        createdBy: actor(req),
        createdAt,
        updatedAt: createdAt,
      });
      await writeAudit(db, req, "task.created", ref.id, {
        assigneeCount: assigneeUids.length,
      });
      return res.status(201).json({
        success: true,
        task: safeTask(
          {
            title,
            description,
            assigneeUids,
            status: "TODO",
            priority,
            createdAt,
          },
          ref.id,
        ),
      });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر إنشاء المهمة" });
    }
  });

  router.patch("/tasks/:id", async (req, res) => {
    const db = getDb();
    if (!db || !req.user || !uidPattern.test(req.params.id))
      return res.status(400).json({ success: false, error: "مهمة غير صالحة" });
    if (!isTaskStatus(req.body?.status))
      return res
        .status(400)
        .json({ success: false, error: "حالة مهمة غير صالحة" });
    const normalizedStatus = req.body.status.toUpperCase();
    try {
      const ref = db.collection("tasks").doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists)
        return res
          .status(404)
          .json({ success: false, error: "المهمة غير موجودة" });
      const data = doc.data() || {};
      if (
        !canUpdateTaskStatus(
          req.user.uid,
          req.user.canonicalRole,
          data.assigneeUids,
        )
      )
        return res
          .status(403)
          .json({ success: false, error: "لا تملك صلاحية تعديل هذه المهمة" });
      await ref.update({
        status: normalizedStatus,
        updatedAt: nowIso(),
        updatedBy: actor(req),
      });
      await writeAudit(db, req, "task.status_changed", req.params.id, {
        status: normalizedStatus,
      });
      return res.json({
        success: true,
        status: normalizedStatus.toLowerCase(),
      });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تحديث المهمة" });
    }
  });

  router.get("/rewards/me", async (req, res) => {
    const db = getDb();
    if (!db || !req.user)
      return res
        .status(503)
        .json({ success: false, error: "خدمة النقاط غير مهيأة حالياً" });
    try {
      const balance = await db
        .collection("reward_balances")
        .doc(req.user.uid)
        .get();
      const ledger = await db
        .collection("reward_ledger")
        .where("uid", "==", req.user.uid)
        .limit(100)
        .get();
      const value = balance.data() || {};
      return res.json({
        success: true,
        points: Math.max(0, Number(value.points) || 0),
        gems: Math.max(0, Number(value.gems) || 0),
        receivedGems: Math.max(0, Number(value.receivedGems) || 0),
        leaderboardPoints: leaderboardPointsForGems(
          Number(value.receivedGems) || 0,
        ),
        history: ledger.docs.map((d) => safeLedger(d.data(), d.id)),
      });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تحميل رصيد النقاط" });
    }
  });

  router.post(
    "/rewards/grant",
    requireRbacAction("manage_rewards"),
    async (req, res) => {
      const db = getDb();
      const uid = typeof req.body?.uid === "string" ? req.body.uid : "";
      const points = Number(req.body?.points);
      const reason =
        typeof req.body?.reason === "string"
          ? req.body.reason.trim().slice(0, 500)
          : "";
      const op = idempotencyDigest(req.header("Idempotency-Key"));
      if (
        !db ||
        !uidPattern.test(uid) ||
        !Number.isInteger(points) ||
        points < -100000 ||
        points > 100000 ||
        !reason ||
        !op
      )
        return res.status(400).json({
          success: false,
          error: "بيانات منح النقاط أو مفتاح العملية غير صالحة",
        });
      try {
        const balanceRef = db.collection("reward_balances").doc(uid);
        const opRef = db.collection("reward_operations").doc(op);
        await db.runTransaction(async (tx) => {
          if ((await tx.get(opRef)).exists)
            throw new Error("DUPLICATE_OPERATION");
          const current = await tx.get(balanceRef);
          const next = (Number(current.data()?.points) || 0) + points;
          if (next < 0) throw new Error("INSUFFICIENT_POINTS");
          tx.set(
            balanceRef,
            { points: next, updatedAt: nowIso() },
            { merge: true },
          );
          tx.set(opRef, {
            type: "grant",
            actorUid: actor(req),
            createdAt: nowIso(),
          });
          tx.set(db.collection("reward_ledger").doc(), {
            uid,
            points,
            gems: 0,
            type: "adjustment",
            reason,
            performedBy: actor(req),
            createdAt: nowIso(),
          });
        });
        await writeAudit(db, req, "reward.granted", uid, { points });
        return res.json({ success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        return res
          .status(
            message === "DUPLICATE_OPERATION"
              ? 409
              : message === "INSUFFICIENT_POINTS"
                ? 409
                : 503,
          )
          .json({
            success: false,
            error:
              message === "DUPLICATE_OPERATION"
                ? "تم تنفيذ العملية مسبقاً"
                : message === "INSUFFICIENT_POINTS"
                  ? "الرصيد لا يكفي"
                  : "تعذر تحديث النقاط",
          });
      }
    },
  );

  router.post("/rewards/purchase-gems", async (req, res) => {
    const db = getDb();
    const quantity = Number(req.body?.quantity);
    const cost = gemPackageCost(quantity);
    const op = idempotencyDigest(req.header("Idempotency-Key"));
    if (!db || !req.user || cost === null || !op)
      return res
        .status(400)
        .json({ success: false, error: "حزمة جواهر أو مفتاح عملية غير صالح" });
    try {
      const balanceRef = db.collection("reward_balances").doc(req.user.uid);
      const counterRef = db.collection("reward_gem_windows").doc(req.user.uid);
      const opRef = db.collection("reward_operations").doc(op);
      await db.runTransaction(async (tx) => {
        if ((await tx.get(opRef)).exists)
          throw new Error("DUPLICATE_OPERATION");
        const balance = await tx.get(balanceRef);
        const counter = await tx.get(counterRef);
        const b = balance.data() || {};
        const c = counter.data() || {};
        const start = isWindowActive(c.startedAt)
          ? String(c.startedAt)
          : nowIso();
        const used = isWindowActive(c.startedAt) ? Number(c.count) || 0 : 0;
        if (used + quantity > 5) throw new Error("GEM_LIMIT");
        const points = Number(b.points) || 0;
        if (points < cost) throw new Error("INSUFFICIENT_POINTS");
        tx.set(
          balanceRef,
          {
            points: points - cost,
            gems: (Number(b.gems) || 0) + quantity,
            updatedAt: nowIso(),
          },
          { merge: true },
        );
        tx.set(
          counterRef,
          { startedAt: start, count: used + quantity, updatedAt: nowIso() },
          { merge: true },
        );
        tx.set(opRef, {
          type: "purchase_gems",
          actorUid: actor(req),
          createdAt: nowIso(),
        });
        tx.set(db.collection("reward_ledger").doc(), {
          uid: req.user!.uid,
          points: -cost,
          gems: quantity,
          type: "gem_purchase",
          reason: "شراء جواهر",
          createdAt: nowIso(),
        });
      });
      await writeAudit(db, req, "reward.gems_purchased", req.user.uid, {
        quantity,
        cost,
      });
      return res.json({ success: true, quantity, cost });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return res
        .status(
          message === "DUPLICATE_OPERATION" ||
            message === "GEM_LIMIT" ||
            message === "INSUFFICIENT_POINTS"
            ? 409
            : 503,
        )
        .json({
          success: false,
          error:
            message === "GEM_LIMIT"
              ? "تم بلوغ حد شراء 5 جواهر خلال 24 ساعة"
              : message === "INSUFFICIENT_POINTS"
                ? "الرصيد لا يكفي"
                : message === "DUPLICATE_OPERATION"
                  ? "تم تنفيذ العملية مسبقاً"
                  : "تعذر شراء الجواهر",
        });
    }
  });

  router.post("/rewards/gift-gems", async (req, res) => {
    const db = getDb();
    const recipientUid =
      typeof req.body?.recipientUid === "string" ? req.body.recipientUid : "";
    const quantity = Number(req.body?.quantity);
    const op = idempotencyDigest(req.header("Idempotency-Key"));
    if (
      !db ||
      !req.user ||
      !uidPattern.test(recipientUid) ||
      !op ||
      !canGiftGems(req.user.uid, recipientUid, 5, quantity)
    )
      return res
        .status(400)
        .json({ success: false, error: "بيانات إهداء الجواهر غير صالحة" });
    try {
      const senderRef = db.collection("reward_balances").doc(req.user.uid);
      const recipientRef = db.collection("reward_balances").doc(recipientUid);
      const recipientUser = db.collection("users").doc(recipientUid);
      const opRef = db.collection("reward_operations").doc(op);
      await db.runTransaction(async (tx) => {
        if ((await tx.get(opRef)).exists)
          throw new Error("DUPLICATE_OPERATION");
        if (!(await tx.get(recipientUser)).exists)
          throw new Error("RECIPIENT_NOT_FOUND");
        const sender = await tx.get(senderRef);
        const recipient = await tx.get(recipientRef);
        const sb = sender.data() || {};
        const rb = recipient.data() || {};
        if (
          !canGiftGems(
            req.user!.uid,
            recipientUid,
            Number(sb.gems) || 0,
            quantity,
          )
        )
          throw new Error("INSUFFICIENT_GEMS");
        tx.set(
          senderRef,
          { gems: (Number(sb.gems) || 0) - quantity, updatedAt: nowIso() },
          { merge: true },
        );
        tx.set(
          recipientRef,
          {
            receivedGems: (Number(rb.receivedGems) || 0) + quantity,
            updatedAt: nowIso(),
          },
          { merge: true },
        );
        tx.set(opRef, {
          type: "gift_gems",
          actorUid: actor(req),
          createdAt: nowIso(),
        });
        tx.set(db.collection("reward_ledger").doc(), {
          uid: req.user!.uid,
          points: 0,
          gems: -quantity,
          type: "gem_gift_sent",
          reason: "إهداء جواهر",
          createdAt: nowIso(),
        });
        tx.set(db.collection("reward_ledger").doc(), {
          uid: recipientUid,
          points: quantity * 3,
          gems: quantity,
          type: "gem_gift_received",
          reason: "استلام جواهر",
          createdAt: nowIso(),
        });
      });
      await writeAudit(db, req, "reward.gems_gifted", recipientUid, {
        quantity,
      });
      return res.json({ success: true, quantity });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return res
        .status(
          message === "DUPLICATE_OPERATION" ||
            message === "RECIPIENT_NOT_FOUND" ||
            message === "INSUFFICIENT_GEMS"
            ? 409
            : 503,
        )
        .json({
          success: false,
          error:
            message === "INSUFFICIENT_GEMS"
              ? "لا تملك جواهر كافية"
              : message === "RECIPIENT_NOT_FOUND"
                ? "العضو غير موجود"
                : message === "DUPLICATE_OPERATION"
                  ? "تم تنفيذ العملية مسبقاً"
                  : "تعذر إهداء الجواهر",
        });
    }
  });

  router.post("/rewards/rest-day", async (req, res) => {
    const db = getDb();
    const op = idempotencyDigest(req.header("Idempotency-Key"));
    if (!db || !req.user || !op)
      return res
        .status(400)
        .json({ success: false, error: "مفتاح العملية مطلوب" });
    try {
      const balanceRef = db.collection("reward_balances").doc(req.user.uid);
      const opRef = db.collection("reward_operations").doc(op);
      await db.runTransaction(async (tx) => {
        if ((await tx.get(opRef)).exists)
          throw new Error("DUPLICATE_OPERATION");
        const balance = await tx.get(balanceRef);
        const b = balance.data() || {};
        if (
          isWindowActive(
            typeof b.lastRestDayAt === "string" ? b.lastRestDayAt : undefined,
            Date.now(),
            REST_DAY_WINDOW_MS,
          )
        )
          throw new Error("REST_LIMIT");
        if ((Number(b.points) || 0) < REST_DAY_COST)
          throw new Error("INSUFFICIENT_POINTS");
        tx.set(
          balanceRef,
          {
            points: (Number(b.points) || 0) - REST_DAY_COST,
            lastRestDayAt: nowIso(),
            updatedAt: nowIso(),
          },
          { merge: true },
        );
        tx.set(opRef, {
          type: "rest_day",
          actorUid: actor(req),
          createdAt: nowIso(),
        });
        tx.set(db.collection("reward_ledger").doc(), {
          uid: req.user!.uid,
          points: -REST_DAY_COST,
          gems: 0,
          type: "rest_day",
          reason: "شراء يوم راحة",
          createdAt: nowIso(),
        });
      });
      await writeAudit(db, req, "reward.rest_day_purchased", req.user.uid);
      return res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      return res
        .status(
          message === "DUPLICATE_OPERATION" ||
            message === "REST_LIMIT" ||
            message === "INSUFFICIENT_POINTS"
            ? 409
            : 503,
        )
        .json({
          success: false,
          error:
            message === "REST_LIMIT"
              ? "يمكن شراء يوم راحة مرة واحدة كل أسبوع"
              : message === "INSUFFICIENT_POINTS"
                ? "الرصيد لا يكفي"
                : message === "DUPLICATE_OPERATION"
                  ? "تم تنفيذ العملية مسبقاً"
                  : "تعذر شراء يوم الراحة",
        });
    }
  });
  return router;
}
