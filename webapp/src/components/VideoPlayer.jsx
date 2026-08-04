import { useCallback, useEffect, useRef, useState } from 'react'
import YouTube from 'react-youtube'
import TouchShield from './TouchShield.jsx'
import ControlsBar from './ControlsBar.jsx'
import PausedOverlay from './PausedOverlay.jsx'

const OPTS = {
  host: 'https://www.youtube-nocookie.com',
  width: '100%',
  height: '100%',
  playerVars: {
    rel: 0,
    playsinline: 1,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    autoplay: 1,
    modestbranding: 1,
  },
}

const { PLAYING, ENDED } = { PLAYING: 1, ENDED: 0 }
const RESUME_MIN = 10 // don't bother resuming the first seconds
const RESUME_TAIL = 20 // ...or into the credits

export default function VideoPlayer({ video, watchStore, onExit }) {
  const playerRef = useRef(null)
  const [playerState, setPlayerState] = useState(-1)
  const [progress, setProgress] = useState({ pos: 0, dur: video.duration ?? 0 })
  const [showControls, setShowControls] = useState(true)
  const hideTimer = useRef(null)

  const playing = playerState === PLAYING

  const save = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    const pos = Math.floor(p.getCurrentTime() ?? 0)
    const dur = Math.floor(p.getDuration() ?? 0)
    if (pos > 0 && dur > 0) watchStore.saveProgress(video.id, pos, dur)
  }, [video.id, watchStore])

  // poll position every second; persist every 5th tick and on pause/hide/unmount
  useEffect(() => {
    let tick = 0
    const interval = setInterval(() => {
      const p = playerRef.current
      if (!p) return
      setProgress({ pos: p.getCurrentTime() ?? 0, dur: p.getDuration() ?? 0 })
      if (playing && ++tick % 5 === 0) save()
    }, 1000)
    const onHide = () => save()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onHide)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onHide)
      save()
    }
  }, [playing, save])

  const pokeControls = useCallback(() => {
    setShowControls(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setShowControls(false), 3000)
  }, [])

  const onReady = e => {
    playerRef.current = e.target
    const entry = watchStore.watched[video.id]
    if (entry && !entry.completed && entry.pos > RESUME_MIN && entry.pos < entry.dur - RESUME_TAIL) {
      e.target.seekTo(entry.pos, true)
    }
    e.target.playVideo()
    pokeControls()
  }

  const onStateChange = e => {
    setPlayerState(e.data)
    if (e.data === ENDED) {
      watchStore.markCompleted(video.id)
      onExit()
    } else if (e.data !== PLAYING) {
      save()
    }
  }

  const seekBy = delta => {
    const p = playerRef.current
    if (!p) return
    p.seekTo(Math.max(0, (p.getCurrentTime() ?? 0) + delta), true)
    pokeControls()
  }

  const togglePlay = () => {
    const p = playerRef.current
    if (!p) return
    playing ? p.pauseVideo() : p.playVideo()
    pokeControls()
  }

  return (
    <div className="video-player position-relative w-100 h-100 bg-black">
      <YouTube
        videoId={video.id}
        opts={OPTS}
        className="yt-frame"
        iframeClassName="yt-iframe"
        onReady={onReady}
        onStateChange={onStateChange}
        onError={onExit}
      />
      <TouchShield onTap={() => (showControls ? setShowControls(false) : pokeControls())} />
      {!playing && (
        <PausedOverlay video={video} onPlay={togglePlay} onExit={onExit} />
      )}
      {(showControls || !playing) && (
        <ControlsBar
          playing={playing}
          progress={progress}
          onTogglePlay={togglePlay}
          onSeek={seekBy}
          onExit={onExit}
        />
      )}
    </div>
  )
}
