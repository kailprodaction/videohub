import type { ChannelStats, PlatformStats } from '@/shared/types'

function generatePoints(days: number, base: { views: number; subscribers: number; likes: number; dislikes: number }) {
  const points = []
  const today = new Date('2026-05-26')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const noise = (n: number) => Math.round(n * (0.8 + Math.random() * 0.4))
    points.push({
      date: d.toISOString().slice(0, 10),
      views: noise(base.views),
      subscribers: noise(base.subscribers),
      likes: noise(base.likes),
      dislikes: noise(base.dislikes),
    })
  }
  return points
}

export const channelStats: ChannelStats[] = [
  {
    channelId: 'c1',
    points: generatePoints(14, { views: 4200, subscribers: 80, likes: 320, dislikes: 8 }),
    subscribedRecently: ['u3', 'u4', 'u5'],
    unsubscribedRecently: ['u6'],
  },
  {
    channelId: 'c2',
    points: generatePoints(14, { views: 18_400, subscribers: 240, likes: 1200, dislikes: 32 }),
    subscribedRecently: ['u1', 'u5'],
    unsubscribedRecently: [],
  },
  {
    channelId: 'c3',
    points: generatePoints(14, { views: 84_000, subscribers: 540, likes: 5100, dislikes: 80 }),
    subscribedRecently: ['u1', 'u2', 'u4'],
    unsubscribedRecently: ['u6'],
  },
  {
    channelId: 'c4',
    points: generatePoints(14, { views: 38_000, subscribers: 320, likes: 2400, dislikes: 60 }),
    subscribedRecently: ['u2'],
    unsubscribedRecently: [],
  },
  {
    channelId: 'c5',
    points: generatePoints(14, { views: 7400, subscribers: 110, likes: 540, dislikes: 14 }),
    subscribedRecently: ['u1', 'u3'],
    unsubscribedRecently: ['u2'],
  },
  {
    channelId: 'c6',
    points: generatePoints(14, { views: 3200, subscribers: 60, likes: 220, dislikes: 5 }),
    subscribedRecently: [],
    unsubscribedRecently: [],
  },
]

export const platformStats: PlatformStats = {
  totalUsers: 6,
  totalChannels: 6,
  totalVideos: 12,
  totalViews: 5_400_000,
  totalComments: 7,
  dailyActive: generatePoints(14, { views: 1200, subscribers: 0, likes: 0, dislikes: 0 }).map((p) => ({
    date: p.date,
    count: p.views,
  })),
}
