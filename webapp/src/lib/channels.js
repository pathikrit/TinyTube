/** Inclusive range overlap: does [min_age, max_age] intersect the parent's [lo, hi]? */
export function overlaps([lo, hi], minAge, maxAge) {
  return minAge <= hi && lo <= maxAge
}

/** Curated channels from videos.json groups, deduped, tagged with their group's age range. */
export function curatedChannels(db) {
  const seen = new Set()
  const out = []
  for (const group of db?.groups ?? []) {
    for (const ch of group.channels) {
      if (seen.has(ch.channel_id)) continue
      seen.add(ch.channel_id)
      out.push({ ...ch, min_age: group.min_age, max_age: group.max_age })
    }
  }
  return out
}

/**
 * The gallery's channel list: curated channels within the age range and not
 * hidden, plus parent-added channels within their own range — shaped exactly
 * like curated ones ({channel_title, videos}) so gallerySort works unchanged.
 * Curated wins if a parent adds an already-curated channel.
 */
export function mergeChannels(db, customVideosById, settings) {
  const { ageRange, hiddenChannels, customChannels } = settings
  const curated = curatedChannels(db).filter(
    ch => overlaps(ageRange, ch.min_age, ch.max_age) && !hiddenChannels.includes(ch.channel_id),
  )
  const curatedIds = new Set(curated.map(ch => ch.channel_id))
  const custom = customChannels
    .filter(ch => overlaps(ageRange, ch.min_age, ch.max_age))
    .filter(ch => !curatedIds.has(ch.channel_id) && !hiddenChannels.includes(ch.channel_id))
    .map(ch => ({ ...ch, videos: customVideosById[ch.channel_id] ?? [] }))
  return [...curated, ...custom]
}
