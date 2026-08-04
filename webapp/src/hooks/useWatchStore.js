import { useCallback, useState } from 'react'

const KEY = 'tinytube:v1'
const MAX_ENTRIES = 500
export const WATCHED_THRESHOLD = 0.95 // beyond this it's just credits/outros
const LIKED_THRESHOLD = 0.2 // bailed before this -> probably didn't like it

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? { lastVideoId: null, watched: {} }
  } catch {
    return { lastVideoId: null, watched: {} }
  }
}

function persist(store) {
  const ids = Object.keys(store.watched)
  if (ids.length > MAX_ENTRIES) {
    ids.sort((a, b) => store.watched[a].updatedAt - store.watched[b].updatedAt)
    for (const id of ids.slice(0, ids.length - MAX_ENTRIES)) delete store.watched[id]
  }
  localStorage.setItem(KEY, JSON.stringify(store))
}

export function fraction(entry) {
  if (!entry) return 0
  if (entry.completed) return 1
  return entry.dur ? Math.min(entry.pos / entry.dur, 1) : 0
}

export default function useWatchStore() {
  const [store, setStore] = useState(load)

  const saveProgress = useCallback((id, pos, dur) => {
    setStore(prev => {
      const entry = prev.watched[id]
      const completed = (entry?.completed ?? false) || (dur > 0 && pos / dur > WATCHED_THRESHOLD)
      const next = {
        lastVideoId: id,
        watched: { ...prev.watched, [id]: { pos, dur, completed, updatedAt: Date.now() } },
      }
      persist(next)
      return next
    })
  }, [])

  const markCompleted = useCallback(id => {
    setStore(prev => {
      const entry = prev.watched[id] ?? { pos: 0, dur: 0 }
      const next = {
        lastVideoId: id,
        watched: { ...prev.watched, [id]: { ...entry, completed: true, updatedAt: Date.now() } },
      }
      persist(next)
      return next
    })
  }, [])

  return { watched: store.watched, saveProgress, markCompleted }
}

/** Interleave lists round-robin: first item of each list, then second of each, ... */
function roundRobin(lists) {
  const out = []
  const longest = Math.max(0, ...lists.map(l => l.length))
  for (let i = 0; i < longest; i++) {
    for (const list of lists) if (i < list.length) out.push(list[i])
  }
  return out
}

/**
 * Gallery order:
 * 1. continue watching (20-95% done), closest to finished first
 * 2. fresh videos, round-robin across channels (newest first within a channel)
 *    so a high-volume channel can't flood out a quiet one
 * 3. abandoned (<20%, started but bailed), same round-robin
 * 4. watched (>95%), or hidden entirely when hideWatched
 */
export function gallerySort(channels, watched, hideWatched) {
  const inProgress = []
  const freshPerChannel = []
  const abandonedPerChannel = []
  const done = []

  for (const ch of channels) {
    const fresh = []
    const abandoned = []
    for (const video of ch.videos) {
      const v = { ...video, channelTitle: ch.channel_title }
      const entry = watched[v.id]
      const f = fraction(entry)
      if (f > WATCHED_THRESHOLD) done.push(v)
      else if (f >= LIKED_THRESHOLD) inProgress.push({ v, f })
      else if (entry) abandoned.push(v)
      else fresh.push(v)
    }
    freshPerChannel.push(fresh)
    abandonedPerChannel.push(abandoned)
  }

  inProgress.sort((a, b) => b.f - a.f)
  return [
    ...inProgress.map(x => x.v),
    ...roundRobin(freshPerChannel),
    ...roundRobin(abandonedPerChannel),
    ...(hideWatched ? [] : done),
  ]
}
