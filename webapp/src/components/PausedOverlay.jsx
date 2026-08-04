/**
 * Opaque overlay shown whenever the video isn't playing, so YouTube's paused
 * "More videos" tray and end screen can never be seen or tapped.
 */
export default function PausedOverlay({ video, onPlay, onExit }) {
  return (
    <div className="paused-overlay" style={{ backgroundImage: `url(${video.thumbnail})` }}>
      <div className="paused-overlay-scrim d-flex flex-column align-items-center justify-content-center gap-3 p-4">
        <button type="button" className="btn btn-play-big" onClick={onPlay} aria-label="Play">
          <i className="fa-solid fa-play" />
        </button>
        <div className="fs-5 text-center text-truncate w-100">{video.title}</div>
        <button type="button" className="btn btn-outline-light btn-lg" onClick={onExit}>
          <i className="fa-solid fa-grid-2 me-2" />
          More videos
        </button>
      </div>
    </div>
  )
}
