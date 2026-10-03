export type ActivityType =
  | "WORKSHOP"
  | "CULTURAL_SESSION"
  | "BOOK_CLUB"
  | "WEBINAR"
  | "EXHIBITION"
  | "COMMUNITY_MEETUP";

export type ActivityStatus =
  "DRAFT" | "UPCOMING" | "ONGOING" | "COMPLETED" | "RECORDED" | "ARCHIVED";

export interface ActivityItem {
  id: string;
  title: string;
  summary?: string;
  date?: string;
  category?: string;
  image?: string;
  tags?: string[];
  body?: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  coverImage: string;
  galleryImages: {
    url: string;
    caption?: string;
    alt?: string;
    order?: number;
  }[];
  activityType: ActivityType;
  mode: "ONLINE" | "IN_PERSON" | "HYBRID";
  location?: string;
  meetingLink?: string;
  startDate: string;
  endDate?: string;
  organizers: string[];
  participantsCount?: number;
  relatedLinks: {
    title: string;
    url: string;
  }[];
  recordingUrl?: string;
  recordingDurationSeconds?: number;
  attachments: {
    title: string;
    url: string;
    type?: string;
  }[];
  status: ActivityStatus;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string;
  featured: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}
