import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  searchChannels,
  resolveChannel,
  parseDuration,
  fetchChannelVideos,
  getChannelVideosCached,
} from './youtubeApi.js'

const UC = 'UCoookXUzPciGrEZEXmh4Jjg'

function mockFetch(bodyByPath) {
  return vi.fn(async url => {
    const u = new URL(url)
    const path = u.pathname.split('/').pop()
    const body = bodyByPath[path]
    if (!body) return { ok: false, status: 404, json: async () => ({ error: { message: 'not found' } }) }
    return { ok: true, json: async () => (typeof body === 'function' ? body(u.searchParams) : body) }
  })
}

// Node 22+ exposes a broken experimental localStorage global that shadows
// jsdom's — stub a real in-memory one so the cache actually persists in tests.
function fakeStorage() {
  let store = {}
  return {
    getItem: k => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
    clear: () => { store = {} },
  }
}

beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('parseDuration', () => {
  it('parses ISO8601 durations', () => {
    expect(parseDuration('PT1H2M3S')).toBe(3723)
    expect(parseDuration('PT2M')).toBe(120)
    expect(parseDuration('PT45S')).toBe(45)
    expect(parseDuration('P0D')).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
  })
})

describe('resolveChannel', () => {
  const snippet = { title: 'Chan', thumbnails: { medium: { url: 't.jpg' } } }

  it.each([
    [`https://www.youtube.com/channel/${UC}`, 'id', UC],
    [UC, 'id', UC],
    ['https://www.youtube.com/@SciShowKids', 'forHandle', '@SciShowKids'],
    ['@SciShowKids', 'forHandle', '@SciShowKids'],
  ])('parses %s', async (input, param, expected) => {
    const fetch = mockFetch({ channels: params => {
      expect(params.get(param)).toBe(expected)
      return { items: [{ id: UC, snippet }] }
    } })
    vi.stubGlobal('fetch', fetch)
    const ch = await resolveChannel('KEY', input)
    expect(ch).toEqual({ channel_id: UC, channel_title: 'Chan', thumbnail: 't.jpg' })
  })

  it('rejects unparsable input without a network call', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(resolveChannel('KEY', 'just words')).rejects.toThrow(/Paste a channel/)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('searchChannels', () => {
  it('hits search with type=channel and maps results', async () => {
    vi.stubGlobal('fetch', mockFetch({ search: params => {
      expect(params.get('type')).toBe('channel')
      expect(params.get('q')).toBe('blippi')
      return { items: [{ id: { channelId: UC }, snippet: { title: 'Blippi', thumbnails: {} } }] }
    } }))
    const results = await searchChannels('KEY', 'blippi')
    expect(results).toEqual([{ channel_id: UC, channel_title: 'Blippi', thumbnail: undefined }])
  })
})

describe('fetchChannelVideos', () => {
  it('uses the long-form UULF playlist and merges durations', async () => {
    vi.stubGlobal('fetch', mockFetch({
      playlistItems: params => {
        expect(params.get('playlistId')).toBe(`UULF${UC.slice(2)}`)
        return { items: [{ contentDetails: { videoId: 'vid1' }, snippet: { title: 'T1' } }] }
      },
      videos: { items: [{ id: 'vid1', contentDetails: { duration: 'PT2M' } }] },
    }))
    const videos = await fetchChannelVideos('KEY', UC)
    expect(videos).toEqual([
      { id: 'vid1', title: 'T1', duration: 120, thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg' },
    ])
  })

  it('propagates API errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'quota exceeded' } }),
    })))
    await expect(fetchChannelVideos('KEY', UC)).rejects.toThrow('quota exceeded')
  })
})

describe('getChannelVideosCached', () => {
  const playlistBody = { items: [{ contentDetails: { videoId: 'vid1' }, snippet: { title: 'T1' } }] }

  it('fetches, caches, then serves from cache without network', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const fetch = mockFetch({ playlistItems: playlistBody, videos: { items: [] } })
    vi.stubGlobal('fetch', fetch)

    const first = await getChannelVideosCached('KEY', UC)
    expect(first).toHaveLength(1)
    const callsAfterFirst = fetch.mock.calls.length

    const second = await getChannelVideosCached('KEY', UC)
    expect(second).toEqual(first)
    expect(fetch.mock.calls.length).toBe(callsAfterFirst) // cache hit

    vi.setSystemTime(1_000_000 + 25 * 60 * 60 * 1000) // >24h -> stale
    await getChannelVideosCached('KEY', UC)
    expect(fetch.mock.calls.length).toBeGreaterThan(callsAfterFirst)
  })

  it('returns stale cache on fetch failure and [] without key or cache', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    vi.stubGlobal('fetch', mockFetch({ playlistItems: playlistBody, videos: { items: [] } }))
    await getChannelVideosCached('KEY', UC) // seed cache

    vi.setSystemTime(1_000_000 + 25 * 60 * 60 * 1000)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await getChannelVideosCached('KEY', UC)).toHaveLength(1) // stale fallback

    expect(await getChannelVideosCached('', 'UCnothing000000000000000')).toEqual([]) // keyless, no cache
  })
})
