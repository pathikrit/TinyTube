function fmt(seconds) {
  const s = Math.floor(seconds ?? 0)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function ControlsBar({ playing, progress, onTogglePlay, onSeek, onExit }) {
  const pct = progress.dur > 0 ? (progress.pos / progress.dur) * 100 : 0
  return (
    <div className="controls-bar d-flex flex-column gap-2 p-3">
      <div className="progress" style={{ height: 6 }}>
        <div className="progress-bar bg-danger" style={{ width: `${pct}%` }} />
      </div>
      <div className="d-flex align-items-center gap-3">
        <button type="button" className="btn btn-ctl" onClick={onExit} aria-label="Back">
          <i className="fa-sharp-duotone fa-regular fa-arrow-left" />
        </button>
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
