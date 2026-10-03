import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const email = process.env.TARGET_EMAIL?.trim().toLowerCase();
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!email || !projectId || !clientEmail || !privateKey) {
  throw new Error("Set TARGET_EMAIL and Firebase Admin environment variables; no credentials are read from source files.");
}

const app = getApps()[0] || initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const auth = getAuth();
const db = getFirestore(app, process.env.FIREBASE_DATABASE_ID || '(default)');
const user = await auth.getUserByEmail(email);
const current = user.customClaims || {};
await auth.setCustomUserClaims(user.uid, { ...current, role: "SUPER_ADMIN", is_super_admin: true, account_status: "active" });
await db.collection('users').doc(user.uid).set({
  uid: user.uid,
  email,
  role: 'SUPER_ADMIN',
  canonicalRole: 'SUPER_ADMIN',
  is_super_admin: true,
  status: 'active',
  platformAccess: { recording: true, tasks: true, rewards: true, admin: true, public: true },
  updatedAt: new Date().toISOString(),
}, { merge: true });
await db.collection('audit_logs').add({
  action: 'SUPER_ADMIN_GRANTED',
  targetUid: user.uid,
  targetEmail: email,
  timestamp: new Date().toISOString(),
  source: 'local-admin-script',
});
console.log(`SUPER_ADMIN role persisted for ${email}. Sign out and sign in again to refresh the ID token.`);
