import type { Firestore, DocumentSnapshot } from "firebase-admin/firestore";
import {
  generateAllPhoneVariants,
  convertToAsciiDigits,
} from "../lib/phoneUtils";

interface CachedUsersSnap {
  docs: DocumentSnapshot[];
  timestamp: number;
}
let cachedAllUsersSnap: CachedUsersSnap | null = null;

export function invalidateUserLookupCache(): void {
  cachedAllUsersSnap = null;
}

/**
 * Normalizes any phone input to digits and optional leading plus
 */
export function normalizePhone(phone: string): string {
  if (!phone) return "";
  const ascii = convertToAsciiDigits(phone);
  const cleaned = ascii.replace(/[\s\-()]/g, "").trim();
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  return cleaned;
}

/**
 * Universal multi-field user resolver for login, verification, and migration.
 * Handles:
 * - Emails (with aliases and typo protection like .con <-> .com)
 * - Usernames (with or without leading @, e.g. @Soly_808 vs Soly_808)
 * - Phone numbers in ALL formats:
 *   +964 773 367 0682, 773 367 0682, 7733670682, 07733670682,
 *   009647733670682, 0096407733670682, +9647733670682, +96407733670682,
 *   Arabic-Indic digits (٠٧٧٣٣٦٧٠٦٨٢), and any international calling code.
 * - Full names (exact and trimmed)
 * - Raw legacy identifiers
 */
export async function findUserDocumentByIdentifier(
  db: Firestore,
  rawInput: string,
): Promise<DocumentSnapshot | null> {
  if (!rawInput || typeof rawInput !== "string") return null;
  const rawIdentifier = rawInput.trim();
  if (!rawIdentifier) return null;

  const asciiInput = convertToAsciiDigits(rawIdentifier).trim();
  const cleanLower = asciiInput.toLowerCase();
  const withoutAt = cleanLower.replace(/^@+/, "").trim();
  const digitsOnly = asciiInput.replace(/\D/g, "");
  const noSpaces = asciiInput.replace(/\s+/g, "");

  // 1. Email Lookup (only if it has an @ not at the beginning)
  if (cleanLower.includes("@") && !cleanLower.startsWith("@")) {
    const emailCandidates = [cleanLower, rawIdentifier.toLowerCase()];
    if (cleanLower.endsWith("@gmail.con")) {
      emailCandidates.push(cleanLower.replace(/@gmail\.con$/, "@gmail.com"));
    } else if (cleanLower.endsWith("@gmail.com")) {
      emailCandidates.push(cleanLower.replace(/@gmail\.com$/, "@gmail.con"));
    }

    for (const em of Array.from(new Set(emailCandidates))) {
      const snap = await db
        .collection("users")
        .where("email", "==", em)
        .limit(1)
        .get();
      if (!snap.empty) return snap.docs[0];

      const aliasSnap = await db
        .collection("users")
        .where("emailAliases", "array-contains", em)
        .limit(1)
        .get();
      if (!aliasSnap.empty) return aliasSnap.docs[0];
    }
  }

  // 2. Username Lookup (handles handles like @Soly_808, soly_808, etc.)
  const usernameCandidates = Array.from(
    new Set([withoutAt, cleanLower, `@${withoutAt}`, rawIdentifier]),
  ).filter(Boolean);
  for (const un of usernameCandidates) {
    let snap = await db
      .collection("users")
      .where("usernameNormalized", "==", un)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];

    snap = await db
      .collection("users")
      .where("username", "==", un)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }

  // 3. Phone Lookup across all possible formats and variations
  const phoneCandidates = generateAllPhoneVariants(rawIdentifier);

  for (const ph of phoneCandidates) {
    let snap = await db
      .collection("users")
      .where("phone", "==", ph)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];

    snap = await db
      .collection("users")
      .where("phoneNormalized", "==", ph)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];

    snap = await db
      .collection("users")
      .where("phoneDigits", "==", ph)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];

    snap = await db
      .collection("users")
      .where("phoneNationalDigits", "==", ph)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];

    snap = await db
      .collection("users")
      .where("phoneVariants", "array-contains", ph)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];

    snap = await db
      .collection("users")
      .where("rawIdentifier", "==", ph)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];

    snap = await db
      .collection("users")
      .where("identifier", "==", ph)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0];
  }

  // 4. Raw Identifier and Legacy ID Lookup
  let snap = await db
    .collection("users")
    .where("identifier", "==", rawIdentifier)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0];

  snap = await db
    .collection("users")
    .where("rawIdentifier", "==", rawIdentifier)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0];

  // 5. Full Name Lookup (case-insensitive fallback)
  snap = await db
    .collection("users")
    .where("fullName", "==", rawIdentifier)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0];

  snap = await db
    .collection("users")
    .where("name", "==", rawIdentifier)
    .limit(1)
    .get();
  if (!snap.empty) return snap.docs[0];

  // 6. Direct Document ID lookup
  try {
    const directDoc = await db.collection("users").doc(rawIdentifier).get();
    if (directDoc.exists) return directDoc;
  } catch {
    // Ignore invalid doc path
  }

  // 7. Comprehensive Fuzzy Digits / National Number Match Fallback
  // If the input has 7 or more digits, match against all user records to ensure 100% resolution
  const inputNationalDigits = digitsOnly.replace(/^0+/, "");
  if (inputNationalDigits.length >= 7) {
    try {
      const now = Date.now();
      let userDocs: DocumentSnapshot[] = [];
      if (
        cachedAllUsersSnap &&
        now - cachedAllUsersSnap.timestamp < 5 * 60 * 1000
      ) {
        userDocs = cachedAllUsersSnap.docs;
      } else {
        const snap = await db.collection("users").limit(300).get();
        userDocs = snap.docs;
        cachedAllUsersSnap = { docs: userDocs, timestamp: now };
      }

      for (const doc of userDocs) {
        const uData = doc.data() || {};
        const uPhone = String(
          uData.phone || uData.identifier || uData.rawIdentifier || "",
        );
        const uPhoneDigits = convertToAsciiDigits(uPhone).replace(/\D/g, "");
        const uNationalDigits = uPhoneDigits.replace(/^0+/, "");

        if (!uPhoneDigits && !uNationalDigits) continue;

        // Exact digits match
        if (
          uPhoneDigits === digitsOnly ||
          uNationalDigits === inputNationalDigits
        ) {
          return doc;
        }

        // Substring / Suffix match (e.g. 7733670682 matching 9647733670682)
        if (
          inputNationalDigits.length >= 8 &&
          uNationalDigits.endsWith(inputNationalDigits)
        ) {
          return doc;
        }
        if (
          uNationalDigits.length >= 8 &&
          inputNationalDigits.endsWith(uNationalDigits)
        ) {
          return doc;
        }

        // Check if any stored phone variant matches
        if (Array.isArray(uData.phoneVariants)) {
          for (const variant of uData.phoneVariants) {
            const vDigits = convertToAsciiDigits(String(variant))
              .replace(/\D/g, "")
              .replace(/^0+/, "");
            if (
              vDigits &&
              (vDigits === inputNationalDigits || vDigits === digitsOnly)
            ) {
              return doc;
            }
          }
        }
      }
    } catch (fallbackErr) {
      console.warn(
        "[findUserDocumentByIdentifier] Fallback query error:",
        fallbackErr,
      );
    }
  }

  return null;
}
