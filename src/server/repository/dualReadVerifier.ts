import { getFirebaseAdminFirestore } from "../firebaseAdmin";
import { getSupabaseAdminClient } from "../supabaseAdmin";

export interface ComparisonReport {
  timestamp: string;
  collections: {
    name: string;
    firestoreCount: number;
    supabaseCount: number;
    match: boolean;
    differencesNotes?: string;
  }[];
}

export async function runDualReadVerification(): Promise<ComparisonReport> {
  const firestore = getFirebaseAdminFirestore();
  const supabase = getSupabaseAdminClient();

  const report: ComparisonReport = {
    timestamp: new Date().toISOString(),
    collections: [],
  };

  const entitiesToCompare = [
    { firestoreName: "users", supabaseTable: "profiles" },
    { firestoreName: "books", supabaseTable: "books" },
    { firestoreName: "recordings", supabaseTable: "recordings" },
    { firestoreName: "tasks", supabaseTable: "tasks" },
    { firestoreName: "public_library", supabaseTable: "public_library" },
    { firestoreName: "public_activities", supabaseTable: "activities" },
  ];

  for (const item of entitiesToCompare) {
    let fsCount = 0;
    let sbCount = 0;

    if (firestore) {
      try {
        const snap = await firestore.collection(item.firestoreName).get();
        fsCount = snap.size;
      } catch (err: any) {
        console.warn(
          `[DualReadVerifier] Firestore count error for ${item.firestoreName}:`,
          err?.message,
        );
      }
    }

    if (supabase) {
      try {
        const { count, error } = await supabase
          .from(item.supabaseTable)
          .select("id", { count: "exact", head: true });
        if (!error && count !== null) {
          sbCount = count;
        }
      } catch (err: any) {
        console.warn(
          `[DualReadVerifier] Supabase count error for ${item.supabaseTable}:`,
          err?.message,
        );
      }
    }

    report.collections.push({
      name: `${item.firestoreName} -> ${item.supabaseTable}`,
      firestoreCount: fsCount,
      supabaseCount: sbCount,
      match: fsCount === sbCount,
      differencesNotes:
        fsCount !== sbCount
          ? `Delta: ${Math.abs(fsCount - sbCount)} records`
          : undefined,
    });
  }

  return report;
}
