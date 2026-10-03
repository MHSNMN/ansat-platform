/**
 * Rewards Router - منصة المجوهرات والنقاط (Router مستقل)
 * مسار: /api/rewards/*
 * يمكن فصله لاحقاً على: rewards.ansatradio.org
 *
 * قواعد ذهبية:
 * - كل عملية مالية = Firestore Transaction
 * - كل عملية تحتاج Idempotency Key
 * - لا رصيد سالب
 * - لا إهداء لنفس الشخص
 * - لا يستطيع العميل الكتابة مباشرة
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import type { DocumentData } from "firebase-admin/firestore";
import { requireRbacAction } from "../authMiddleware";
import {
  canGiftGems,
  gemPackageCost,
  isWindowActive,
  leaderboardPointsForGems,
  totalRewardImpactPoints,
  REST_DAY_COST,
  REST_DAY_WINDOW_MS,
  MAX_GEMS_PER_WINDOW,
} from "../../lib/rewardPolicy";
import { idempotencyDigest } from "../../lib/idempotency";
import { writeAuditLog } from "../audit/auditService";
import { getFirebaseAdminFirestore } from "../firebaseAdmin";
import { getSupabaseAdminClient } from "../supabaseAdmin";

export const rewardsRouter = Router();
const uidPattern = /^[A-Za-z0-9_-]{1,128}$/;
const nowIso = () => new Date().toISOString();

// In-Memory Caches to eliminate Firestore Read Spikes (Quota Protection)
let leaderboardCache: { data: any[]; timestamp: number } | null = null;
const LEADERBOARD_CACHE_TTL_MS = 60 * 1000; // 60s

let rewardsMembersCache: { data: any[]; timestamp: number } | null = null;
const REWARDS_MEMBERS_CACHE_TTL_MS = 120 * 1000; // 2 min

let communityCache: { data: any; timestamp: number } | null = null;
const COMMUNITY_CACHE_TTL_MS = 60 * 1000; // 60s

export function invalidateRewardsCommunityCache() {
  communityCache = null;
}
export function invalidateRewardsLeaderboardCache() {
  leaderboardCache = null;
}
export function invalidateRewardsMembersCache() {
  rewardsMembersCache = null;
}

function publicMemberName(
  data: DocumentData | undefined,
  fallback = "عضو إنصات",
) {
  const value = data || {};
  const name =
    value.displayName || value.name || value.fullName || value.username;
  return typeof name === "string" && name.trim()
    ? name.trim().slice(0, 100)
    : fallback;
}

function totalLeaderboardPoints(points: unknown, receivedGems: unknown) {
  return totalRewardImpactPoints(
    Number(points) || 0,
    Number(receivedGems) || 0,
  );
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safePublicUrl(value: unknown) {
  const text = cleanText(value, 1500);
  if (!text) return "";
  try {
    const url = new URL(text);
    return ["https:", "http:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

// GET /api/rewards/me
rewardsRouter.get("/me", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  if (!db || !req.user)
    return res
      .status(503)
      .json({ success: false, error: "خدمة النقاط غير متاحة" });
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
    const val = balance.data() || {};
    const points = Math.max(0, Number(val.points) || 0);
    const receivedGems = Math.max(0, Number(val.receivedGems) || 0);
    const history = ledger.docs
      .map((d) => ({ id: d.id, ...d.data() }) as any)
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")),
      );

    return res.json({
      success: true,
      points,
      gems: Math.max(0, Number(val.gems) || 0),
      receivedGems,
      leaderboardPoints: totalLeaderboardPoints(points, receivedGems),
      lastRestDay:
        typeof val.lastRestDay === "string" ? val.lastRestDay : undefined,
      history,
    });
  } catch (err) {
    console.warn("[Rewards] /me fetch error:", err);
    return res.status(503).json({ success: false, error: "تعذر تحميل الرصيد" });
  }
});

// GET /api/rewards/leaderboard
rewardsRouter.get("/leaderboard", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  if (!db || !req.user)
    return res
      .status(503)
      .json({ success: false, error: "خدمة النقاط غير متاحة" });

  const now = Date.now();
  if (
    leaderboardCache &&
    now - leaderboardCache.timestamp < LEADERBOARD_CACHE_TTL_MS
  ) {
    return res.json({ success: true, leaderboard: leaderboardCache.data });
  }

  try {
    const balancesSnap = await db
      .collection("reward_balances")
      .limit(100)
      .get();
    const balancesMap = new Map<string, any>();
    balancesSnap.docs.forEach((d) => {
      balancesMap.set(d.id, d.data());
    });

    // Resolve user names primarily from Supabase profiles (0 Firestore reads)
    const userNamesMap = new Map<string, string>();
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, firebase_uid, full_name, username")
          .eq("is_archived", false);
        if (profiles) {
          profiles.forEach((p: any) => {
            const name = p.full_name || p.username || "عضو إنصات";
            if (p.firebase_uid) userNamesMap.set(p.firebase_uid, name);
            if (p.id) userNamesMap.set(p.id, name);
          });
        }
      } catch (err) {
        console.warn("[Rewards] Supabase profile names warning:", err);
      }
    }

    const ranked: any[] = [];
    for (const [uid, bData] of balancesMap.entries()) {
      const points = Math.max(0, Number(bData.points ?? 0));
      const receivedGems = Math.max(0, Number(bData.receivedGems ?? 0));
      const totalPoints = totalLeaderboardPoints(points, receivedGems);
      if (totalPoints > 0) {
        const name =
          userNamesMap.get(uid) ||
          bData.name ||
          bData.displayName ||
          "عضو إنصات";
        ranked.push({
          uid,
          name,
          points,
          receivedGems,
          leaderboardPoints: totalPoints,
        });
      }
    }

    ranked.sort(
      (a, b) =>
        b.leaderboardPoints - a.leaderboardPoints ||
        a.name.localeCompare(b.name, "ar"),
    );
    const finalLeaderboard = ranked.slice(0, 50).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    leaderboardCache = { data: finalLeaderboard, timestamp: now };
    return res.json({ success: true, leaderboard: finalLeaderboard });
  } catch (err) {
    console.error("[Rewards] Leaderboard error:", err);
    if (leaderboardCache) {
      return res.json({ success: true, leaderboard: leaderboardCache.data });
    }
    return res
      .status(500)
      .json({ success: false, error: "تعذر تحميل المتصدرين", leaderboard: [] });
  }
});

// GET /api/rewards/members — أقل قدر من بيانات العضو اللازمة للإهداء فقط (يستخدم Supabase لتوفير قراءات Firestore بالكامل)
rewardsRouter.get("/members", async (req, res) => {
  if (!req.user)
    return res.status(401).json({ success: false, error: "غير مصرح" });

  const now = Date.now();
  if (
    rewardsMembersCache &&
    now - rewardsMembersCache.timestamp < REWARDS_MEMBERS_CACHE_TTL_MS
  ) {
    const filtered = rewardsMembersCache.data.filter(
      (m) => m.uid !== req.user?.uid,
    );
    return res.json({ success: true, members: filtered });
  }

  // 1. Try Supabase first (0 Firestore reads!)
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, firebase_uid, full_name, username, status, is_archived")
        .eq("is_archived", false)
        .limit(300);

      if (!error && profiles && profiles.length > 0) {
        const membersList = profiles
          .filter(
            (p: any) =>
              !["disabled", "suspended"].includes(
                String(p.status || "").toLowerCase(),
              ),
          )
          .map((p: any) => ({
            uid: p.firebase_uid || p.id,
            name: (p.full_name || p.username || "عضو إنصات").trim(),
          }))
          .sort((a: any, b: any) => a.name.localeCompare(b.name, "ar"));

        rewardsMembersCache = { data: membersList, timestamp: now };
        const filtered = membersList.filter((m) => m.uid !== req.user?.uid);
        return res.json({ success: true, members: filtered });
      }
    } catch (sbErr) {
      console.warn("[Rewards] Supabase get members fallback:", sbErr);
    }
  }

  // 2. Fallback to Firestore only if Supabase is unavailable
  const db = getFirebaseAdminFirestore();
  if (!db)
    return res
      .status(503)
      .json({ success: false, error: "خدمة الأعضاء غير متاحة" });
  try {
    const snapshot = await db.collection("users").limit(100).get();
    const membersList = snapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter(
        ({ data }) =>
          !["disabled", "suspended", "pending"].includes(
            String(data.status || data.workflowStatus || "").toLowerCase(),
          ),
      )
      .map(({ id, data }) => ({ uid: id, name: publicMemberName(data) }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));

    rewardsMembersCache = { data: membersList, timestamp: now };
    const filtered = membersList.filter((m) => m.uid !== req.user?.uid);
    return res.json({ success: true, members: filtered });
  } catch {
    return res
      .status(503)
      .json({ success: false, error: "تعذر تحميل قائمة الأعضاء" });
  }
});

// GET /api/rewards/community — محتوى اجتماعي محدود وآمن للأعضاء مع كاش لحماية كوتة القراءة
rewardsRouter.get("/community", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  if (!db || !req.user)
    return res.status(503).json({ success: false, error: "المجتمع غير متاح" });

  const now = Date.now();
  if (
    communityCache &&
    now - communityCache.timestamp < COMMUNITY_CACHE_TTL_MS
  ) {
    return res.json(communityCache.data);
  }

  try {
    const [posts, activities, sessions] = await Promise.all([
      db
        .collection("reward_posts")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
      db
        .collection("reward_activities")
        .orderBy("datetime", "desc")
        .limit(20)
        .get(),
      db
        .collection("reward_sessions")
        .orderBy("createdAt", "desc")
        .limit(20)
        .get(),
    ]);

    const result = {
      success: true,
      posts: posts.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      activities: activities.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      sessions: sessions.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    };

    communityCache = { data: result, timestamp: now };
    return res.json(result);
  } catch {
    if (communityCache) return res.json(communityCache.data);
    return res
      .status(503)
      .json({ success: false, error: "تعذر تحميل مساحة المجتمع" });
  }
});

rewardsRouter.post("/posts", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const text = cleanText(req.body?.text, 1200);
  if (!db || !req.user || text.length < 2)
    return res
      .status(400)
      .json({ success: false, error: "اكتب منشوراً صالحاً" });
  try {
    const authorName =
      req.user.name || req.user.displayName || req.user.fullName || "عضو إنصات";
    const ref = await db
      .collection("reward_posts")
      .add({ authorUid: req.user.uid, authorName, text, createdAt: nowIso() });
    invalidateRewardsCommunityCache();
    await writeAuditLog(req, "reward.post_created", "rewards", ref.id);
    return res.status(201).json({ success: true, id: ref.id });
  } catch {
    return res.status(503).json({ success: false, error: "تعذر نشر التحديث" });
  }
});

rewardsRouter.get("/certificates/me", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  if (!db || !req.user)
    return res
      .status(503)
      .json({ success: false, error: "الشهادات غير متاحة" });
  try {
    const snapshot = await db
      .collection("certificates")
      .where("memberId", "==", req.user.uid)
      .limit(100)
      .get();
    return res.json({
      success: true,
      certificates: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    });
  } catch {
    return res
      .status(503)
      .json({ success: false, error: "تعذر تحميل شهاداتك" });
  }
});

rewardsRouter.get("/certificates/:code", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const code = cleanText(req.params.code, 80).toUpperCase();
  if (!db || !/^[A-Z0-9-]{4,80}$/.test(code))
    return res
      .status(400)
      .json({ success: false, error: "رمز الشهادة غير صالح" });
  try {
    const snapshot = await db
      .collection("certificates")
      .where("code", "==", code)
      .limit(1)
      .get();
    if (snapshot.empty)
      return res
        .status(404)
        .json({ success: false, error: "لم يتم العثور على الشهادة" });
    const data = snapshot.docs[0].data();
    return res.json({
      success: true,
      certificate: {
        code,
        recipientName: cleanText(data.recipientName, 120),
        certType: cleanText(data.certType, 120),
        reason: cleanText(data.reason, 500),
        grantingEntity: cleanText(data.grantingEntity, 120),
        issuedAt: cleanText(data.issuedAt || data.createdAt, 80),
        status: cleanText(data.status, 40),
        imageUrl: safePublicUrl(data.imageUrl),
      },
    });
  } catch {
    return res
      .status(503)
      .json({ success: false, error: "تعذر التحقق من الشهادة" });
  }
});

rewardsRouter.post("/support-requests", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const type = cleanText(req.body?.type, 30);
  const text = cleanText(req.body?.text, 1600);
  const pointsRequested = Math.max(
    0,
    Math.min(100000, Math.floor(Number(req.body?.pointsRequested) || 0)),
  );
  if (
    !db ||
    !req.user ||
    !["complaint", "points", "certificate"].includes(type) ||
    text.length < 4
  ) {
    return res
      .status(400)
      .json({ success: false, error: "بيانات الطلب غير مكتملة" });
  }
  try {
    const ref = await db.collection("reward_support_requests").add({
      memberId: req.user.uid,
      type,
      text,
      pointsRequested: type === "points" ? pointsRequested : 0,
      status: "pending",
      createdAt: nowIso(),
    });
    await writeAuditLog(req, "reward.support_requested", "rewards", ref.id, {
      type,
    });
    return res.status(201).json({ success: true, id: ref.id });
  } catch {
    return res.status(503).json({ success: false, error: "تعذر إرسال الطلب" });
  }
});

rewardsRouter.get("/support-requests/me", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  if (!db || !req.user)
    return res.status(503).json({ success: false, error: "الطلبات غير متاحة" });
  try {
    const snapshot = await db
      .collection("reward_support_requests")
      .where("memberId", "==", req.user.uid)
      .limit(100)
      .get();
    const requests = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return { id: doc.id, createdAt: data.createdAt, ...data };
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return res.json({ success: true, requests });
  } catch {
    return res.status(503).json({ success: false, error: "تعذر تحميل طلباتك" });
  }
});

// POST /api/rewards/grant — منح نقاط (admin فقط)
rewardsRouter.post(
  "/grant",
  requireRbacAction("manage_rewards"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
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
    ) {
      return res.status(400).json({
        success: false,
        error: "بيانات المنح غير صالحة أو مفتاح الـIdempotency مفقود",
      });
    }
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
          actorUid: req.user?.uid,
          createdAt: nowIso(),
        });
        tx.set(db.collection("reward_ledger").doc(), {
          uid,
          points,
          gems: 0,
          type: "grant",
          reason,
          performedBy: req.user?.uid,
          createdAt: nowIso(),
        });
      });
      await writeAuditLog(req, "reward.granted", "rewards", uid, { points });
      return res.json({ success: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return res
        .status(
          msg === "DUPLICATE_OPERATION"
            ? 409
            : msg === "INSUFFICIENT_POINTS"
              ? 409
              : 503,
        )
        .json({
          success: false,
          error:
            msg === "DUPLICATE_OPERATION"
              ? "تم تنفيذ العملية مسبقاً"
              : msg === "INSUFFICIENT_POINTS"
                ? "الرصيد لا يكفي"
                : "تعذر تحديث النقاط",
        });
    }
  },
);

// POST /api/rewards/purchase-gems — شراء جواهر
rewardsRouter.post("/purchase-gems", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const quantity = Number(req.body?.quantity);
  const op = idempotencyDigest(req.header("Idempotency-Key"));
  if (!db || !req.user || !Number.isInteger(quantity) || !op) {
    return res.status(400).json({
      success: false,
      error: "كمية غير صالحة أو مفتاح الـIdempotency مفقود",
    });
  }
  const cost = gemPackageCost(quantity);
  if (cost === null) {
    return res
      .status(400)
      .json({ success: false, error: "الكمية المتاحة: 1، 3، أو 5 جواهر" });
  }
  try {
    const balanceRef = db.collection("reward_balances").doc(req.user.uid);
    const opRef = db.collection("reward_operations").doc(op);
    const windowRef = db.collection("reward_gem_windows").doc(req.user.uid);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(opRef)).exists) throw new Error("DUPLICATE_OPERATION");
      const [balDoc, winDoc] = await Promise.all([
        tx.get(balanceRef),
        tx.get(windowRef),
      ]);
      const bal = balDoc.data() || {};
      const win = winDoc.data() || {};
      if (isWindowActive(win.windowStart)) {
        const used = Number(win.gemsUsed) || 0;
        if (used + quantity > MAX_GEMS_PER_WINDOW) {
          throw new Error("GEM_LIMIT_EXCEEDED");
        }
        tx.set(windowRef, { gemsUsed: used + quantity }, { merge: true });
      } else {
        tx.set(windowRef, { windowStart: nowIso(), gemsUsed: quantity });
      }
      const points = Number(bal.points) || 0;
      if (points < cost) throw new Error("INSUFFICIENT_POINTS");
      tx.set(
        balanceRef,
        {
          points: points - cost,
          gems: (Number(bal.gems) || 0) + quantity,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
      tx.set(opRef, {
        type: "purchase",
        actorUid: req.user?.uid,
        createdAt: nowIso(),
      });
      tx.set(db.collection("reward_ledger").doc(), {
        uid: req.user?.uid,
        points: -cost,
        gems: quantity,
        type: "purchase",
        reason: `شراء ${quantity} جوهرة`,
        createdAt: nowIso(),
      });
    });
    await writeAuditLog(req, "reward.gems_purchased", "rewards", req.user.uid, {
      quantity,
      cost,
    });
    return res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return res
      .status(
        msg === "DUPLICATE_OPERATION"
          ? 409
          : msg === "GEM_LIMIT_EXCEEDED"
            ? 429
            : msg === "INSUFFICIENT_POINTS"
              ? 409
              : 503,
      )
      .json({
        success: false,
        error:
          msg === "DUPLICATE_OPERATION"
            ? "تم تنفيذ العملية مسبقاً"
            : msg === "GEM_LIMIT_EXCEEDED"
              ? "تجاوزت الحد (5 جواهر/24 ساعة)"
              : msg === "INSUFFICIENT_POINTS"
                ? "الرصيد لا يكفي"
                : "تعذر شراء الجواهر",
      });
  }
});

// POST /api/rewards/gift-gems — إهداء جواهر
rewardsRouter.post("/gift-gems", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const toUid = typeof req.body?.toUid === "string" ? req.body.toUid : "";
  const quantity = Number(req.body?.quantity);
  const op = idempotencyDigest(req.header("Idempotency-Key"));
  if (!db || !req.user || !uidPattern.test(toUid) || !op) {
    return res
      .status(400)
      .json({ success: false, error: "بيانات الإهداء غير صالحة" });
  }
  if (toUid === req.user.uid) {
    return res
      .status(400)
      .json({ success: false, error: "لا يمكنك إهداء جوهرة لنفسك" });
  }
  try {
    const senderRef = db.collection("reward_balances").doc(req.user.uid);
    const receiverRef = db.collection("reward_balances").doc(toUid);
    const receiverProfileRef = db.collection("users").doc(toUid);
    const opRef = db.collection("reward_operations").doc(op);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(opRef)).exists) throw new Error("DUPLICATE_OPERATION");
      const [sender, receiver, receiverProfile] = await Promise.all([
        tx.get(senderRef),
        tx.get(receiverRef),
        tx.get(receiverProfileRef),
      ]);
      const receiverStatus = String(
        receiverProfile.data()?.status ||
          receiverProfile.data()?.workflowStatus ||
          "active",
      ).toLowerCase();
      if (
        !receiverProfile.exists ||
        ["disabled", "suspended", "pending"].includes(receiverStatus)
      ) {
        throw new Error("RECIPIENT_UNAVAILABLE");
      }
      const senderData = sender.data() || {};
      if (
        !canGiftGems(
          req.user!.uid,
          toUid,
          Number(senderData.gems) || 0,
          quantity,
        )
      ) {
        throw new Error("CANNOT_GIFT");
      }
      tx.set(
        senderRef,
        {
          gems: (Number(senderData.gems) || 0) - quantity,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
      const receiverData = receiver.data() || {};
      const newReceivedGems =
        (Number(receiverData.receivedGems) || 0) + quantity;
      const giftId = randomUUID();
      tx.set(
        receiverRef,
        { receivedGems: newReceivedGems, updatedAt: nowIso() },
        { merge: true },
      );
      tx.set(opRef, {
        type: "gift",
        actorUid: req.user?.uid,
        createdAt: nowIso(),
      });
      tx.set(db.collection("reward_ledger").doc(), {
        uid: req.user?.uid,
        gems: -quantity,
        points: 0,
        type: "gift_sent",
        giftId,
        reason: `إهداء ${quantity} جوهرة`,
        toUid,
        createdAt: nowIso(),
      });
      tx.set(db.collection("reward_ledger").doc(), {
        uid: toUid,
        gems: quantity,
        points: leaderboardPointsForGems(quantity),
        type: "gift_received",
        giftId,
        reason: `استلام ${quantity} جوهرة`,
        fromUid: req.user?.uid,
        createdAt: nowIso(),
      });
    });
    await writeAuditLog(req, "reward.gems_gifted", "rewards", toUid, {
      quantity,
    });
    return res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return res
      .status(
        msg === "DUPLICATE_OPERATION"
          ? 409
          : ["CANNOT_GIFT", "RECIPIENT_UNAVAILABLE"].includes(msg)
            ? 400
            : 503,
      )
      .json({
        success: false,
        error:
          msg === "DUPLICATE_OPERATION"
            ? "تم تنفيذ العملية مسبقاً"
            : msg === "RECIPIENT_UNAVAILABLE"
              ? "العضو المختار غير متاح للإهداء"
              : msg === "CANNOT_GIFT"
                ? "لا يمكن إتمام الإهداء"
                : "تعذر إهداء الجواهر",
      });
  }
});

// POST /api/rewards/rest-day — طلب يوم راحة
rewardsRouter.post("/rest-day", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const op = idempotencyDigest(req.header("Idempotency-Key"));
  if (!db || !req.user || !op)
    return res
      .status(400)
      .json({ success: false, error: "مفتاح الـIdempotency مفقود" });
  try {
    const balanceRef = db.collection("reward_balances").doc(req.user.uid);
    const opRef = db.collection("reward_operations").doc(op);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(opRef)).exists) throw new Error("DUPLICATE_OPERATION");
      const bal = await tx.get(balanceRef);
      const data = bal.data() || {};
      if (isWindowActive(data.lastRestDay, Date.now(), REST_DAY_WINDOW_MS)) {
        throw new Error("REST_DAY_TOO_SOON");
      }
      const points = Number(data.points) || 0;
      if (points < REST_DAY_COST) throw new Error("INSUFFICIENT_POINTS");
      tx.set(
        balanceRef,
        {
          points: points - REST_DAY_COST,
          lastRestDay: nowIso(),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
      tx.set(opRef, {
        type: "rest_day",
        actorUid: req.user?.uid,
        createdAt: nowIso(),
      });
      tx.set(db.collection("reward_ledger").doc(), {
        uid: req.user?.uid,
        points: -REST_DAY_COST,
        gems: 0,
        type: "rest_day",
        reason: "يوم راحة",
        createdAt: nowIso(),
      });
    });
    await writeAuditLog(req, "reward.rest_day", "rewards", req.user.uid);
    return res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return res
      .status(
        msg === "DUPLICATE_OPERATION"
          ? 409
          : msg === "REST_DAY_TOO_SOON"
            ? 429
            : msg === "INSUFFICIENT_POINTS"
              ? 409
              : 503,
      )
      .json({
        success: false,
        error:
          msg === "DUPLICATE_OPERATION"
            ? "تم تنفيذ العملية مسبقاً"
            : msg === "REST_DAY_TOO_SOON"
              ? "يمكنك طلب يوم راحة مرة كل 7 أيام فقط"
              : msg === "INSUFFICIENT_POINTS"
                ? "الرصيد لا يكفي (مطلوب 30 نقطة)"
                : "تعذر تنفيذ الطلب",
      });
  }
});

// POST /api/rewards/nominate-badge — ترشيح زميل لوسام (يكلف 7 نقاط)
rewardsRouter.post("/nominate-badge", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const toUid = typeof req.body?.toUid === "string" ? req.body.toUid : "";
  const badgeKey = cleanText(req.body?.badgeKey, 60);
  const badgeTitle = cleanText(req.body?.badgeTitle, 100) || "وسام تقديري";
  const reason = cleanText(req.body?.reason, 500);
  const op = idempotencyDigest(req.header("Idempotency-Key"));

  if (
    !db ||
    !req.user ||
    !uidPattern.test(toUid) ||
    !badgeKey ||
    !reason ||
    !op
  ) {
    return res.status(400).json({
      success: false,
      error: "بيانات الترشيح غير مكتملة أو مفتاح التكرار مفقود",
    });
  }
  if (toUid === req.user.uid) {
    return res
      .status(400)
      .json({ success: false, error: "لا يمكنك ترشيح نفسك لوسام" });
  }

  const NOMINATION_COST = 7;

  try {
    const senderBalanceRef = db.collection("reward_balances").doc(req.user.uid);
    const candidateDoc = await db.collection("users").doc(toUid).get();
    const candidateName = publicMemberName(candidateDoc.data());
    const senderDoc = await db.collection("users").doc(req.user.uid).get();
    const senderName = publicMemberName(senderDoc.data());
    const opRef = db.collection("reward_operations").doc(op);

    await db.runTransaction(async (tx) => {
      if ((await tx.get(opRef)).exists) throw new Error("DUPLICATE_OPERATION");
      const senderBal = await tx.get(senderBalanceRef);
      const points = Number(senderBal.data()?.points) || 0;
      if (points < NOMINATION_COST) throw new Error("INSUFFICIENT_POINTS");

      tx.set(
        senderBalanceRef,
        { points: points - NOMINATION_COST, updatedAt: nowIso() },
        { merge: true },
      );
      tx.set(opRef, {
        type: "nomination",
        actorUid: req.user?.uid,
        createdAt: nowIso(),
      });
      tx.set(db.collection("reward_ledger").doc(), {
        uid: req.user?.uid,
        points: -NOMINATION_COST,
        gems: 0,
        type: "nomination",
        reason: `ترشيح ${candidateName} لـ (${badgeTitle})`,
        candidateUid: toUid,
        createdAt: nowIso(),
      });
      tx.set(db.collection("reward_nominations").doc(), {
        nominatorUid: req.user?.uid,
        nominatorName: senderName,
        candidateUid: toUid,
        candidateName,
        badgeKey,
        badgeTitle,
        reason,
        cost: NOMINATION_COST,
        status: "pending",
        createdAt: nowIso(),
      });
    });

    await writeAuditLog(req, "reward.badge_nominated", "rewards", toUid, {
      badgeKey,
      badgeTitle,
    });
    return res.json({
      success: true,
      message: "تم إرسال الترشيح لمراجعة الإدارة وخصم 7 نقاط.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return res
      .status(
        msg === "DUPLICATE_OPERATION"
          ? 409
          : msg === "INSUFFICIENT_POINTS"
            ? 400
            : 503,
      )
      .json({
        success: false,
        error:
          msg === "DUPLICATE_OPERATION"
            ? "تم تقديم الطلب مسبقاً"
            : msg === "INSUFFICIENT_POINTS"
              ? "رصيدك لا يكفي (مطلوب 7 نقاط للترشيح)"
              : "تعذر إرسال الترشيح",
      });
  }
});

// POST /api/rewards/nominations (alias for nominate-badge)
rewardsRouter.post("/nominations", async (req, res, next) => {
  if (req.body && req.body.candidateUid && !req.body.toUid) {
    req.body.toUid = req.body.candidateUid;
  }
  const handler = rewardsRouter.stack.find(
    (layer) => layer.route?.path === "/nominate-badge",
  )?.route?.stack[0]?.handle;
  if (handler) {
    return handler(req, res, next);
  }
  next();
});

// POST /api/rewards/posts/:id/like — الإعجاب أو إلغاء الإعجاب بمنشور
rewardsRouter.post("/posts/:id/like", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const postId = cleanText(req.params.id, 80);
  if (!db || !req.user || !postId)
    return res.status(400).json({ success: false, error: "طلب غير صالح" });
  try {
    const postRef = db.collection("reward_posts").doc(postId);
    let liked = false;
    let likesCount = 0;

    await db.runTransaction(async (tx) => {
      const doc = await tx.get(postRef);
      if (!doc.exists) throw new Error("NOT_FOUND");
      const data = doc.data() || {};
      const likedBy = Array.isArray(data.likedBy) ? [...data.likedBy] : [];
      const userIndex = likedBy.indexOf(req.user!.uid);

      if (userIndex >= 0) {
        likedBy.splice(userIndex, 1);
        liked = false;
      } else {
        likedBy.push(req.user!.uid);
        liked = true;
      }

      likesCount = likedBy.length;
      tx.set(
        postRef,
        { likedBy, likesCount, likes: likesCount },
        { merge: true },
      );
    });

    return res.json({ success: true, liked, likesCount });
  } catch (err: any) {
    if (err?.message === "NOT_FOUND")
      return res
        .status(404)
        .json({ success: false, error: "المنشور غير موجود" });
    return res.status(503).json({ success: false, error: "تعذر حفظ الإعجاب" });
  }
});

// POST /api/rewards/posts/:id/comments
rewardsRouter.post("/posts/:id/comments", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const text = cleanText(req.body?.text, 600);
  const postId = cleanText(req.params.id, 80);
  if (!db || !req.user || !postId || text.length < 1) {
    return res.status(400).json({ success: false, error: "تعليق غير صالح" });
  }
  try {
    const profile = await db.collection("users").doc(req.user.uid).get();
    const commentRef = await db
      .collection("reward_posts")
      .doc(postId)
      .collection("comments")
      .add({
        authorUid: req.user.uid,
        authorName: publicMemberName(profile.data()),
        text,
        createdAt: nowIso(),
      });
    return res.json({ success: true, id: commentRef.id });
  } catch {
    return res
      .status(503)
      .json({ success: false, error: "تعذر إضافة التعليق" });
  }
});

// GET /api/rewards/posts/:id/comments
rewardsRouter.get("/posts/:id/comments", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const postId = cleanText(req.params.id, 80);
  if (!db || !postId)
    return res.status(400).json({ success: false, error: "معرّف غير صالح" });
  try {
    const snapshot = await db
      .collection("reward_posts")
      .doc(postId)
      .collection("comments")
      .orderBy("createdAt", "asc")
      .limit(50)
      .get();
    return res.json({
      success: true,
      comments: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch {
    return res
      .status(503)
      .json({ success: false, error: "تعذر تحميل التعليقات" });
  }
});

// DELETE /api/rewards/posts/:id
rewardsRouter.delete("/posts/:id", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const postId = cleanText(req.params.id, 80);
  if (!db || !req.user || !postId)
    return res.status(400).json({ success: false, error: "طلب غير صالح" });
  try {
    const postDoc = await db.collection("reward_posts").doc(postId).get();
    if (!postDoc.exists)
      return res
        .status(404)
        .json({ success: false, error: "المنشور غير موجود" });
    const postData = postDoc.data() || {};
    const isAuthor = postData.authorUid === req.user.uid;
    const canDeleteAny = ["SUPER_ADMIN", "ADMIN", "REWARDS_MANAGER"].includes(
      req.user.canonicalRole,
    );
    if (!isAuthor && !canDeleteAny) {
      return res
        .status(403)
        .json({ success: false, error: "لا تملك صلاحية حذف هذا المنشور" });
    }
    await db.collection("reward_posts").doc(postId).delete();
    invalidateRewardsCommunityCache();
    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, error: "تعذر حذف المنشور" });
  }
});

// POST /api/rewards/sessions/:id/react
rewardsRouter.post("/sessions/:id/react", async (req, res) => {
  const db = getFirebaseAdminFirestore();
  const sessionId = cleanText(req.params.id, 80);
  const emoji = cleanText(req.body?.emoji, 20);
  if (!db || !req.user || !sessionId || !emoji)
    return res.status(400).json({ success: false, error: "بيانات غير صالحة" });
  try {
    const sessionRef = db.collection("reward_sessions").doc(sessionId);
    await db.runTransaction(async (tx) => {
      const doc = await tx.get(sessionRef);
      if (!doc.exists) return;
      const data = doc.data() || {};
      const reactions = data.reactions || {};
      const count = Number(reactions[emoji]) || 0;
      tx.set(
        sessionRef,
        { reactions: { ...reactions, [emoji]: count + 1 } },
        { merge: true },
      );
    });
    return res.json({ success: true });
  } catch {
    return res.status(503).json({ success: false, error: "تعذر حفظ التفاعل" });
  }
});

// POST /api/rewards/sessions/:id/reactions (alias)
rewardsRouter.post("/sessions/:id/reactions", async (req, res, next) => {
  const handler = rewardsRouter.stack.find(
    (layer) => layer.route?.path === "/sessions/:id/react",
  )?.route?.stack[0]?.handle;
  if (handler) {
    return handler(req, res, next);
  }
  next();
});

// POST /api/rewards/admin/reverse-transaction (alias for /reverse)
rewardsRouter.post(
  "/admin/reverse-transaction",
  requireRbacAction("reverse_points_transaction"),
  async (req, res, next) => {
    const handler = rewardsRouter.stack.find(
      (layer) => layer.route?.path === "/reverse",
    )?.route?.stack[0]?.handle;
    if (handler) {
      return handler(req, res, next);
    }
    next();
  },
);

// POST /api/rewards/deduct — خصم نقاط (admin)
rewardsRouter.post(
  "/deduct",
  requireRbacAction("deduct_points"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const uid = typeof req.body?.uid === "string" ? req.body.uid : "";
    const points = Math.abs(Number(req.body?.points));
    const reason = cleanText(req.body?.reason, 500);
    const op = idempotencyDigest(req.header("Idempotency-Key"));

    if (
      !db ||
      !uidPattern.test(uid) ||
      !Number.isInteger(points) ||
      points <= 0 ||
      points > 100000 ||
      !reason ||
      !op
    ) {
      return res.status(400).json({
        success: false,
        error: "بيانات الخصم غير صالحة أو مفتاح الـIdempotency مفقود",
      });
    }

    try {
      const balanceRef = db.collection("reward_balances").doc(uid);
      const opRef = db.collection("reward_operations").doc(op);

      await db.runTransaction(async (tx) => {
        if ((await tx.get(opRef)).exists)
          throw new Error("DUPLICATE_OPERATION");
        const current = await tx.get(balanceRef);
        const currentPoints = Number(current.data()?.points) || 0;
        if (currentPoints < points) throw new Error("INSUFFICIENT_POINTS");

        tx.set(
          balanceRef,
          { points: currentPoints - points, updatedAt: nowIso() },
          { merge: true },
        );
        tx.set(opRef, {
          type: "deduct",
          actorUid: req.user?.uid,
          createdAt: nowIso(),
        });
        tx.set(db.collection("reward_ledger").doc(), {
          uid,
          points: -points,
          gems: 0,
          type: "deduct",
          reason,
          performedBy: req.user?.uid,
          createdAt: nowIso(),
        });
      });

      await writeAuditLog(req, "reward.deducted", "rewards", uid, {
        points,
        reason,
      });
      return res.json({ success: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return res
        .status(
          msg === "DUPLICATE_OPERATION"
            ? 409
            : msg === "INSUFFICIENT_POINTS"
              ? 400
              : 503,
        )
        .json({
          success: false,
          error:
            msg === "DUPLICATE_OPERATION"
              ? "تم تنفيذ العملية مسبقاً"
              : msg === "INSUFFICIENT_POINTS"
                ? "رصيد العضو لا يكفي لهذا الخصم"
                : "تعذر خصم النقاط",
        });
    }
  },
);

// POST /api/rewards/reverse — عكس معاملة سابقة (admin)
rewardsRouter.post(
  "/reverse",
  requireRbacAction("reverse_points_transaction"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const txId = cleanText(req.body?.transactionId, 80);
    const reason = cleanText(req.body?.reason, 500);
    const op = idempotencyDigest(req.header("Idempotency-Key"));

    if (!db || !txId || !reason || !op) {
      return res.status(400).json({
        success: false,
        error: "معرّف المعاملة وسبب العكس ومفتاح Idempotency مطلوبان",
      });
    }

    try {
      const txRef = db.collection("reward_ledger").doc(txId);
      const opRef = db.collection("reward_operations").doc(op);

      await db.runTransaction(async (tx) => {
        if ((await tx.get(opRef)).exists)
          throw new Error("DUPLICATE_OPERATION");
        const origSnap = await tx.get(txRef);
        if (!origSnap.exists) throw new Error("TRANSACTION_NOT_FOUND");
        const orig = origSnap.data() || {};
        if (orig.reversed) throw new Error("ALREADY_REVERSED");
        if (orig.type === "gift_received")
          throw new Error("REVERSE_ORIGINAL_GIFT_ONLY");

        const targetUid = orig.uid;
        const reversePoints = -1 * (Number(orig.points) || 0);
        const reverseGems = -1 * (Number(orig.gems) || 0);

        const balRef = db.collection("reward_balances").doc(targetUid);
        const balSnap = await tx.get(balRef);
        const balData = balSnap.data() || {};
        const newPoints = (Number(balData.points) || 0) + reversePoints;
        const newGems = (Number(balData.gems) || 0) + reverseGems;

        if (orig.type === "gift_sent") {
          const receiverUid = String(orig.toUid || "");
          if (!uidPattern.test(receiverUid))
            throw new Error("INVALID_GIFT_TARGET");
          const receiverRef = db.collection("reward_balances").doc(receiverUid);
          const receiverSnap = await tx.get(receiverRef);
          const receivedAfter =
            (Number(receiverSnap.data()?.receivedGems) || 0) +
            Number(orig.gems || 0);
          if (receivedAfter < 0) throw new Error("NEGATIVE_BALANCE_FORBIDDEN");
          tx.set(
            receiverRef,
            { receivedGems: receivedAfter, updatedAt: nowIso() },
            { merge: true },
          );
        }

        if (newPoints < 0 || newGems < 0)
          throw new Error("NEGATIVE_BALANCE_FORBIDDEN");

        tx.set(
          balRef,
          { points: newPoints, gems: newGems, updatedAt: nowIso() },
          { merge: true },
        );
        tx.set(
          txRef,
          { reversed: true, reversedAt: nowIso(), reversedBy: req.user?.uid },
          { merge: true },
        );
        tx.set(opRef, {
          type: "reversal",
          actorUid: req.user?.uid,
          createdAt: nowIso(),
        });
        tx.set(db.collection("reward_ledger").doc(), {
          uid: targetUid,
          points: reversePoints,
          gems: reverseGems,
          type: "reversal",
          originalTransactionId: txId,
          reason: `عكس معاملة: ${reason}`,
          performedBy: req.user?.uid,
          createdAt: nowIso(),
        });
      });

      await writeAuditLog(req, "reward.transaction_reversed", "rewards", txId, {
        reason,
      });
      return res.json({
        success: true,
        message: "تم عكس المعاملة وتحديث الرصيد والسجل بنجاح.",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      return res
        .status(
          msg === "DUPLICATE_OPERATION"
            ? 409
            : msg === "TRANSACTION_NOT_FOUND"
              ? 404
              : msg === "ALREADY_REVERSED"
                ? 409
                : [
                      "NEGATIVE_BALANCE_FORBIDDEN",
                      "REVERSE_ORIGINAL_GIFT_ONLY",
                      "INVALID_GIFT_TARGET",
                    ].includes(msg)
                  ? 400
                  : 503,
        )
        .json({
          success: false,
          error:
            msg === "DUPLICATE_OPERATION"
              ? "تمت العملية مسبقاً"
              : msg === "ALREADY_REVERSED"
                ? "المعاملة تم عكسها مسبقاً"
                : msg === "NEGATIVE_BALANCE_FORBIDDEN"
                  ? "عكس المعاملة سيتسبب في رصيد سالب للعضو"
                  : "تعذر عكس المعاملة",
        });
    }
  },
);

// GET /api/rewards/admin/requests — استعراض جميع الطلبات (admin)
rewardsRouter.get(
  "/admin/requests",
  requireRbacAction("manage_rewards"),
  async (_req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير متاحة" });
    try {
      const snapshot = await db
        .collection("reward_support_requests")
        .orderBy("createdAt", "desc")
        .limit(150)
        .get();
      const requests = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          let memberName = "عضو";
          if (data.memberId) {
            const u = await db.collection("users").doc(data.memberId).get();
            memberName = publicMemberName(u.data());
          }
          return { id: doc.id, memberName, ...data };
        }),
      );
      return res.json({ success: true, requests });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تحميل الطلبات" });
    }
  },
);

// POST /api/rewards/admin/requests/:id/review — مراجعة طلب (موافقة أو رفض مع خيار منح نقاط)
rewardsRouter.post(
  "/admin/requests/:id/review",
  requireRbacAction("manage_rewards"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const reqId = cleanText(req.params.id, 80);
    const status = cleanText(req.body?.status, 30);
    const adminNotes = cleanText(req.body?.adminNotes, 600);
    const grantPoints = Math.max(
      0,
      Math.floor(Number(req.body?.grantPoints) || 0),
    );

    if (!db || !req.user || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, error: "حالة غير صالحة" });
    }

    try {
      const reqRef = db.collection("reward_support_requests").doc(reqId);
      const reqDoc = await reqRef.get();
      if (!reqDoc.exists)
        return res
          .status(404)
          .json({ success: false, error: "الطلب غير موجود" });
      const reqData = reqDoc.data() || {};
      const memberId = reqData.memberId;

      if (status === "approved" && grantPoints > 0 && memberId) {
        const balRef = db.collection("reward_balances").doc(memberId);
        await db.runTransaction(async (tx) => {
          const balSnap = await tx.get(balRef);
          const curPoints = Number(balSnap.data()?.points) || 0;
          tx.set(
            balRef,
            { points: curPoints + grantPoints, updatedAt: nowIso() },
            { merge: true },
          );
          tx.set(db.collection("reward_ledger").doc(), {
            uid: memberId,
            points: grantPoints,
            gems: 0,
            type: "grant",
            reason: `موافقة على طلب: ${reqData.text?.slice(0, 80) || "طلب دعم"}`,
            performedBy: req.user?.uid,
            createdAt: nowIso(),
          });
          tx.set(
            reqRef,
            {
              status,
              adminNotes,
              grantedPoints: grantPoints,
              reviewedBy: req.user?.uid,
              reviewedAt: nowIso(),
            },
            { merge: true },
          );
        });
      } else {
        await reqRef.set(
          {
            status,
            adminNotes,
            reviewedBy: req.user?.uid,
            reviewedAt: nowIso(),
          },
          { merge: true },
        );
      }

      await writeAuditLog(req, "reward.request_reviewed", "rewards", reqId, {
        status,
        grantPoints,
      });
      return res.json({ success: true });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر مراجعة الطلب" });
    }
  },
);

// POST /api/rewards/admin/certificates — إصدار شهادة جديدة (admin)
rewardsRouter.post(
  "/admin/certificates",
  requireRbacAction("issue_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const recipientUid = cleanText(req.body?.recipientUid, 128);
    const recipientName = cleanText(req.body?.recipientName, 120);
    const certType = cleanText(req.body?.certType, 120) || "شهادة تقدير";
    const reason = cleanText(req.body?.reason, 600);
    const grantingEntity =
      cleanText(req.body?.grantingEntity, 150) || "إدارة مبادرة إنصات";
    const responsibleName =
      cleanText(req.body?.responsibleName, 120) || "إدارة إنصات";
    const rawCode = cleanText(
      req.body?.code || req.body?.customCode,
      40,
    ).toUpperCase();
    let code = rawCode;
    if (code && !code.startsWith("INS-")) {
      code = `INS-${code.replace(/^INS-?/i, "")}`;
    }
    if (!code) {
      code = `INS-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const rawDate = cleanText(req.body?.issuedAt || req.body?.issueDate, 40);
    const issuedAt =
      rawDate && !isNaN(new Date(rawDate).getTime())
        ? new Date(rawDate).toISOString()
        : nowIso();

    if (!db || !req.user || !recipientName || !reason) {
      return res
        .status(400)
        .json({ success: false, error: "اسم المستلم وسبب المنح مطلوبان" });
    }

    try {
      const certRef = await db.collection("certificates").add({
        code,
        memberId: recipientUid || null,
        targetUid: recipientUid || null,
        recipientName,
        targetName: recipientName,
        certType,
        reason,
        achievement: reason,
        grantingEntity,
        responsibleName,
        status: "valid",
        issuedAt,
        publiclyVerifiable: true,
        createdBy: req.user.uid,
        createdAt: nowIso(),
      });

      await writeAuditLog(
        req,
        "reward.certificate_issued",
        "rewards",
        certRef.id,
        { code, recipientName },
      );
      return res.status(201).json({ success: true, id: certRef.id, code });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر إصدار الشهادة" });
    }
  },
);

// PUT /api/rewards/admin/certificates/:id/status — تعديل حالة شهادة (إلغاء أو إتلاف)
rewardsRouter.put(
  "/admin/certificates/:id/status",
  requireRbacAction("revoke_certificates"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const certId = cleanText(req.params.id, 80);
    const status = cleanText(req.body?.status, 40);
    if (!db || !certId || !["ISSUED", "REVOKED", "REPLACED"].includes(status)) {
      return res.status(400).json({ success: false, error: "حالة غير صالحة" });
    }
    try {
      await db.collection("certificates").doc(certId).set(
        {
          status,
          statusUpdatedAt: nowIso(),
          statusUpdatedBy: req.user?.uid,
        },
        { merge: true },
      );
      await writeAuditLog(
        req,
        "reward.certificate_status_changed",
        "rewards",
        certId,
        { status },
      );
      return res.json({ success: true });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تحديث حالة الشهادة" });
    }
  },
);

// POST /api/rewards/admin/activities — إضافة نشاط أو فعالية قادمة
rewardsRouter.post(
  "/admin/activities",
  requireRbacAction("manage_rewards"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const title = cleanText(req.body?.title, 150);
    const description = cleanText(req.body?.description, 1000);
    const datetime = cleanText(req.body?.datetime, 80) || nowIso();
    const points = Math.max(0, Math.floor(Number(req.body?.points) || 0));
    const link = cleanText(req.body?.link, 500);

    if (!db || !title)
      return res
        .status(400)
        .json({ success: false, error: "عنوان النشاط مطلوب" });

    try {
      const docRef = await db.collection("reward_activities").add({
        title,
        description,
        datetime,
        points,
        link,
        createdBy: req.user?.uid,
        createdAt: nowIso(),
      });
      await writeAuditLog(req, "reward.activity_created", "rewards", docRef.id);
      invalidateRewardsCommunityCache();
      return res.status(201).json({ success: true, id: docRef.id });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر إضافة النشاط" });
    }
  },
);

// DELETE /api/rewards/admin/activities/:id
rewardsRouter.delete(
  "/admin/activities/:id",
  requireRbacAction("manage_rewards"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const actId = cleanText(req.params.id, 80);
    if (!db || !actId)
      return res.status(400).json({ success: false, error: "معرف غير صالح" });
    try {
      await db.collection("reward_activities").doc(actId).delete();
      invalidateRewardsCommunityCache();
      await writeAuditLog(req, "reward.activity_deleted", "rewards", actId);
      return res.json({ success: true });
    } catch {
      return res.status(503).json({ success: false, error: "تعذر حذف النشاط" });
    }
  },
);

// POST /api/rewards/admin/sessions — إضافة جلسة مسجلة
rewardsRouter.post(
  "/admin/sessions",
  requireRbacAction("manage_rewards"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const title = cleanText(req.body?.title, 150);
    const description = cleanText(req.body?.description, 1000);
    const youtubeUrl = safePublicUrl(req.body?.youtubeUrl);
    const speakers = Array.isArray(req.body?.speakers)
      ? req.body.speakers.map((s: any) => cleanText(s, 100))
      : [];

    if (!db || !title || !youtubeUrl)
      return res
        .status(400)
        .json({ success: false, error: "العنوان ورابط اليوتيوب مطلوبان" });

    try {
      const docRef = await db.collection("reward_sessions").add({
        title,
        description,
        youtubeUrl,
        speakers,
        reactions: {},
        createdBy: req.user?.uid,
        createdAt: nowIso(),
      });
      invalidateRewardsCommunityCache();
      await writeAuditLog(req, "reward.session_created", "rewards", docRef.id);
      return res.status(201).json({ success: true, id: docRef.id });
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر إضافة الجلسة" });
    }
  },
);

// DELETE /api/rewards/admin/sessions/:id
rewardsRouter.delete(
  "/admin/sessions/:id",
  requireRbacAction("manage_rewards"),
  async (req, res) => {
    const db = getFirebaseAdminFirestore();
    const sId = cleanText(req.params.id, 80);
    if (!db || !sId)
      return res.status(400).json({ success: false, error: "معرف غير صالح" });
    try {
      await db.collection("reward_sessions").doc(sId).delete();
      invalidateRewardsCommunityCache();
      await writeAuditLog(req, "reward.session_deleted", "rewards", sId);
      return res.json({ success: true });
    } catch {
      return res.status(503).json({ success: false, error: "تعذر حذف الجلسة" });
    }
  },
);

// GET /api/rewards/admin/export — تصدير نسخة احتياطية من جميع بيانات منصة النقاط
rewardsRouter.get(
  "/admin/export",
  requireRbacAction("export_rewards_reports"),
  async (_req, res) => {
    const db = getFirebaseAdminFirestore();
    if (!db)
      return res
        .status(503)
        .json({ success: false, error: "قاعدة البيانات غير متاحة" });
    try {
      const [balances, ledger, certificates, requests, activities, sessions] =
        await Promise.all([
          db.collection("reward_balances").get(),
          db
            .collection("reward_ledger")
            .orderBy("createdAt", "desc")
            .limit(500)
            .get(),
          db.collection("certificates").get(),
          db.collection("reward_support_requests").get(),
          db.collection("reward_activities").get(),
          db.collection("reward_sessions").get(),
        ]);

      const backup = {
        exportedAt: nowIso(),
        balances: balances.docs.map((d) => ({ uid: d.id, ...d.data() })),
        ledger: ledger.docs.map((d) => ({ id: d.id, ...d.data() })),
        certificates: certificates.docs.map((d) => ({ id: d.id, ...d.data() })),
        supportRequests: requests.docs.map((d) => ({ id: d.id, ...d.data() })),
        activities: activities.docs.map((d) => ({ id: d.id, ...d.data() })),
        sessions: sessions.docs.map((d) => ({ id: d.id, ...d.data() })),
      };

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="ansat-rewards-backup-${Date.now()}.json"`,
      );
      res.setHeader("Content-Type", "application/json");
      return res.send(JSON.stringify(backup, null, 2));
    } catch {
      return res
        .status(503)
        .json({ success: false, error: "تعذر تصدير البيانات" });
    }
  },
);
