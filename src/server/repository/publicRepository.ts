import { getSupabaseAdminClient } from "../supabaseAdmin";

export interface PublicStats {
  volunteersCount: number;
  countriesCount: number;
  countriesList: string[];
  memberNames: string[];
  countriesWithMembers: Array<{
    name: string;
    count: number;
    members: string[];
  }>;
  publishedBooksCount: number;
  totalListeningHours: number;
  totalListeningSeconds: number;
  publishedRecordingsCount: number;
  lastCalculatedAt: string;
}

// In-memory server cache with 5 minutes TTL
let cachedStats: PublicStats | null = null;
let statsExpiresAt = 0;
const STATS_TTL_MS = 5 * 60 * 1000;

export class PublicRepository {
  /**
   * Calculate exact public platform statistics from Supabase:
   * - Volunteers: active non-archived profiles with full names
   * - Countries: distinct nationalities/countries of active volunteers
   * - Books: published books
   * - Listening hours: sum(duration_seconds) / 3600 of published recordings only
   */
  async getPublicStats(forceRefresh: boolean = false): Promise<PublicStats> {
    const now = Date.now();
    if (!forceRefresh && cachedStats && statsExpiresAt > now) {
      return cachedStats;
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) {
      if (cachedStats) return cachedStats;
      throw new Error("Public statistics database is not configured");
    }

    try {
      // 1. Fetch all active non-archived volunteer profiles
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, full_name, country, nationality, status, is_archived, show_nationality_public",
        )
        .eq("status", "ACTIVE")
        .eq("is_archived", false)
        .order("full_name", { ascending: true });
      if (profileError) throw profileError;

      const memberNames: string[] = [];
      const countryMap = new Map<
        string,
        { count: number; members: string[] }
      >();

      if (profileRows && profileRows.length > 0) {
        for (const p of profileRows) {
          const name = (p.full_name || "").trim();
          if (name && p.show_nationality_public === true) {
            memberNames.push(name);
          }
          const c = (p.country || p.nationality || "").trim();
          if (c) {
            if (!countryMap.has(c)) {
              countryMap.set(c, { count: 0, members: [] });
            }
            const group = countryMap.get(c)!;
            group.count++;
            if (name && p.show_nationality_public === true) {
              group.members.push(name);
            }
          }
        }
      }

      const countriesWithMembers = Array.from(countryMap.entries())
        .map(([name, group]) => ({
          name,
          count: group.count,
          members: group.members.slice(0, 15),
        }))
        .sort((a, b) => b.count - a.count);

      const uniqueCountries = countriesWithMembers.map((c) => c.name);
      const volunteersCount = profileRows ? profileRows.length : 0;

      // 2. Published books count
      const { count: publishedBooksCount, error: booksError } = await supabase
        .from("books")
        .select("id", { count: "exact", head: true })
        .eq("is_published_public", true)
        .eq("is_archived", false);
      if (booksError) throw booksError;

      // 3. Only published public audio counts toward listening time.
      const { data: durationRows, error: durationError } = await supabase
        .from("public_library")
        .select("id, duration_seconds")
        .eq("status", "PUBLISHED")
        .eq("is_archived", false);
      if (durationError) throw durationError;

      let totalSeconds = 0;
      let publishedRecordingsCount = 0;
      if (durationRows) {
        publishedRecordingsCount = durationRows.length;
        for (const r of durationRows) {
          totalSeconds += Number(r.duration_seconds || 0);
        }
      }

      const totalListeningHours = totalSeconds / 3600;

      cachedStats = {
        volunteersCount,
        countriesCount: uniqueCountries.length,
        countriesList: uniqueCountries,
        memberNames,
        countriesWithMembers,
        publishedBooksCount: publishedBooksCount || 0,
        totalListeningHours,
        totalListeningSeconds: totalSeconds,
        publishedRecordingsCount,
        lastCalculatedAt: new Date().toISOString(),
      };
      statsExpiresAt = now + STATS_TTL_MS;

      return cachedStats;
    } catch (err: any) {
      console.warn(
        "[PublicRepository] getPublicStats exception:",
        err?.message || err,
      );
      if (cachedStats) return cachedStats;
      throw err;
    }
  }

  /**
   * List public library audio works
   */
  async listPublicLibrary(limit = 50): Promise<any[]> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("public_library")
        .select("*")
        .eq("status", "PUBLISHED")
        .eq("is_archived", false)
        .order("sort_order", { ascending: true })
        .limit(limit);

      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  }

  /**
   * List public activities
   */
  async listPublicActivities(limit = 20): Promise<any[]> {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from("activities")
        .select(
          `
          *,
          activity_media (*)
        `,
        )
        .eq("status", "PUBLISHED")
        .eq("is_archived", false)
        .order("datetime", { ascending: false })
        .limit(limit);

      if (error || !data) return [];
      return data;
    } catch {
      return [];
    }
  }
}

export const publicRepository = new PublicRepository();
