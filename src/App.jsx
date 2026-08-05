import { useEffect, useState } from 'react'
import useVideos from './hooks/useVideos.js'
import useWatchStore from './hooks/useWatchStore.js'
import useSettings from './hooks/useSettings.js'
import { verify, isBiometricAvailable } from './lib/webauthn.js'
import Gallery from './components/Gallery.jsx'
import PlayerView from './components/PlayerView.jsx'
import MathGate from './components/MathGate.jsx'
import Settings from './components/Settings.jsx'
import EnrollGate from './components/EnrollGate.jsx'

export default function App() {
  const store = useSettings()
  const { db, channels, error } = useVideos(store.settings)
  const watchStore = useWatchStore()
  const [current, setCurrent] = useState(null) // video being played, or null
  const [view, setView] = useState('gallery') // 'gallery' | 'gate' | 'settings'
  const [biometric, setBiometric] = useState(null) // null = still checking

  useEffect(() => {
    isBiometricAvailable().then(setBiometric)
  }, [])

  // player/gate/settings are history entries so the browser back button
  // (and iOS edge-swipe) lands back on the gallery instead of leaving the app
  useEffect(() => {
    const onPop = () => {
      setCurrent(null)
      setView('gallery')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = fn => arg => {
    history.pushState({ tinytube: true }, '')
    fn(arg)
  }
  const close = () => history.back() // popstate does the state reset

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

  if (!channels || biometric === null) {
    return (
      <div className="d-flex vh-100 align-items-center justify-content-center">
        <div className="spinner-border text-danger" role="status" />
      </div>
    )
  }

  // first run on a biometric-capable device: enroll before anything else
  if (biometric && !store.settings.passkeyId) {
    return <EnrollGate onEnrolled={store.setPasskey} />
  }

  if (current) {
    return <PlayerView video={current} watchStore={watchStore} onExit={close} />
  }

  if (view === 'gate') {
    return (
      <MathGate
        onPass={() => setView('settings')} // same history depth: back from settings -> gallery
        onFail={close}
      />
    )
  }

  if (view === 'settings') {
    return <Settings db={db} store={store} onDone={close} />
  }

  // enrolled device -> OS biometric prompt (called inside the tap handler to
  // keep iOS user activation); otherwise the math gate bootstraps enrollment
  const onParents = async () => {
    if (store.settings.passkeyId) {
      if (await verify(store.settings.passkeyId)) open(() => setView('settings'))()
    } else {
      open(() => setView('gate'))()
    }
  }

  return (
    <Gallery
      channels={channels}
      watchStore={watchStore}
      onPlay={open(setCurrent)}
      onParents={onParents}
    />
  )
}
