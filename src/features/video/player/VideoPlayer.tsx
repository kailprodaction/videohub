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
} from 'lucide-react'
import type { Video, Quality } from '@/shared/types'
import { usePlayerStore } from '@/stores/playerStore'
import { formatDuration } from '@/shared/lib/format'
import { cn } from '@/shared/lib/cn'

interface VideoPlayerProps {
  video: Video
  onFirstPlay?: () => void
}

export function VideoPlayer({ video, onFirstPlay }: VideoPlayerProps) {
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
  const currentSrc =
    video.sources.find((s) => s.quality === quality)?.url ?? video.sources[0]?.url

  // Fullscreen API
  useEffect(() => {
    function onChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await wrapRef.current?.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
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
    const current = playerRef.current?.getCurrentTime() ?? 0
    setQuality(q)
    setShowSettings(false)
    requestAnimationFrame(() => {
      if (playerRef.current) playerRef.current.seekTo(current, 'seconds')
    })
  }

  function getFractionFromEvent(e: MouseEvent | React.MouseEvent) {
    const el = progressBarRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  }

  function handleProgressMouseDown(e: React.MouseEvent) {
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
    // Любое нажатие Play — это user gesture: гарантированно снимаем mute и
    // поднимаем громкость, если она оказалась нулевой. Браузер разрешит звук.
    if (muted) setMuted(false)
    if (volume === 0) setVolume(0.5)
    if (!firstPlayed) {
      setFirstPlayed(true)
      onFirstPlay?.()
    }
  }

  // Клик по иконке звука: переключает mute. Если громкость была 0 — поднимает её до 0.5.
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
        // В полноэкранном режиме не нужна 16:9 — занимаем весь экран.
        isFullscreen ? 'h-screen' : 'aspect-video',
      )}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && !showSettings && setShowControls(false)}
    >
      <ReactPlayer
        ref={playerRef}
        url={currentSrc}
        playing={playing}
        // Управляем звуком ТОЛЬКО через volume — это надёжнее, чем комбинировать
        // muted + volume (некоторые сборки react-player при muted=true игнорируют
        // последующее снятие mute и звук остаётся выключенным).
        volume={muted ? 0 : volume}
        playbackRate={playbackRate}
        width="100%"
        height="100%"
        progressInterval={250}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onProgress={(p) => {
          if (!seeking) setPlayed(p.played)
        }}
        onDuration={(d) => setDuration(d)}
        config={{ file: { attributes: { controlsList: 'nodownload', playsInline: true } } }}
      />

      {/* Кнопка play поверх паузы */}
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

      {/* Контролы */}
      <div
        className={cn(
          'absolute bottom-0 inset-x-0 px-3 pb-2 pt-8 transition-opacity duration-200',
          'bg-gradient-to-t from-black/80 via-black/40 to-transparent',
          showControls || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
      >
        <div
          ref={progressBarRef}
          className="h-1 bg-white/30 rounded cursor-pointer group/progress hover:h-1.5 transition-all relative"
          onMouseDown={handleProgressMouseDown}
        >
          <div
            className="absolute inset-y-0 left-0 bg-brand rounded"
            style={{ width: `${played * 100}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-brand opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `calc(${played * 100}% - 6px)` }}
          />
        </div>

        <div className="flex items-center gap-3 mt-2 text-white">
          <button onClick={togglePlay} className="p-1 hover:scale-110 transition-transform" aria-label="Play/Pause">
            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </button>

          {/* Громкость — слайдер видимый, всегда. */}
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

          <div className="ml-auto flex items-center gap-1 relative">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="p-1 hover:scale-110 transition-transform"
              aria-label="Настройки"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-1 hover:scale-110 transition-transform"
              aria-label="Полный экран"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>

            {showSettings && (
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
