/** App shell: view routing (gallery | player | gate | settings), the
 * parent gate dispatch, and the browser boot. */

import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles.css'
import { useSettings, useVideos, useWatchStore, verify, isBiometricAvailable } from './lib.js'
import Gallery from './gallery.jsx'
import PlayerView from './player.jsx'
import Settings from './settings.jsx'
import { EnrollGate, MathGate } from './landing.jsx'

export default function App() {
  const store = useSettings()
  const { db, channels, error } = useVideos(store.settings)
  const watchStore = useWatchStore()
  const [current, setCurrent] = useState(null) // video being played, or null
  const [view, setView] = useState('gallery') // 'gallery' | 'gate' | 'settings'
  const [biometric, setBiometric] = useState(null) // null = still checking
  const [fullscreenActive, setFullscreenActive] = useState(() => !!document.fullscreenElement)
  const videoFullscreen = useRef(null) // fullscreen promise owned by the player
  const fullscreenSupported = !!document.fullscreenEnabled
    && typeof document.documentElement.requestFullscreen === 'function'

  const enterFullscreen = useCallback(() => {
    if (document.fullscreenElement) return Promise.resolve(true)
    try {
      return Promise.resolve(document.documentElement.requestFullscreen?.())
        .then(() => !!document.fullscreenElement)
        .catch(() => false)
    } catch {
      return Promise.resolve(false)
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (!document.fullscreenElement) return Promise.resolve()
    try {
      return Promise.resolve(document.exitFullscreen?.()).catch(() => {})
    } catch {
      return Promise.resolve()
    }
  }, [])

  // A video that entered fullscreen owns that request and exits it on every
  // path back to the gallery. Fullscreen entered from the toolbar has no such
  // owner and therefore persists across all views.
  const leaveVideoFullscreen = useCallback(() => {
    const request = videoFullscreen.current
    if (!request) return
    videoFullscreen.current = null
    // Waiting on the request also covers a very quick Back tap before the
    // browser has finished entering fullscreen.
    request.then(entered => {
      if (entered) exitFullscreen()
    })
  }, [exitFullscreen])

  useEffect(() => {
    isBiometricAvailable().then(setBiometric)
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => setFullscreenActive(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // player/gate/settings are history entries so the browser back button
  // (and iOS edge-swipe) lands back on the gallery instead of leaving the app
  useEffect(() => {
    const onPop = () => {
      leaveVideoFullscreen()
      setCurrent(null)
      setView('gallery')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [leaveVideoFullscreen])

  const open = fn => arg => {
    history.pushState({ tinytube: true }, '')
    fn(arg)
  }
  const close = () => history.back() // popstate does the state reset
  const closePlayer = () => {
    leaveVideoFullscreen()
    close()
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) exitFullscreen()
    else enterFullscreen()
  }

  // requestFullscreen must run directly in the card's tap handler. Remember
  // whether this request succeeded so only video-owned fullscreen is closed
  // when the player returns to the gallery.
  const onPlay = video => {
    if (!document.fullscreenElement && fullscreenSupported) {
      videoFullscreen.current = enterFullscreen()
    }
    open(setCurrent)(video)
  }

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
    return (
      <PlayerView
        video={current}
        watchStore={watchStore}
        onExit={closePlayer}
      />
    )
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
  // keep iOS user activation); otherwise the math gate bootstraps enrollment.
  // Returns the view to show, or null (biometric cancelled/failed).
  const parentGate = async () => {
    if (store.settings.passkeyId) return (await verify(store.settings.passkeyId)) ? 'settings' : null
    return 'gate'
  }

  const onParents = async () => {
    const v = await parentGate()
    if (v) open(() => setView(v))()
  }

  return (
    <Gallery
      channels={channels}
      watchStore={watchStore}
      onPlay={onPlay}
      onParents={onParents}
      fullscreenSupported={fullscreenSupported}
      fullscreenActive={fullscreenActive}
      onToggleFullscreen={toggleFullscreen}
    />
  )
}

// browser boot; absent in jsdom where tests import <App/> directly
const rootEl = document.getElementById('root')
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
