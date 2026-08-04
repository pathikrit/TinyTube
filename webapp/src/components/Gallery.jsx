import { useMemo } from 'react'
import { gallerySort } from '../hooks/useWatchStore.js'
import VideoCard from './VideoCard.jsx'

export default function Gallery({ channels, watchStore, onPlay }) {
  const videos = useMemo(
    () => gallerySort(channels, watchStore.watched),
    [channels, watchStore.watched],
  )

  return (
    <div className="gallery">
      <nav className="gallery-toolbar d-flex align-items-center px-3 py-2">
        <span className="fs-4 fw-bold">
          <i className="fa-solid fa-tv-retro me-2 text-danger" />
          TinyTube
        </span>
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
