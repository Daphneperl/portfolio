import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { preloadAllDomImages } from '../lib/preload'

const FADE_MS = 500 // must match .loading-screen's CSS transition duration

/**
 * Full-screen splash shown until every image the site uses has actually
 * loaded — not just the WebGL textures. useProgress (drei) tracks THREE's
 * DefaultLoadingManager, which only sees useTexture() calls: the sketch
 * pile, background, floating items, gif-figure frames. It's blind to the
 * many plain `<img src=...>` tags WorldContent.tsx renders (project
 * screenshots, the papers grid, the hub's floating photo, the in-silico
 * microbe floaters, falling stars) — those used to keep arriving mid-scroll
 * well after this screen had already disappeared. preloadAllDomImages()
 * (src/lib/preload.ts) fetches that whole list itself so its completion can
 * gate the fade-out too. No artificial minimum hold — this waits for BOTH
 * to genuinely finish, however long that takes, then fades immediately.
 *
 * Deliberately minimal — no retro-window chrome here, just the gif and a
 * thin progress bar.
 */
export function LoadingScreen() {
  // drei's useProgress exposes real item COUNTS (loaded/total), not just a
  // percentage — using those instead of `progress` directly lets the two
  // queues (textures + DOM images) combine into one honest weighted bar
  // instead of two percentages fighting for the same number.
  const { active: texturesActive, loaded: texLoaded, total: texTotal } = useProgress()
  const [dom, setDom] = useState({ loaded: 0, total: 0 })
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)
  const startedDomPreload = useRef(false)

  useEffect(() => {
    if (startedDomPreload.current) return
    startedDomPreload.current = true
    preloadAllDomImages((loaded, total) => setDom({ loaded, total }))
  }, [])

  const domDone = dom.total > 0 && dom.loaded >= dom.total
  const texturesDone = texTotal > 0 && !texturesActive && texLoaded >= texTotal

  useEffect(() => {
    if (!domDone || !texturesDone) return
    setFading(true)
  }, [domDone, texturesDone])

  useEffect(() => {
    if (!fading) return
    const t = setTimeout(() => setVisible(false), FADE_MS)
    return () => clearTimeout(t)
  }, [fading])

  if (!visible) return null

  const totalItems = dom.total + texTotal
  const loadedItems = dom.loaded + texLoaded
  const pct = totalItems > 0 ? Math.round((loadedItems / totalItems) * 100) : 0

  return (
    <div className={`loading-screen ${fading ? 'loading-screen-out' : ''}`} aria-hidden={fading}>
      <div className="loading-content">
        <img src="/daph-gif.gif" alt="" className="loading-gif" />
        <div className="loading-bar-track">
          <div className="loading-bar-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
    </div>
  )
}
