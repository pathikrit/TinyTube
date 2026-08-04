import { useEffect, useMemo, useState } from 'react'
import { mergeChannels } from '../lib/channels.js'
import { getChannelVideosCached } from '../lib/youtubeApi.js'

/**
 * Gallery data: curated channels from videos.json filtered by the parent's
 * settings (age range, hidden), merged with parent-added channels whose
 * videos are fetched via the Data API (cache-first).
 */
export default function useVideos(settings) {
  const [db, setDb] = useState(null)
  const [error, setError] = useState(null)
  const [customVideosById, setCustomVideosById] = useState({})

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'videos.json')
      .then(r => {
        if (!r.ok) throw new Error(`videos.json: HTTP ${r.status}`)
        return r.json()
      })
      .then(setDb)
      .catch(setError)
  }, [])

  const { apiKey, customChannels } = settings
  useEffect(() => {
    let cancelled = false
    Promise.all(
      customChannels.map(ch =>
        getChannelVideosCached(apiKey, ch.channel_id).then(videos => [ch.channel_id, videos]),
      ),
    ).then(entries => {
      if (!cancelled) setCustomVideosById(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [apiKey, customChannels])

  const channels = useMemo(
    () => (db ? mergeChannels(db, customVideosById, settings) : null),
    [db, customVideosById, settings],
  )

  return { db, channels, error }
}
