#!/usr/bin/env node
/**
 * Fetch approved channels (channels.json) into a static public/videos.json
 * via the official YouTube Data API v3, reusing the webapp's tested client
 * (src/lib/youtubeApi.js). ~3 quota units per channel per run.
 *
 * Usage: YOUTUBE_API_KEY=... node download.mjs [--channels channels.json]
 *        [--out public/videos.json] [--seed previous-videos.json]
 *
 * --seed (the currently-deployed videos.json) is a stale per-channel fallback
 * so one broken channel or API hiccup never blanks the site.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { resolveChannel, fetchChannelVideos } from './src/lib/youtubeApi.js'

const { values: args } = parseArgs({
  options: {
    channels: { type: 'string', default: 'channels.json' },
    out: { type: 'string', default: 'public/videos.json' },
    seed: { type: 'string' },
  },
})

const KEY = process.env.YOUTUBE_API_KEY
if (!KEY) {
  console.error('YOUTUBE_API_KEY is not set — one-time setup: cp .env.sample .env and paste your key (see README)')
  process.exit(1)
}

const UC_ID = /^UC[0-9A-Za-z_-]{22}$/

/** bare name | @handle | UCxxxx | any youtube.com URL -> canonical https://www.youtube.com/... URL */
function normalize(entry) {
  const e = entry.trim().replace(/\/+$/, '')
  if (UC_ID.test(e)) return `https://www.youtube.com/channel/${e}`
  if (e.startsWith('@')) return `https://www.youtube.com/${e}`
  if (/^[\w.-]+$/.test(e)) return `https://www.youtube.com/@${e}` // bare channel name
  return e.replace(/^(https?:\/\/)?(www\.|m\.)?youtube\.com/, 'https://www.youtube.com')
}

/** Previous videos.json -> {source_url: channel blob} for stale fallback. */
async function loadSeed(path) {
  if (!path) return {}
  try {
    const prev = JSON.parse(await readFile(path, 'utf8'))
    return Object.fromEntries((prev.channels ?? []).map(ch => [ch.source_url, ch]))
  } catch (e) {
    console.warn(`seed ${path} unusable (${e.message}); continuing without`)
    return {}
  }
}

/** channels.json entry -> videos.json channel blob; null when it can't be fetched or seeded. */
async function download(entry, seed) {
  const source_url = normalize(entry.channel)
  const ages = { min_age: entry.min_age ?? 1, max_age: entry.max_age ?? 15 }
  try {
    const ch = await resolveChannel(KEY, source_url)
    const videos = await fetchChannelVideos(KEY, ch.channel_id)
    if (!videos.length) throw new Error('no long-form uploads')
    return { ...ch, source_url, ...ages, videos }
  } catch (e) {
    const stale = seed[source_url]
    if (!stale) {
      console.warn(`${source_url}: ${e.message} — SKIPPED (no seed fallback)`)
      return null
    }
    console.warn(`${source_url}: ${e.message} — using stale seed data`)
    return { ...stale, ...ages }
  }
}

const entries = JSON.parse(await readFile(args.channels, 'utf8'))
const seed = await loadSeed(args.seed)

const channels = []
for (const entry of entries) {
  const blob = await download(entry, seed)
  if (!blob) continue
  channels.push(blob)
  console.log(`${blob.channel_title} (ages ${blob.min_age}-${blob.max_age}): ${blob.videos.length} videos`)
}

const total = channels.reduce((n, ch) => n + ch.videos.length, 0)
if (total === 0) {
  console.error('FATAL: zero videos across all channels')
  process.exit(1)
}

const out = { schema_version: 2, generated_at: new Date().toISOString(), channels }
await writeFile(args.out, JSON.stringify(out, null, 1))
console.log(`wrote ${args.out}: ${total} videos`)
