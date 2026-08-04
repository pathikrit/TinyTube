import { useCallback, useState } from 'react'

const KEY = 'tinytube:settings:v1'

export const DEFAULTS = {
  apiKey: '',
  ageRange: [1, 15], // everything
  hiddenChannels: [], // curated channel_ids toggled off by a parent
  customChannels: [], // [{channel_id, channel_title, thumbnail, min_age, max_age}]
  parentLockUntil: 0, // ms epoch; parents button hidden until then after a failed gate
}

const PARENT_LOCK_MS = 60_000

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) }
  } catch {
    return { ...DEFAULTS }
  }
}

export default function useSettings() {
  const [settings, setSettings] = useState(load)

  const update = useCallback(patch => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch (e) {
        console.error('settings persist failed', e)
      }
      return next
    })
  }, [])

  return {
    settings,
    setApiKey: apiKey => update({ apiKey: apiKey.trim() }),
    setAgeRange: ([lo, hi]) => update({ ageRange: [Math.min(lo, hi), Math.max(lo, hi)] }),
    toggleHidden: id =>
      update({
        hiddenChannels: settings.hiddenChannels.includes(id)
          ? settings.hiddenChannels.filter(x => x !== id)
          : [...settings.hiddenChannels, id],
      }),
    addCustomChannel: ch =>
      update({
        customChannels: [...settings.customChannels.filter(c => c.channel_id !== ch.channel_id), ch],
      }),
    removeCustomChannel: id =>
      update({ customChannels: settings.customChannels.filter(c => c.channel_id !== id) }),
    lockParents: () => update({ parentLockUntil: Date.now() + PARENT_LOCK_MS }),
  }
}
