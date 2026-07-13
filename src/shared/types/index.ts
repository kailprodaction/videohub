export type Quality = '1080p' | '720p' | '480p' | '360p'

export type Category =
  | 'music'
  | 'gaming'
  | 'education'
  | 'tech'
  | 'entertainment'
  | 'sports'
  | 'news'
  | 'other'

export type Visibility = 'public' | 'private'

export interface User {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string
  bio?: string
  role: 'user' | 'admin'
  createdAt: string
  blocked?: boolean
  premium?: boolean
  premiumUntil?: string | null
}

export interface VideoSource {
  quality: Quality
  url: string
}

export interface Channel {
  id: string
  ownerId: string
  name: string
  handle: string
  description: string
  avatarUrl: string
  bannerUrl: string
  subscribersCount: number
  createdAt: string
  balance?: number
  totalEarned?: number
}

export interface Ad {
  id: string
  title: string
  description: string
  videoUrl: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type TransactionType =
  | 'PREMIUM_PURCHASE'
  | 'CHANNEL_PAYOUT'
  | 'ADMIN_ADJUSTMENT'

export type TransactionStatus = 'SUCCESS' | 'FAILED' | 'PENDING'

export interface Transaction {
  id: string
  userId?: string | null
  channelId?: string | null
  type: TransactionType
  amount: number
  status: TransactionStatus
  description: string
  cardLast4?: string | null
  createdAt: string
}

export type ModerationStatus = 'approved' | 'pending' | 'blocked' | 'shadow'

export interface Video {
  id: string
  channelId: string
  title: string
  description: string
  thumbnailUrl: string
  sources: VideoSource[]
  durationSec: number
  views: number
  likes: number
  dislikes: number
  uploadedAt: string
  tags: string[]
  category: Category
  visibility: Visibility
  moderationStatus?: ModerationStatus
}

// -------- Trust & Safety: жалобы и модерация --------

export type ReportReason =
  | 'spam'
  | 'nudity'
  | 'violence'
  | 'copyright'
  | 'hate'
  | 'misinformation'
  | 'other'

export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'

export interface Report {
  id: string
  targetType: 'video' | 'comment' | 'channel'
  targetId: string
  reporterId?: string | null
  reason: ReportReason
  details: string
  status: ReportStatus
  priority: number
  resolution: string
  resolvedBy?: string | null
  resolvedAt?: string | null
  createdAt: string
  targetTitle?: string
}

export interface ModerationVerdict {
  nudity: number
  copyright: number
  spam: number
  violence: number
  overall: number
  decision: 'approved' | 'manual_review' | 'auto_block'
  labels: string[]
  sanction: 'none' | 'warning' | 'demonetize' | 'hide' | 'ban'
}

export interface ModerationRecord {
  id: string
  videoId: string
  videoTitle?: string
  nudityScore: number
  copyrightScore: number
  spamScore: number
  violenceScore: number
  overallScore: number
  decision: string
  labels: string[]
  sanction: string
  source: string
  status: ModerationStatus
  reviewedBy?: string | null
  reviewedAt?: string | null
  createdAt: string
}

export interface Comment {
  id: string
  videoId: string
  authorId: string
  text: string
  likes: number
  createdAt: string
}

export interface Subscription {
  id: string
  subscriberId: string
  channelId: string
  subscribedAt: string
}

export interface StatsPoint {
  date: string
  views: number
  subscribers: number
  likes: number
  dislikes: number
}

export interface ChannelStats {
  channelId: string
  points: StatsPoint[]
  subscribedRecently: string[]
  unsubscribedRecently: string[]
}

export interface PlatformStats {
  totalUsers: number
  totalChannels: number
  totalVideos: number
  totalViews: number
  totalComments: number
  dailyActive: { date: string; count: number }[]
}
