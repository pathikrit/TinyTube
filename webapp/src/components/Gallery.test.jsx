import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import Gallery from './Gallery.jsx'

const channels = [{ channel_title: 'Chan', videos: [{ id: 'v1', title: 'Vid', thumbnail: 't.jpg' }] }]
const watchStore = { watched: {} }

afterEach(() => vi.useRealTimers())

describe('Parents button lockout', () => {
  it('is visible when unlocked and opens the gate', () => {
    const onParents = vi.fn()
    render(
      <Gallery channels={channels} watchStore={watchStore} parentLockUntil={0} onPlay={() => {}} onParents={onParents} />,
    )
    fireEvent.click(screen.getByLabelText('Parents'))
    expect(onParents).toHaveBeenCalled()
  })

  it('is invisible while locked and reappears when the lock expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    render(
      <Gallery
        channels={channels}
        watchStore={watchStore}
        parentLockUntil={1_000_000 + 60_000}
        onPlay={() => {}}
        onParents={() => {}}
      />,
    )
    expect(screen.queryByLabelText('Parents')).toBeNull()
    act(() => vi.advanceTimersByTime(60_001))
    expect(screen.getByLabelText('Parents')).toBeTruthy()
  })
})
