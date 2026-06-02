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
}

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
