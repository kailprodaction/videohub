import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Quality } from '@/shared/types'

interface PlayerState {
  volume: number
  muted: boolean
  playbackRate: number
  quality: Quality
  setVolume: (v: number) => void
  setMuted: (m: boolean) => void
  setPlaybackRate: (r: number) => void
  setQuality: (q: Quality) => void
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      volume: 0.8,
      muted: false,
      playbackRate: 1,
      quality: '720p',
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setMuted: (m) => set({ muted: m }),
      setPlaybackRate: (r) => set({ playbackRate: Math.max(0.25, Math.min(3, r)) }),
      setQuality: (q) => set({ quality: q }),
    }),
    {
      name: 'vh:player',
      // version 2: сбрасываем muted и поднимаем громкость, если она оказалась нулевой.
      // Это лечит сессии, где из-за предыдущего бага звук был выключен и не возвращался.
      version: 2,
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Partial<PlayerState>
        return {
          volume: typeof s.volume === 'number' && s.volume > 0 ? s.volume : 0.8,
          muted: false,
          playbackRate: typeof s.playbackRate === 'number' ? s.playbackRate : 1,
          quality: (s.quality as Quality) ?? '720p',
        } as PlayerState
      },
    },
  ),
)
