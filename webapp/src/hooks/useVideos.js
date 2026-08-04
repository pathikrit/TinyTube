import { useEffect, useState } from 'react'

/**
 * Loads videos.json and returns the channels visible for the given age.
 * age === null (no ?age param) -> all groups. Channels appearing in several
 * matching groups are deduped by channel_id.
 */
export default function useVideos(age) {
  const [state, setState] = useState({ channels: null, error: null })

  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'videos.json')
      .then(r => {
        if (!r.ok) throw new Error(`videos.json: HTTP ${r.status}`)
        return r.json()
      })
      .then(db => {
        const groups = db.groups.filter(
          g => age === null || (g.min_age <= age && age <= g.max_age),
        )
        const seen = new Set()
        const channels = []
        for (const g of groups.length ? groups : db.groups) {
          for (const ch of g.channels) {
            if (seen.has(ch.channel_id)) continue
            seen.add(ch.channel_id)
            channels.push(ch)
          }
        }
        setState({ channels, error: null })
      })
      .catch(error => setState({ channels: null, error }))
  }, [age])

  return state
}
