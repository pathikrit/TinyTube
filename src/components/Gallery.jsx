import { useMemo } from 'react'
import { gallerySort } from '../hooks/useWatchStore.js'
import VideoCard from './VideoCard.jsx'

export default function Gallery({ channels, watchStore, onPlay, onParents }) {
  const videos = useMemo(
    () => gallerySort(channels, watchStore.watched),
    [channels, watchStore.watched],
  )

  return (
    <div className="gallery">
      <nav className="gallery-toolbar d-flex align-items-center px-3 py-2">
        <span className="fs-4 fw-bold me-auto">
          {/* not fa-jelly-duo: the kit token only serves classic/duotone/sharp
              fonts, so jelly-duo renders its two layers as two glyphs */}
          <i className="fa-duotone fa-regular fa-tv-retro me-2 text-danger" />
          TinyTube
        </span>
        <button
          type="button"
          className="btn btn-lg"
          aria-label="Parents"
          onClick={onParents}
        >
          <i className="fa-sharp-duotone fa-solid fa-remote text-danger" />
        </button>
      </nav>
      <div className="container-fluid py-3">
        <div className="row g-3">
          {videos.map(video => (
            <div key={video.id} className="col-4 col-md-3 col-lg-2">
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
