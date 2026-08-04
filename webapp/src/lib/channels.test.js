import { describe, it, expect } from 'vitest'
import { overlaps, curatedChannels, mergeChannels } from './channels.js'
import { DEFAULTS } from '../hooks/useSettings.js'

const db = {
  groups: [
    { min_age: 2, max_age: 4, channels: [{ channel_id: 'UCa', channel_title: 'Toddler', videos: [{ id: 'v1' }] }] },
    { min_age: 3, max_age: 7, channels: [{ channel_id: 'UCb', channel_title: 'Preschool', videos: [{ id: 'v2' }] }] },
    {
      min_age: 5,
      max_age: 10,
      channels: [
        { channel_id: 'UCc', channel_title: 'School', videos: [{ id: 'v3' }] },
        { channel_id: 'UCa', channel_title: 'Toddler', videos: [{ id: 'v1' }] }, // dup across groups
      ],
    },
  ],
}

const settings = (overrides = {}) => ({ ...DEFAULTS, ...overrides })

describe('overlaps', () => {
  it('is inclusive at the boundaries', () => {
    expect(overlaps([4, 4], 2, 4)).toBe(true)
    expect(overlaps([4, 4], 3, 7)).toBe(true)
    expect(overlaps([4, 4], 5, 10)).toBe(false)
  })
})

describe('curatedChannels', () => {
  it('dedupes across groups keeping the first group range', () => {
    const chans = curatedChannels(db)
    expect(chans.map(c => c.channel_id)).toEqual(['UCa', 'UCb', 'UCc'])
    expect(chans[0]).toMatchObject({ min_age: 2, max_age: 4 })
  })
})

describe('mergeChannels', () => {
  it('default range shows everything', () => {
    expect(mergeChannels(db, {}, settings()).map(c => c.channel_id)).toEqual(['UCa', 'UCb', 'UCc'])
  })

  it('filters curated groups by age overlap', () => {
    expect(mergeChannels(db, {}, settings({ ageRange: [5, 6] })).map(c => c.channel_id)).toEqual([
      'UCb', 'UCc',
    ])
  })

  it('excludes hidden channels', () => {
    expect(
      mergeChannels(db, {}, settings({ hiddenChannels: ['UCb'] })).map(c => c.channel_id),
    ).toEqual(['UCa', 'UCc'])
  })

  it('shapes custom channels like curated ones and filters by their own range', () => {
    const custom = [
      { channel_id: 'UCx', channel_title: 'Custom', min_age: 1, max_age: 15 },
      { channel_id: 'UCy', channel_title: 'Teen', min_age: 13, max_age: 15 },
    ]
    const merged = mergeChannels(db, { UCx: [{ id: 'cv1' }] }, settings({ customChannels: custom, ageRange: [3, 8] }))
    const custom1 = merged.find(c => c.channel_id === 'UCx')
    expect(custom1.videos).toEqual([{ id: 'cv1' }])
    expect(custom1.channel_title).toBe('Custom')
    expect(merged.find(c => c.channel_id === 'UCy')).toBeUndefined()
  })

  it('curated wins when a parent adds an already-curated channel', () => {
    const custom = [{ channel_id: 'UCa', channel_title: 'Dup', min_age: 1, max_age: 15 }]
    const merged = mergeChannels(db, {}, settings({ customChannels: custom }))
    expect(merged.filter(c => c.channel_id === 'UCa')).toHaveLength(1)
    expect(merged.find(c => c.channel_id === 'UCa').channel_title).toBe('Toddler')
  })
})
