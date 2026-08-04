import { useState } from 'react'
import useVideos from './hooks/useVideos.js'
import useWatchStore from './hooks/useWatchStore.js'
import useSettings from './hooks/useSettings.js'
import Gallery from './components/Gallery.jsx'
import PlayerView from './components/PlayerView.jsx'
import MathGate from './components/MathGate.jsx'
import ParentMode from './components/ParentMode.jsx'

export default function App() {
  const store = useSettings()
  const { db, channels, error } = useVideos(store.settings)
  const watchStore = useWatchStore()
  const [current, setCurrent] = useState(null) // video being played, or null
  const [view, setView] = useState('gallery') // 'gallery' | 'gate' | 'parent'

  if (error) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center text-center p-4">
        <div>
          <i className="fa-sharp-duotone fa-regular fa-cloud-exclamation fa-3x mb-3" />
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
    return <PlayerView video={current} watchStore={watchStore} onExit={() => setCurrent(null)} />
  }

  if (view === 'gate') {
    return (
      <MathGate
        onPass={() => setView('parent')}
        onFail={() => {
          store.lockParents()
          setView('gallery')
        }}
      />
    )
  }

  if (view === 'parent') {
    return <ParentMode db={db} store={store} onDone={() => setView('gallery')} />
  }

  return (
    <Gallery
      channels={channels}
      watchStore={watchStore}
      parentLockUntil={store.settings.parentLockUntil}
      onPlay={setCurrent}
      onParents={() => setView('gate')}
    />
  )
}
