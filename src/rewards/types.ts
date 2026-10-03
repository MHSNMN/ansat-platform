import type { CanonicalRole } from "../lib/rbacPolicy";

export type RewardsNavTab =
  | "home"
  | "posts"
  | "hof"
  | "support"
  | "store"
  | "cert"
  | "sessions"
  | "admin";

export interface RewardMember {
  uid: string;
  name: string;
  role?: CanonicalRole | string;
  avatarUrl?: string;
  points?: number;
  receivedGems?: number;
  leaderboardPoints?: number;
  badgesCount?: number;
  joinedAt?: string;
}

export interface HonorBadgeDef {
  key: string;
  title: string;
  icon: string;
  description: string;
  color: string;
}

export interface UserHonorBadge {
  id: string;
  badgeKey: string;
  badgeTitle: string;
  awardedAt: string;
  reason?: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  datetime: string;
  points: number;
  link?: string;
}

export interface SessionItem {
  id: string;
  title: string;
  description: string;
  youtubeUrl: string;
  speakers: string[];
  reactions?: Record<string, number>;
  createdAt?: string;
}

export interface PostItem {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  createdAt: string;
  likes?: number;
  likedByMe?: boolean;
  commentsCount?: number;
}

export interface CommentItem {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export interface SupportRequestItem {
  id: string;
  memberId?: string;
  memberName?: string;
  type: "complaint" | "points" | "certificate";
  text: string;
  pointsRequested?: number;
  status: "pending" | "approved" | "rejected";
  adminNotes?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface CertificateRecord {
  id: string;
  code: string;
  recipientName: string;
  certType: string;
  reason: string;
  grantingEntity?: string;
  responsibleName?: string;
  issuedAt: string;
  status: "valid" | "revoked" | "damaged";
  imageUrl?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "gift" | "points" | "badge" | "request";
  createdAt: string;
  read: boolean;
}
