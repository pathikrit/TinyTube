import { useEffect } from 'react'
import VideoPlayer from './VideoPlayer.jsx'

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
