import { useEffect, useMemo, useState } from 'react'
import { gallerySort } from '../hooks/useWatchStore.js'
import VideoCard from './VideoCard.jsx'

export default function Gallery({ channels, watchStore, parentLockUntil, onPlay, onParents }) {
  const videos = useMemo(
    () => gallerySort(channels, watchStore.watched),
    [channels, watchStore.watched],
  )

  // after a failed math gate the button is invisible until the lock expires
  const [locked, setLocked] = useState(() => Date.now() < parentLockUntil)
  useEffect(() => {
    const remaining = parentLockUntil - Date.now()
    setLocked(remaining > 0)
    if (remaining > 0) {
      const timer = setTimeout(() => setLocked(false), remaining)
      return () => clearTimeout(timer)
    }
  }, [parentLockUntil])

  return (
    <div className="gallery">
      <nav className="gallery-toolbar d-flex align-items-center px-3 py-2">
        <span className="fs-4 fw-bold me-auto">
          <i className="fa-sharp-duotone fa-regular fa-tv-retro me-2 text-danger" />
          TinyTube
        </span>
        {!locked && (
          <button
            type="button"
            className="btn btn-outline-secondary btn-lg"
            aria-label="Parents"
            onClick={onParents}
          >
            <i className="fa-sharp-duotone fa-regular fa-family" />
          </button>
        )}
      </nav>
      <div className="container-fluid py-3">
        <div className="row g-3">
          {videos.map(video => (
            <div key={video.id} className="col-6 col-md-4 col-lg-3">
              <VideoCard
                video={video}
                entry={watchStore.watched[video.id]}
                onPlay={() => onPlay(video)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
