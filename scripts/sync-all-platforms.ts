import "dotenv/config";
import { getFirebaseAdminFirestore, getFirebaseAdminAuth } from "../src/server/firebaseAdmin";
import { invalidateProfileCache } from "../src/server/supabaseAdmin";

const superAdminEmail = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const authorizedAdminEmails = new Set(
  String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function isAuthorizedAdmin(data: any): boolean {
  const email = String(data?.email || "").trim().toLowerCase();
  return Boolean(email && (email === superAdminEmail || authorizedAdminEmails.has(email)));
}

async function run() {
  if (!superAdminEmail) {
    console.error("SUPER_ADMIN_EMAIL is required before running this maintenance script.");
    process.exit(1);
  }
  console.log("Starting fast universal platform sync...");
  const db = getFirebaseAdminFirestore();
  const auth = getFirebaseAdminAuth();

  if (!db) {
    console.error("Firestore not initialized!");
    process.exit(1);
  }

  const usersSnap = await db.collection("users").get();
  console.log(`Found ${usersSnap.docs.length} users in Firestore.`);

  const nowIso = new Date().toISOString();
  let updatedCount = 0;

  // Process in chunks of 10
  const docs = usersSnap.docs;
  const chunkSize = 10;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (doc) => {
        const data = doc.data();
        const uid = doc.id;
        const email = String(data?.email || "").trim().toLowerCase();
        const adminAllowed = isAuthorizedAdmin(data);

        // Security check: only the environment-configured identity can be SUPER_ADMIN.
        let correctedRole = data.role;
        let correctedCanonicalRole = data.canonicalRole;
        if ((correctedRole === "SUPER_ADMIN" || correctedCanonicalRole === "super_admin") && email !== superAdminEmail) {
          console.warn(`[SECURITY AUDIT] Resetting unauthorized super_admin on user: ${email || uid}`);
          if (authorizedAdminEmails.has(email)) {
            correctedRole = "ADMIN";
            correctedCanonicalRole = "admin";
          } else {
            correctedRole = "NARRATOR";
            correctedCanonicalRole = "narrator";
          }
        } else if (superAdminEmail && email === superAdminEmail) {
          correctedRole = "SUPER_ADMIN";
          correctedCanonicalRole = "super_admin";
        }

        const platformAccess = {
          recording: true,
          tasks: true,
          rewards: true,
          admin: adminAllowed,
          public: true,
        };

        // 1. Update Firestore user document
        await doc.ref.set(
          {
            platformAccess,
            role: correctedRole,
            canonicalRole: correctedCanonicalRole,
            updatedAt: nowIso,
          },
          { merge: true }
        );

        // 2. Update Firebase Auth claims if available
        if (auth) {
          try {
            const userRec = await auth.getUser(uid);
            const existingClaims = userRec.customClaims || {};
            await auth.setCustomUserClaims(uid, {
              ...existingClaims,
              role: correctedRole,
              canonicalRole: correctedCanonicalRole,
              platform_access: platformAccess,
            });
          } catch (claimsErr) {
            console.warn(`[Sync] Warning setting claims for ${uid}:`, claimsErr);
          }
        }

        invalidateProfileCache(uid);
        updatedCount++;
        console.log(`[OK] ${data.name || uid}: recording=true, tasks=true, rewards=true, admin=${adminAllowed}`);
      })
    );
  }

  console.log(`Finished! Successfully updated all ${updatedCount} users in Firestore.`);
  process.exit(0);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
