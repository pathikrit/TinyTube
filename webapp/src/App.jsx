import { useState } from 'react'
import useVideos from './hooks/useVideos.js'
import useWatchStore from './hooks/useWatchStore.js'
import Gallery from './components/Gallery.jsx'
import PlayerView from './components/PlayerView.jsx'

function ageFromUrl() {
  const age = Number.parseInt(new URLSearchParams(location.search).get('age'), 10)
  return Number.isNaN(age) ? null : age
}

export default function App() {
  const [age] = useState(ageFromUrl)
  const { channels, error } = useVideos(age)
  const watchStore = useWatchStore()
  const [current, setCurrent] = useState(null) // video being played, or null = gallery

  if (error) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center text-center p-4">
        <div>
          <i className="fa-solid fa-cloud-exclamation fa-3x mb-3" />
          <p className="fs-4">Could not load videos. Try again later!</p>
        </div>
      </div>
    )
  }

  if (!channels) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <div className="spinner-border text-danger" role="status" />
      </div>
    )
  }

  if (current) {
    return (
      <PlayerView
        video={current}
        watchStore={watchStore}
        onExit={() => setCurrent(null)}
      />
    )
  }

  return <Gallery channels={channels} watchStore={watchStore} onPlay={setCurrent} />
}
