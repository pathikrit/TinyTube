import { describe, it, expect } from 'vitest'
import { gallerySort, fraction } from './useWatchStore.js'

const channels = [
  { channel_title: 'Busy', videos: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }, { id: 'b4' }] },
  { channel_title: 'Quiet', videos: [{ id: 'q1' }, { id: 'q2' }] },
]

describe('gallerySort', () => {
  it('orders: continue-watching, fresh round-robin, abandoned, watched', () => {
    const watched = {
      b2: { pos: 80, dur: 100, completed: false }, // 80% -> continue watching
      q1: { pos: 96, dur: 100, completed: true }, // watched -> last
      b3: { pos: 5, dur: 100, completed: false }, // 5% -> abandoned
    }
    expect(gallerySort(channels, watched).map(v => v.id)).toEqual([
      'b2', // continue watching
      'b1', 'q2', 'b4', // fresh, interleaved across channels
      'b3', // abandoned
      'q1', // watched
    ])
  })

  it('interleaves channels so a busy channel cannot flood a quiet one', () => {
    const ids = gallerySort(channels, {}).map(v => v.id)
    expect(ids).toEqual(['b1', 'q1', 'b2', 'q2', 'b3', 'b4'])
  })

  it('sorts continue-watching by closeness to the end', () => {
    const watched = {
      b1: { pos: 30, dur: 100, completed: false },
      q1: { pos: 90, dur: 100, completed: false },
    }
    expect(gallerySort(channels, watched).slice(0, 2).map(v => v.id)).toEqual(['q1', 'b1'])
  })
})

describe('fraction', () => {
  it('treats completed as fully watched even without positions', () => {
    expect(fraction({ pos: 0, dur: 0, completed: true })).toBe(1)
    expect(fraction(undefined)).toBe(0)
  })
})
