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
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    seekTo: vi.fn(),
    getCurrentTime: () => 5,
    getDuration: () => 100,
  }
}

let watchStore, onExit, onQuotaExhausted
beforeEach(() => {
  watchStore = {
    watched: {},
    usage: { window: { start: null, secs: 0 }, days: {}, hours: {} },
    saveProgress: vi.fn(),
    markCompleted: vi.fn(),
    // stateful like the real hook: the quota check reads usage back on each tick
    addWatchTime: vi.fn(secs => {
      watchStore.usage.window.start ??= Date.now()
      watchStore.usage.window.secs += secs
    }),
  }
  onExit = vi.fn()
  onQuotaExhausted = vi.fn()
})

const renderPlayer = (Component = VideoPlayer, quotaMins = 60) =>
  render(
    <Component
      video={video}
      watchStore={watchStore}
      quotaMins={quotaMins}
      onExit={onExit}
      onQuotaExhausted={onQuotaExhausted}
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

  it('can still escape back to the gallery', () => {
    fireEvent.click(screen.getByText(/More videos/))
    expect(onExit).toHaveBeenCalled()
  })
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

describe('watch quota', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const startPlaying = (quotaMins = 60) => {
    renderPlayer(VideoPlayer, quotaMins)
    act(() => yt.onReady({ target: fakePlayer() }))
    act(() => yt.onStateChange({ data: PLAYING }))
  }

  it('flushes only PLAYING seconds, every 5 ticks and on pause', () => {
    startPlaying()
    act(() => vi.advanceTimersByTime(5000))
    expect(watchStore.addWatchTime).toHaveBeenCalledWith(5)
    act(() => vi.advanceTimersByTime(2000))
    act(() => yt.onStateChange({ data: PAUSED })) // flushes the 2s remainder
    expect(watchStore.addWatchTime).toHaveBeenLastCalledWith(2)
    watchStore.addWatchTime.mockClear()
    act(() => vi.advanceTimersByTime(10_000)) // paused time is free
    expect(watchStore.addWatchTime).not.toHaveBeenCalled()
    expect(onQuotaExhausted).not.toHaveBeenCalled()
  })

  it('hard-stops the instant the quota runs out mid-video', () => {
    watchStore.usage.window = { start: Date.now(), secs: 3570 } // 30s left of 60min
    startPlaying()
    act(() => vi.advanceTimersByTime(29_000))
    expect(onQuotaExhausted).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1000))
    expect(onQuotaExhausted).toHaveBeenCalled()
    expect(watchStore.usage.window.secs).toBe(3600) // spent seconds flushed before exiting
  })
})

describe('top bar countdown', () => {
  it('shows the minutes remaining against the quota', () => {
    watchStore.usage.window = { start: Date.now(), secs: 3570 }
    renderPlayer(PlayerView)
    expect(screen.getByText(/1 min remaining/)).toBeTruthy()
  })

  it('never goes negative', () => {
    watchStore.usage.window = { start: Date.now(), secs: 9999 }
    renderPlayer(PlayerView)
    expect(screen.getByText(/0 min remaining/)).toBeTruthy()
  })
})
