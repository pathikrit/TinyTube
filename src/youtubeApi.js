/**
 * Minimal YouTube Data API v3 client for parent-added channels. Every call
 * uses the PARENT's own API key (stored in localStorage) — this repo/site
 * ships no key.
 */

const API = 'https://www.googleapis.com/youtube/v3'
const CACHE_KEY = 'tinytube:videocache:v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const UC_ID = /UC[0-9A-Za-z_-]{22}/

async function get(path, params) {
  const url = `${API}/${path}?${new URLSearchParams(params)}`
  const resp = await fetch(url)
  const body = await resp.json().catch(() => ({}))
  if (!resp.ok) throw new Error(body?.error?.message ?? `YouTube API: HTTP ${resp.status}`)
  return body
}

function channelFromSnippet(id, snippet) {
  return {
    channel_id: id,
    channel_title: snippet.title,
    thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url,
  }
}

/** topicCategories are Wikipedia URLs, e.g. .../wiki/Children%27s_music -> "Children's music" */
function topicNames(topicDetails) {
  const names = (topicDetails?.topicCategories ?? []).map(url =>
    decodeURIComponent(url.split('/').pop()).replace(/_/g, ' '),
  )
  return [...new Set(names)]
}

/** Full channels.list item -> channel blob with the kid-relevant extras and stats. */
function channelFromItem(item) {
  return {
    ...channelFromSnippet(item.id, item.snippet),
    made_for_kids: item.status?.madeForKids ?? null, // COPPA designation; null = unknown
    topics: topicNames(item.topicDetails),
    subscribers: Number(item.statistics?.subscriberCount) || null,
    video_count: Number(item.statistics?.videoCount) || null,
    view_count: Number(item.statistics?.viewCount) || null,
  }
}

/**
 * Free-text channel search with preview stats. search.list costs 100 quota
 * units per call — callers must debounce (the 10k/day default quota affords
 * ~100 fired searches). The follow-up channels.list (1 unit) upgrades results
 * with real avatars and subscriber counts for previews.
 */
export async function searchChannels(apiKey, query) {
  const body = await get('search', { part: 'snippet', type: 'channel', q: query, maxResults: 6, key: apiKey })
  const results = (body.items ?? []).map(item => channelFromSnippet(item.id.channelId, item.snippet))
  if (!results.length) return results
  try {
    const details = await get('channels', {
      part: 'snippet,statistics,status,topicDetails',
      id: results.map(r => r.channel_id).join(','),
      key: apiKey,
    })
    const byId = Object.fromEntries((details.items ?? []).map(it => [it.id, it]))
    return results.map(r => {
      const d = byId[r.channel_id]
      return d ? channelFromItem(d) : r
    })
  } catch {
    return results // preview enrichment is best-effort
  }
}

export function formatCount(n) {
  return n ? Intl.NumberFormat('en', { notation: 'compact' }).format(n) : ''
}

/** Resolve a pasted UC id, channel URL, or @handle (bare or in a URL) to a channel. 1 unit. */
export async function resolveChannel(apiKey, input) {
  const text = input.trim()
  const id = text.match(UC_ID)?.[0]
  const handle = text.match(/@[\w.-]+/)?.[0]
  const params = { part: 'snippet,statistics,status,topicDetails', key: apiKey }
  if (id) params.id = id
  else if (handle) params.forHandle = handle
  else throw new Error('Paste a channel URL, @handle, or UC… id')
  const body = await get('channels', params)
  const item = (body.items ?? [])[0]
  if (!item) throw new Error('Channel not found')
  return channelFromItem(item)
}

/** PT1H2M3S -> seconds; null when unparsable (e.g. P0D live placeholders). */
export function parseDuration(iso) {
  const m = iso?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  return (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0)
}

/**
 * Latest long-form uploads (UULF playlist excludes Shorts), shaped like the
 * scraper's output. 18+ age-restricted videos (ytRating) are dropped — they
 * wouldn't play in an embed anyway and this is a kids app. 2 units.
 */
export async function fetchChannelVideos(apiKey, channelId) {
  const playlist = await get('playlistItems', {
    part: 'snippet,contentDetails',
    playlistId: `UULF${channelId.slice(2)}`,
    maxResults: 50,
    key: apiKey,
  })
  const items = playlist.items ?? []
  if (!items.length) return []

  const ids = items.map(it => it.contentDetails.videoId)
  const durations = {}
  const ageRestricted = new Set()
  try {
    const details = await get('videos', { part: 'contentDetails', id: ids.join(','), key: apiKey })
    for (const v of details.items ?? []) {
      durations[v.id] = parseDuration(v.contentDetails?.duration)
      if (v.contentDetails?.contentRating?.ytRating === 'ytAgeRestricted') ageRestricted.add(v.id)
    }
  } catch (e) {
    console.warn('duration lookup failed, continuing without', e)
  }

  return items
    .filter(it => !ageRestricted.has(it.contentDetails.videoId))
    .map(it => ({
      id: it.contentDetails.videoId,
      title: it.snippet.title,
      duration: durations[it.contentDetails.videoId] ?? null,
      thumbnail: `https://i.ytimg.com/vi/${it.contentDetails.videoId}/mqdefault.jpg`,
    }))
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {}
  } catch {
    return {}
  }
}

function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    console.warn('video cache persist failed', e)
  }
}

export function evictChannelCache(channelId) {
  const cache = readCache()
  delete cache[channelId]
  writeCache(cache)
}

const inflight = {} // StrictMode double-effect / concurrent-render guard

/**
 * Cache-first channel videos: fresh (<24h) cache -> no network; stale/missing
 * with a key -> refetch; fetch failure or no key -> stale cache or [].
 */
export function getChannelVideosCached(apiKey, channelId) {
  const cached = readCache()[channelId]
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS
  if (fresh || !apiKey) return Promise.resolve(cached?.videos ?? [])

  inflight[channelId] ??= fetchChannelVideos(apiKey, channelId)
    .then(videos => {
      writeCache({ ...readCache(), [channelId]: { fetchedAt: Date.now(), videos } })
      return videos
    })
    .catch(e => {
      console.error(`fetch failed for ${channelId}, using stale cache`, e)
      return cached?.videos ?? []
    })
    .finally(() => delete inflight[channelId])
  return inflight[channelId]
}
