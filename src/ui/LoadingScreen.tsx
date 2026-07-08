import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'

const MIN_VISIBLE_MS = 2000 // always shows for a beat, regardless of how fast assets actually load
const FADE_MS = 500 // must match .loading-screen's CSS transition duration

/**
 * Full-screen splash shown until every texture the scene needs has actually
 * loaded — useProgress reads THREE's shared DefaultLoadingManager, so this
 * tracks the real asset queue rather than a fake timer (MIN_VISIBLE_MS is the
 * only artificial floor, so it never just flashes). Lives outside the Canvas
 * (plain DOM/CSS): the whole point is covering the screen before the WebGL
 * scene has anything to show, so it can't depend on the scene itself.
 *
 * Deliberately minimal — no retro-window chrome here, just the gif and a
 * thin progress bar. A full mock browser window read as too much for a
 * moment that's on screen for a few seconds at most.
 */
export function LoadingScreen() {
  const { active, progress } = useProgress()
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)
  const mountedAt = useRef(performance.now())

  useEffect(() => {
    if (active || progress < 100) return
    const elapsed = performance.now() - mountedAt.current
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed)
    const t = setTimeout(() => setFading(true), wait)
    return () => clearTimeout(t)
  }, [active, progress])

  useEffect(() => {
    if (!fading) return
    const t = setTimeout(() => setVisible(false), FADE_MS)
    return () => clearTimeout(t)
  }, [fading])

  if (!visible) return null

  const pct = Math.min(100, Math.round(progress))

  return (
    <div className={`loading-screen ${fading ? 'loading-screen-out' : ''}`} aria-hidden={fading}>
      <div className="loading-content">
        <img src="/daph-gif.gif" alt="" className="loading-gif" />
        <div className="loading-bar-track">
          <div className="loading-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
