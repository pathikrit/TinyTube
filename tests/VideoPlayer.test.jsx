import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import PlayerView, { VideoPlayer } from '../src/player.jsx'

// Stub the YouTube iframe: capture the lifecycle callbacks so tests can fire
// onReady / onStateChange / onError exactly like the real player would.
let yt
vi.mock('react-youtube', () => ({
  default: props => {
    yt = props
    return <div data-testid="yt-stub" />
  },
}))

const video = { id: 'abc123', title: 'Test Video', duration: 100, thumbnail: 'thumb.jpg' }
const { ENDED, PLAYING, PAUSED, BUFFERING } = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 }

function fakePlayer() {
  return {
    pos: 5,
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime() {
      return this.pos
    },
    getDuration: () => 100,
  }
}

let watchStore, onExit
beforeEach(() => {
  watchStore = {
    watched: {},
    saveProgress: vi.fn(),
    markCompleted: vi.fn(),
  }
  onExit = vi.fn()
})

afterEach(() => {
  delete document.fullscreenElement
  vi.unstubAllGlobals()
})

const renderPlayer = (Component = VideoPlayer) =>
  render(
    <Component
      video={video}
      watchStore={watchStore}
      onExit={onExit}
    />,
  )

describe('before the player is ready', () => {
  beforeEach(() => renderPlayer())

  // regression: play clicks used to be silently dropped while playerRef was null,
  // making the player look broken until YouTube's iframe API finished loading
  it('shows a loading spinner instead of a play button', () => {
    expect(screen.getByRole('status')).toBeTruthy()
    expect(screen.queryByLabelText('Play')).toBeNull()
  })

  it('ignores control clicks without crashing or exiting', () => {
    fireEvent.click(screen.getByLabelText('Play or pause'))
    expect(onExit).not.toHaveBeenCalled()
  })

})

it('can escape back to the gallery via the top bar while loading', () => {
  renderPlayer(PlayerView)
  fireEvent.click(screen.getByLabelText('Back'))
  expect(onExit).toHaveBeenCalled()
})

it('locks landscape when fullscreen settles and unlocks on cleanup', () => {
  let fullscreenElement = null
  const lock = vi.fn(() => Promise.resolve())
  const unlock = vi.fn()
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement })
  vi.stubGlobal('screen', { orientation: { lock, unlock } })

  const view = renderPlayer(PlayerView)
  expect(lock).not.toHaveBeenCalled()
  fullscreenElement = document.documentElement
  fireEvent(document, new Event('fullscreenchange'))
  expect(lock).toHaveBeenCalledWith('landscape')

  view.unmount()
  expect(unlock).toHaveBeenCalled()
})

describe('once the player is ready', () => {
  let player
  beforeEach(() => {
    renderPlayer()
    player = fakePlayer()
    act(() => yt.onReady({ target: player }))
  })

  it('auto-plays and drops the loading spinner', () => {
    expect(player.playVideo).toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps the opaque overlay off while playing and buffering', () => {
    for (const state of [PLAYING, BUFFERING]) {
      act(() => yt.onStateChange({ data: state }))
      expect(screen.queryByLabelText('Play')).toBeNull()
    }
  })

  it('covers the iframe with the paused overlay when paused', () => {
    act(() => yt.onStateChange({ data: PAUSED }))
    fireEvent.click(screen.getByLabelText('Play'))
    expect(player.playVideo).toHaveBeenCalledTimes(2) // onReady + our tap
    expect(screen.queryByLabelText('Play')).toBeNull() // dismissed optimistically
  })

  it('marks the video watched and returns to the gallery on ENDED', () => {
    act(() => yt.onStateChange({ data: ENDED }))
    expect(watchStore.markCompleted).toHaveBeenCalledWith(video.id)
    expect(onExit).toHaveBeenCalled()
  })
})

describe('on player error', () => {
  // regression: errors used to call onExit immediately, bouncing the child
  // back to the gallery with no explanation
  it('shows the error code instead of silently exiting', () => {
    renderPlayer()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => yt.onError({ data: 150 }))
    expect(onExit).not.toHaveBeenCalled()
    expect(screen.getByText(/error 150/)).toBeTruthy()
    fireEvent.click(screen.getByText(/Pick another video/))
    expect(onExit).toHaveBeenCalled()
  })
})

describe('progress persistence', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('saves every five playback seconds and on pause', () => {
    renderPlayer()
    const player = fakePlayer()
    act(() => yt.onReady({ target: player }))
    act(() => yt.onStateChange({ data: PLAYING }))
    act(() => {
      for (let i = 0; i < 5; i++) {
        player.pos += 1
        vi.advanceTimersByTime(1000)
      }
    })
    expect(watchStore.saveProgress).toHaveBeenCalledWith(video.id, 10, 100)
    player.pos = 12
    act(() => yt.onStateChange({ data: PAUSED }))
    expect(watchStore.saveProgress).toHaveBeenLastCalledWith(video.id, 12, 100)
  })
})
