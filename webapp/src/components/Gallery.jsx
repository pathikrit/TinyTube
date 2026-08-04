import { useMemo, useState } from 'react'
import { gallerySort } from '../hooks/useWatchStore.js'
import VideoCard from './VideoCard.jsx'

export default function Gallery({ channels, watchStore, onPlay }) {
  const [hideWatched, setHideWatched] = useState(false)
  const videos = useMemo(
    () => gallerySort(channels, watchStore.watched, hideWatched),
    [channels, watchStore.watched, hideWatched],
  )

  return (
    <div className="gallery">
      <nav className="gallery-toolbar d-flex align-items-center px-3 py-2">
        <span className="fs-4 fw-bold me-auto">
          <i className="fa-solid fa-tv-retro me-2 text-danger" />
          TinyTube
        </span>
        <button
          type="button"
          className={`btn btn-lg ${hideWatched ? 'btn-danger' : 'btn-outline-secondary'}`}
          onClick={() => setHideWatched(v => !v)}
        >
          <i className={`fa-solid ${hideWatched ? 'fa-eye-slash' : 'fa-eye'} me-2`} />
          Hide watched
        </button>
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
        {videos.length === 0 && (
          <p className="text-center fs-4 mt-5">
            <i className="fa-solid fa-party-horn me-2" />
            All watched!
          </p>
        )}
      </div>
    </div>
  )
}
