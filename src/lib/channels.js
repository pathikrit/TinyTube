/** Inclusive range overlap: does [min_age, max_age] intersect the parent's [lo, hi]? */
export function overlaps([lo, hi], minAge, maxAge) {
  return minAge <= hi && lo <= maxAge
}

/**
 * Curated channels from videos.json with the parent's per-channel edits
 * applied — overrides[channel_id] may adjust min_age/max_age or set hidden.
 */
export function curatedChannels(db, overrides = {}) {
  return (db?.channels ?? []).map(ch => ({ ...ch, ...overrides[ch.channel_id] }))
}

/**
 * The gallery's channel list: curated channels (edits applied) that aren't
 * hidden and overlap the age range, plus parent-added channels — shaped
 * exactly like curated ones ({channel_title, videos}) so gallerySort works
 * unchanged. Curated wins if a parent adds an already-curated channel.
 */
export function mergeChannels(db, customVideosById, settings) {
  const { ageRange, customChannels, overrides } = settings
  const curated = curatedChannels(db, overrides).filter(
    ch => !ch.hidden && overlaps(ageRange, ch.min_age, ch.max_age),
  )
  const curatedIds = new Set((db?.channels ?? []).map(ch => ch.channel_id))
  const custom = customChannels
    .filter(ch => !curatedIds.has(ch.channel_id) && overlaps(ageRange, ch.min_age, ch.max_age))
    .map(ch => ({ ...ch, videos: customVideosById[ch.channel_id] ?? [] }))
  return [...curated, ...custom]
}
