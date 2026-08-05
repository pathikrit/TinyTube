/**
 * Transparent layer over the whole iframe: every touch lands here instead of
 * on YouTube's UI. A tap only toggles our own controls.
 */
export default function TouchShield({ onTap }) {
  return <div className="touch-shield" onPointerUp={onTap} />
}
