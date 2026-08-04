import { useCallback, useState } from 'react'

const KEY = 'tinytube:settings:v1'

export const DEFAULTS = {
  apiKey: '',
  ageRange: [1, 15], // everything
  customChannels: [], // parent-added, same flat shape as channels.json entries: [{channel_id, channel_title, thumbnail, min_age, max_age}]
  overrides: {}, // per curated channel_id: {min_age?, max_age?, hidden?} edited in the table
  parentLockUntil: 0, // ms epoch; parents button hidden until then after a failed gate
}

const PARENT_LOCK_MS = 60_000

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY)) ?? {}
    // fold pre-refactor fields into the unified overrides map
    const overrides = { ...parsed.ageOverrides, ...parsed.overrides }
    for (const id of parsed.hiddenChannels ?? []) overrides[id] = { ...overrides[id], hidden: true }
    delete parsed.hiddenChannels
    delete parsed.ageOverrides
    return { ...DEFAULTS, ...parsed, overrides }
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
    addCustomChannel: ch =>
      update({
        customChannels: [...settings.customChannels.filter(c => c.channel_id !== ch.channel_id), ch],
      }),
    updateCustomChannel: (id, patch) =>
      update({
        customChannels: settings.customChannels.map(c => (c.channel_id === id ? { ...c, ...patch } : c)),
      }),
    removeCustomChannel: id =>
      update({ customChannels: settings.customChannels.filter(c => c.channel_id !== id) }),
    setOverride: (id, patch) =>
      update({ overrides: { ...settings.overrides, [id]: { ...settings.overrides[id], ...patch } } }),
    restoreHidden: () =>
      update({
        overrides: Object.fromEntries(
          Object.entries(settings.overrides)
            .map(([id, { hidden, ...rest }]) => [id, rest])
            .filter(([, rest]) => Object.keys(rest).length > 0),
        ),
      }),
    lockParents: () => update({ parentLockUntil: Date.now() + PARENT_LOCK_MS }),
  }
}
