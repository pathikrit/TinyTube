/** Everything video: the fullscreen player view, the kid-proofed YouTube
 * embed, and its overlays/controls. */

import { useCallback, useEffect, useRef, useState } from 'react'
import YouTube from 'react-youtube'

export default function PlayerView({ video, watchStore, onExit }) {
  // best-effort landscape: fullscreen + orientation lock works on Android;
  // iOS has neither, so CSS rotates the whole view in portrait (see styles)
  useEffect(() => {
    ;(async () => {
      try {
        await document.documentElement.requestFullscreen?.()
        await screen.orientation?.lock?.('landscape')
      } catch {
        /* unsupported (iOS Safari) — the portrait CSS rotation covers it */
      }
    })()
    return () => {
      screen.orientation?.unlock?.()
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    }
  }, [])

  return (
    <div className="player-view d-flex flex-column">
      <nav className="player-topbar d-flex align-items-center gap-3 px-2">
        <button type="button" className="btn btn-ctl btn-ctl-sm" aria-label="Back" onClick={onExit}>
          <i className="fa-sharp-duotone fa-regular fa-arrow-left" />
        </button>
        <span className="fs-5 fw-bold">
          <i className="fa-duotone fa-regular fa-tv-retro me-2 text-danger" />
          TinyTube
        </span>
      </nav>
      <div className="player-stage position-relative flex-grow-1">
        <VideoPlayer video={video} watchStore={watchStore} onExit={onExit} />
      </div>
    </div>
  )
}

const OPTS = {
  // NOT youtube-nocookie.com: its privacy mode misfires as "error 150,
  // embedding disallowed" on mobile Safari for videos that embed fine
  width: '100%',
  height: '100%',
  playerVars: {
    rel: 0,
    playsinline: 1,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    autoplay: 1,
    modestbranding: 1,
    origin: window.location.origin, // reliable postMessage event delivery
  },
}

const { ENDED, PLAYING, BUFFERING } = { ENDED: 0, PLAYING: 1, BUFFERING: 3 }
const RESUME_MIN = 10 // don't bother resuming the first seconds
const RESUME_TAIL = 20 // ...or into the credits

export function VideoPlayer({ video, watchStore, onExit }) {
  const playerRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [playerState, setPlayerState] = useState(-1)
  const [progress, setProgress] = useState({ pos: 0, dur: video.duration ?? 0 })
  const [showControls, setShowControls] = useState(true)
  const hideTimer = useRef(null)

  const playing = playerState === PLAYING
  // don't flash the opaque overlay while buffering into playback
  const active = playing || playerState === BUFFERING

  const save = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    const pos = Math.floor(p.getCurrentTime() ?? 0)
    const dur = Math.floor(p.getDuration() ?? 0)
    if (pos > 0 && dur > 0) watchStore.saveProgress(video.id, pos, dur)
  }, [video.id, watchStore])

  // poll position every second; persist every 5th tick and on pause/hide/unmount
  useEffect(() => {
    let tick = 0
    const interval = setInterval(() => {
      const p = playerRef.current
      if (!p) return
      setProgress({ pos: p.getCurrentTime() ?? 0, dur: p.getDuration() ?? 0 })
      if (playing && ++tick % 5 === 0) save()
    }, 1000)
    const onHide = () => save()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      save()
    }
  }, [playing, save])

  const pokeControls = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  const onReady = e => {
    playerRef.current = e.target
    setReady(true)
    const entry = watchStore.watched[video.id]
    if (entry && !entry.completed && entry.pos > RESUME_MIN && entry.pos < entry.dur - RESUME_TAIL) {
      e.target.seekTo(entry.pos, true)
    }
    e.target.playVideo()
    pokeControls()
  }

  const onStateChange = e => {
    setPlayerState(e.data)
    if (e.data === ENDED) {
      watchStore.markCompleted(video.id)
      onExit()
    } else if (e.data !== PLAYING && e.data !== BUFFERING) {
      save()
    }
  }

  const onError = e => {
    console.error(`YouTube player error ${e.data} for video ${video.id}`)
    setError(e.data)
  }

  const seekBy = delta => {
    const p = playerRef.current
    if (!p) return
    p.seekTo(Math.max(0, (p.getCurrentTime() ?? 0) + delta), true)
    pokeControls()
  }

  const togglePlay = () => {
    const p = playerRef.current
    if (!p) return
    if (playing) {
      p.pauseVideo()
    } else {
      setPlayerState(BUFFERING) // dismiss the overlay immediately; ENDED/PAUSED events correct us if wrong
      p.playVideo()
    }
    pokeControls()
  }

  return (
    <div className="video-player position-relative w-100 h-100 bg-black">
      <YouTube
        videoId={video.id}
        opts={OPTS}
        className="yt-frame"
        iframeClassName="yt-iframe"
        onReady={onReady}
        onStateChange={onStateChange}
        onError={onError}
      />
      <TouchShield onTap={() => (showControls ? setShowControls(false) : pokeControls())} />
      {error !== null && <ErrorOverlay video={video} code={error} onExit={onExit} />}
      {error === null && !ready && <LoadingOverlay video={video} onExit={onExit} />}
      {error === null && ready && !active && (
        <PausedOverlay video={video} onPlay={togglePlay} onExit={onExit} />
      )}
      {(showControls || (ready && !active)) && (
        <ControlsBar playing={playing} progress={progress} onTogglePlay={togglePlay} onSeek={seekBy} />
      )}
    </div>
  )
}

