export type SectionType =
  | "hero"
  | "about"
  | "metrics"
  | "countries"
  | "library"
  | "activities"
  | "events"
  | "sessions"
  | "journey"
  | "team"
  | "partners"
  | "faq"
  | "testimonials"
  | "join"
  | "custom";

export type ContentStatus = "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";

export interface CmsSection {
  id: string;
  type: SectionType;
  title: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  order: number;
  visible: boolean;
  content?: Record<string, any>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CmsSiteContent {
  id: string;
  status: ContentStatus;
  version: number;
  headline: string;
  description: string;
  aboutTitle: string;
  aboutSubtitle: string;
  aboutBody: string;
  vision: string;
  mission: string;
  goals: string[];
  contactEmail: string;
  contactTitle?: string;
  contactDescription?: string;
  contactTelegram?: string;
  contactTwitter?: string;
  contactPhone?: string;
  socialLinks: {
    platform: string;
    url: string;
  }[];
  termsBody: string;
  privacyBody: string;
  countryMetricMode?: "AUTO" | "MANUAL";
  manualCountries?: { name: string; count: number; members: string[] }[];
  images?: {
    heroCover?: string;
    aboutStudio?: string;
    youthManifesto?: string;
    journeyStage1?: string;
    journeyStage2?: string;
    journeyStage3?: string;
    journeyStage4?: string;
    pillarAudio?: string;
    pillarEvents?: string;
    pillarCommunity?: string;
    pillarVolunteering?: string;
  };
  pillars?: {
    title: string;
    subtitle: string;
    items: {
      id: string;
      title: string;
      description: string;
      badge?: string;
      image?: string;
    }[];
  };
  youthManifesto?: {
    badge?: string;
    title: string;
    subtitle: string;
    summary: string;
    documentPoints?: string[];
    actionLabel?: string;
  };
  sections: CmsSection[];
  updatedAt: string;
  updatedBy: string;
}

export interface CmsVersionHistory {
  id: string;
  version: number;
  status: ContentStatus;
  summary: string;
  modifiedBy: string;
  timestamp: string;
  snapshot: Partial<CmsSiteContent>;
}
