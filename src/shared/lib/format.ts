export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const pad = (n: number) => n.toString().padStart(2, '0')
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`
  return `${m}:${pad(s)}`
}

export function formatNumber(n: number): string {
  if (n < 1000) return n.toString()
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '') + ' тыс.'
  if (n < 1_000_000_000) return (n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0).replace(/\.0$/, '') + ' млн'
  return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' млрд'
}

export function formatViews(views: number): string {
  return `${formatNumber(views)} просмотров`
}

export function formatSubscribers(n: number): string {
  return `${formatNumber(n)} подписчиков`
}

export function timeAgo(iso: string): string {
  const now = new Date('2026-05-26T12:00:00Z').getTime()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))
  if (diffSec < 60) return 'только что'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} мин. назад`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} ч. назад`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD} дн. назад`
  const diffW = Math.floor(diffD / 7)
  if (diffW < 5) return `${diffW} нед. назад`
  const diffMo = Math.floor(diffD / 30)
  if (diffMo < 12) return `${diffMo} мес. назад`
  const diffY = Math.floor(diffD / 365)
  return `${diffY} г. назад`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}
