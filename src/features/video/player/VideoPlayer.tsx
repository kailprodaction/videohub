import { useEffect, useRef, useState } from 'react'
import ReactPlayer from 'react-player'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  Settings as SettingsIcon,
  SkipForward,
} from 'lucide-react'
import type { Video, Quality, Ad } from '@/shared/types'
import { usePlayerStore } from '@/stores/playerStore'
import { formatDuration } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'

interface VideoPlayerProps {
  video: Video
  preRollAd?: Ad | null
  onFirstPlay?: () => void
  onAdFinish?: () => void
}

const AD_MAX_SECONDS = 30
const AD_SKIPPABLE_AFTER = 5

export function VideoPlayer({ video, preRollAd, onFirstPlay, onAdFinish }: VideoPlayerProps) {
  const playerRef = useRef<ReactPlayer | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const progressBarRef = useRef<HTMLDivElement | null>(null)
  const hideControlsTimer = useRef<number | null>(null)

  const volume = usePlayerStore((s) => s.volume)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const muted = usePlayerStore((s) => s.muted)
  const setMuted = usePlayerStore((s) => s.setMuted)
  const playbackRate = usePlayerStore((s) => s.playbackRate)
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate)
  const quality = usePlayerStore((s) => s.quality)
  const setQuality = usePlayerStore((s) => s.setQuality)

  const [phase, setPhase] = useState<'ad' | 'main'>(preRollAd ? 'ad' : 'main')
  const [adSeconds, setAdSeconds] = useState(0)

  const [playing, setPlaying] = useState(false)
  const [played, setPlayed] = useState(0)
  const [seeking, setSeeking] = useState(false)
  const [duration, setDuration] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [firstPlayed, setFirstPlayed] = useState(false)

  const availableQualities = video.sources.map((s) => s.quality)
  const hasMultiQualities = availableQualities.length > 1
  const mainSrc = video.sources.find((s) => s.quality === quality)?.url ?? video.sources[0]?.url
  const currentSrc = phase === 'ad' ? preRollAd!.videoUrl : mainSrc

  const isAd = phase === 'ad'
  const canSkipAd = isAd && adSeconds >= AD_SKIPPABLE_AFTER
  const skipInLabel = Math.max(0, Math.ceil(AD_SKIPPABLE_AFTER - adSeconds))

  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await wrapRef.current?.requestFullscreen()
      else await document.exitFullscreen()
    } catch (e) {
      console.warn('fullscreen toggle failed', e)
    }
  }

  function resetHideTimer() {
    setShowControls(true)
    if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current)
    if (playing) {
      hideControlsTimer.current = window.setTimeout(() => {
        if (!showSettings) setShowControls(false)
      }, 2500)
    }
  }

  useEffect(() => {
    resetHideTimer()
    return () => {
      if (hideControlsTimer.current) window.clearTimeout(hideControlsTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, showSettings])

  function handleQualityChange(q: Quality) {
    if (isAd) return
    const current = playerRef.current?.getCurrentTime() ?? 0
    setQuality(q)
    setShowSettings(false)
    requestAnimationFrame(() => playerRef.current?.seekTo(current, 'seconds'))
  }

  function getFractionFromEvent(e: MouseEvent | React.MouseEvent) {
    const el = progressBarRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function handleProgressMouseDown(e: React.MouseEvent) {
    if (isAd) return
    setSeeking(true)
    const fraction = getFractionFromEvent(e)
    setPlayed(fraction)
    function onMove(ev: MouseEvent) {
      setPlayed(getFractionFromEvent(ev))
    }
    function onUp(ev: MouseEvent) {
      const f = getFractionFromEvent(ev)
      setSeeking(false)
      playerRef.current?.seekTo(f, 'fraction')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function togglePlay() {
    setPlaying((p) => !p)
    if (muted) setMuted(false)
    if (volume === 0) setVolume(0.5)
    if (!firstPlayed) {
      setFirstPlayed(true)
      if (!isAd) onFirstPlay?.()
    }
  }

  function finishAd() {
    setPhase('main')
    setAdSeconds(0)
    setPlayed(0)
    setDuration(0)
    setPlaying(true)
    onAdFinish?.()
    if (!firstPlayed) {
      setFirstPlayed(true)
      onFirstPlay?.()
    }
  }

  function toggleMute() {
    if (muted || volume === 0) {
      setMuted(false)
      if (volume === 0) setVolume(0.5)
    } else {
      setMuted(true)
    }
  }

  const currentTime = played * duration
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      ref={wrapRef}
      className={cn(
        'video-wrap relative w-full bg-black group select-none',
        isFullscreen ? 'h-screen' : 'aspect-video',
      )}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && !showSettings && setShowControls(false)}
    >
      <ReactPlayer
        key={isAd ? 'ad' : 'main'}
        ref={playerRef}
        url={currentSrc}
        playing={playing}
        volume={muted ? 0 : volume}
        playbackRate={isAd ? 1 : playbackRate}
        width="100%"
        height="100%"
        progressInterval={250}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onProgress={(p) => {
          if (!seeking) setPlayed(p.played)
          if (isAd) {
            const s = p.playedSeconds
            setAdSeconds(s)
            if (s >= AD_MAX_SECONDS) finishAd()
          }
        }}
        onDuration={(d) => setDuration(d)}
        onEnded={() => {
          if (isAd) finishAd()
        }}
        config={{ file: { attributes: { controlsList: 'nodownload', playsInline: true } } }}
      />

      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 grid place-items-center bg-black/30 transition-opacity"
          aria-label="Воспроизвести"
        >
          <div className="w-20 h-20 rounded-full bg-brand/90 grid place-items-center">
            <Play className="w-10 h-10 text-white fill-white" />
          </div>
        </button>
      )}

      {isAd && (
        <>
          <div className="absolute top-3 left-3 bg-brand/95 text-white text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-md max-w-[60%] truncate">
            Реклама · {preRollAd?.title ?? ''}
          </div>
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {canSkipAd ? (
              <button
                onClick={finishAd}
                className="inline-flex items-center gap-2 bg-black/85 hover:bg-black text-white text-sm px-4 py-2 rounded-md border border-white/20"
              >
                Пропустить рекламу
                <SkipForward className="w-4 h-4" />
              </button>
            ) : (
              <div className="bg-black/75 text-white/90 text-xs px-3 py-1.5 rounded-md">
                Пропустить можно через {skipInLabel}&nbsp;сек
              </div>
            )}
          </div>
        </>
      )}

      <div
        className={cn(
          'absolute bottom-0 inset-x-0 px-3 pb-2 pt-8 transition-opacity duration-200',
          'bg-gradient-to-t from-black/80 via-black/40 to-transparent',
          showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <div
          ref={progressBarRef}
          className={cn(
            'h-1 rounded relative transition-all',
            isAd
              ? 'bg-brand/30 cursor-not-allowed'
              : 'bg-white/30 cursor-pointer group/progress hover:h-1.5',
          )}
          onMouseDown={handleProgressMouseDown}
        >
          <div className="absolute inset-y-0 left-0 bg-brand rounded" style={{ width: `${played * 100}%` }} />
          {!isAd && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `calc(${played * 100}% - 6px)` }}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-2 text-white">
          <button onClick={togglePlay} className="p-1 hover:scale-110 transition-transform" aria-label="Play/Pause">
            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          <div className="flex items-center gap-2">
            <button onClick={toggleMute} className="p-1 hover:scale-110 transition-transform" aria-label="Громкость">
              <VolumeIcon className="w-5 h-5" />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setVolume(v)
                if (v === 0) setMuted(true)
                else if (muted) setMuted(false)
              }}
              className="w-24 accent-red-500"
              aria-label="Уровень громкости"
            />
          </div>

          <span className="text-xs font-mono tabular-nums">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>

          {isAd && (
            <span className="text-xs uppercase tracking-wide bg-white/15 px-2 py-0.5 rounded">
              Идёт реклама
            </span>
          )}

          <div className="ml-auto flex items-center gap-1 relative">
            {!isAd && (
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="p-1 hover:scale-110 transition-transform"
                aria-label="Настройки"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-1 hover:scale-110 transition-transform"
              aria-label="Полный экран"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>

            {showSettings && !isAd && (
              <SettingsPanel
                playbackRate={playbackRate}
                onPlaybackRate={setPlaybackRate}
                quality={quality}
                qualities={availableQualities}
                multiQuality={hasMultiQualities}
                onQualityChange={handleQualityChange}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SettingsPanel({
  playbackRate,
  onPlaybackRate,
  quality,
  qualities,
  multiQuality,
  onQualityChange,
  onClose,
}: {
  playbackRate: number
  onPlaybackRate: (r: number) => void
  quality: Quality
  qualities: Quality[]
  multiQuality: boolean
  onQualityChange: (q: Quality) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute bottom-12 right-0 w-72 bg-black/95 text-white rounded-lg p-4 shadow-xl border border-white/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium">Настройки</h4>
        <button onClick={onClose} className="text-white/60 hover:text-white text-sm">
          ✕
        </button>
      </div>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm">Скорость</span>
          <span className="text-sm font-mono tabular-nums">{playbackRate.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={playbackRate}
          onChange={(e) => onPlaybackRate(parseFloat(e.target.value))}
          className="w-full accent-red-500"
        />
        <div className="flex justify-between text-[10px] text-white/50 mt-1">
          <span>0.25x</span>
          <span>1x</span>
          <span>3x</span>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {[0.5, 1, 1.25, 1.5, 2].map((r) => (
            <button
              key={r}
              onClick={() => onPlaybackRate(r)}
              className={cn(
                'px-2 py-0.5 text-xs rounded',
                Math.abs(playbackRate - r) < 0.01 ? 'bg-brand' : 'bg-white/10 hover:bg-white/20',
              )}
            >
              {r}x
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-sm mb-2">Качество</div>
        {multiQuality ? (
          <div className="space-y-1">
            {qualities.map((q) => (
              <button
                key={q}
                onClick={() => onQualityChange(q)}
                className={cn(
                  'block w-full text-left px-3 py-1.5 rounded text-sm',
                  quality === q ? 'bg-brand' : 'hover:bg-white/10',
                )}
              >
                {q}
              </button>
            ))}
          </div>
        ) : (
          <div className="px-3 py-1.5 rounded text-sm bg-white/5 text-white/60 cursor-not-allowed">
            Авто · доступно одно качество
          </div>
        )}
      </div>
    </div>
  )
}
