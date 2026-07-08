import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { preloadAllDomImages } from '../lib/preload'

const FADE_MS = 500 // must match .loading-screen's CSS transition duration
const SETTLE_FRAMES = 20 // ~1/3s of real rendered frames before revealing, not just a timer

/**
 * Full-screen splash shown until the assets the INITIAL hub view actually
 * needs have loaded — not the whole site's. useProgress (drei) tracks
 * THREE's DefaultLoadingManager (useTexture calls: just Background.png now
 * that ImagePile lazy-mounts on first pile-detour entry, see Scene.tsx) and
 * is blind to plain `<img src=...>` tags, so preloadAllDomImages() (see
 * src/lib/preload.ts) covers those too — but scoped to just the hub's
 * floating photo, not every project screenshot/paper/star across the whole
 * site. Everything past the hub still loads normally, lazily, as you scroll
 * to it — waiting on all of it up front would mean a first load sitting
 * through ~70MB of images belonging to sections you haven't seen yet.
 * No artificial minimum hold — fades as soon as both queues genuinely
 * finish, however long that takes.
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

  // Once everything's actually loaded, don't fade on that same tick — give the
  // scene a handful of real rendered frames first (camera already in its final
  // position by then; see CameraRig's `_initialized` snap), so whatever the
  // GPU/React still needs to settle (shader warm-up, beat opacity catching up
  // to the now-correct camera distance) finishes BEHIND the loader instead of
  // popping visibly during/after its fade.
  useEffect(() => {
    if (!domDone || !texturesDone) return
    let frames = 0
    let raf = 0
    const tick = () => {
      frames += 1
      if (frames >= SETTLE_FRAMES) {
        setFading(true)
      } else {
        raf = requestAnimationFrame(tick)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
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