/**
 * Transparent layer over the whole iframe: every touch lands here instead of
 * on YouTube's UI. A tap only toggles our own controls.
 */
function TouchShield({ onTap }) {
  return <div className="touch-shield" onPointerUp={onTap} />
}

function fmt(seconds) {
  const s = Math.floor(seconds ?? 0)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

function ControlsBar({ playing, progress, onTogglePlay, onSeek }) {
  const pct = progress.dur > 0 ? (progress.pos / progress.dur) * 100 : 0
  return (
    <div className="controls-bar d-flex flex-column gap-2 p-3">
      <div className="progress" style={{ height: 6 }}>
        <div className="progress-bar bg-danger" style={{ width: `${pct}%` }} />
      </div>
      <div className="d-flex align-items-center gap-3">
        <span className="text-white-50 small">{fmt(progress.pos)} / {fmt(progress.dur)}</span>
        <div className="ms-auto d-flex gap-3">
          <button type="button" className="btn btn-ctl" onClick={() => onSeek(-10)} aria-label="Back 10 seconds">
            <i className="fa-sharp-duotone fa-regular fa-rotate-left" />
          </button>
          <button type="button" className="btn btn-ctl" onClick={onTogglePlay} aria-label="Play or pause">
            <i className={`fa-sharp-duotone fa-regular ${playing ? 'fa-pause' : 'fa-play'}`} />
          </button>
          <button type="button" className="btn btn-ctl" onClick={() => onSeek(10)} aria-label="Forward 10 seconds">
            <i className="fa-sharp-duotone fa-regular fa-rotate-right" />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Opaque overlay shown whenever the video isn't playing, so YouTube's paused
 * "More videos" tray and end screen can never be seen or tapped.
 */
function PausedOverlay({ video, onPlay, onExit }) {
  return (
    <div className="paused-overlay" style={{ backgroundImage: `url(${video.thumbnail})` }}>
      <div className="paused-overlay-scrim d-flex flex-column align-items-center justify-content-center gap-3 p-4">
        <button type="button" className="btn btn-play-big" onClick={onPlay} aria-label="Play">
          <i className="fa-sharp-duotone fa-regular fa-play" />
        </button>
        <div className="fs-5 text-center text-truncate w-100">{video.title}</div>
        <button type="button" className="btn btn-outline-light btn-lg" onClick={onExit}>
          <i className="fa-sharp-duotone fa-regular fa-grid-2 me-2" />
          More videos
        </button>
      </div>
    </div>
  )
}

function LoadingOverlay({ video, onExit }) {
  return (
    <div className="paused-overlay" style={{ backgroundImage: `url(${video.thumbnail})` }}>
      <div className="paused-overlay-scrim d-flex flex-column align-items-center justify-content-center gap-3 p-4">
        <div className="spinner-border text-danger" role="status" />
        <div className="fs-5 text-center text-truncate w-100">{video.title}</div>
        <button type="button" className="btn btn-outline-light btn-lg" onClick={onExit}>
          <i className="fa-sharp-duotone fa-regular fa-grid-2 me-2" />
          More videos
        </button>
      </div>
    </div>
  )
}

// 101/150 = embedding disabled by the channel; 2/5/100 = bad/unplayable video
function ErrorOverlay({ video, code, onExit }) {
  return (
    <div className="paused-overlay" style={{ backgroundImage: `url(${video.thumbnail})` }}>
      <div className="paused-overlay-scrim d-flex flex-column align-items-center justify-content-center gap-3 p-4">
        <i className="fa-sharp-duotone fa-regular fa-face-frown fa-3x" />
        <div className="fs-5 text-center">This video can't play here (error {code})</div>
        <button type="button" className="btn btn-danger btn-lg" onClick={onExit}>
          <i className="fa-sharp-duotone fa-regular fa-grid-2 me-2" />
          Pick another video
        </button>
      </div>
    </div>
  )
}
