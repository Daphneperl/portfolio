import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { pointAt } from './curve'
import { BEATS, BeatContent, BANNER_ANCHOR, type Beat } from '../ui/WorldContent'

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// How big the html renders in world units, and the fog-matched fade band. The
// windows/banners live on the tunnel centreline, so they emerge tiny from the
// vanishing point, grow as the camera flies in, and fade out as they blow past.
const DIST_FACTOR = 100 // drei Html world-scale
const FADE_FAR = 1300 // emerges from the fog at this distance
const FADE_MID = 620 // fully lit by here
const NEAR_HI = 170 // begins to blow past the camera
const NEAR_LO = 45 // fully gone (exited past you)

const _fwd = new THREE.Vector3()
const _to = new THREE.Vector3()

function Beat3D({ beat }: { beat: Beat }) {
  const pos = useMemo(() => pointAt(beat.a), [beat.a])
  const ref = useRef<HTMLDivElement>(null)

  useFrame(({ camera }) => {
    const el = ref.current
    if (!el) return
    const d = camera.position.distanceTo(pos)
    // hide anything behind the camera (already flew past)
    _to.copy(pos).sub(camera.position)
    camera.getWorldDirection(_fwd)
    const behind = _to.dot(_fwd) < 0
    // emerge from the fog (far) and blow past the camera (near); no abrupt UI fade
    const o = behind ? 0 : Math.min(smoothstep(FADE_FAR, FADE_MID, d), smoothstep(NEAR_LO, NEAR_HI, d))
    el.style.opacity = o.toFixed(3)
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
  })

  return (
    <group position={pos}>
      <Html transform sprite distanceFactor={DIST_FACTOR} center zIndexRange={[10, 0]}>
        <div ref={ref} style={{ opacity: 0, willChange: 'opacity' }}>
          <BeatContent beat={beat} />
        </div>
      </Html>
    </group>
  )
}

// Sits a touch deeper in the tunnel than the "Who I Am" banner itself, so it's
// consistently a bit farther from the camera — reads as BEHIND the banner both
// in perspective (smaller/further) and in DOM stacking (lower zIndexRange).
const FLOATER_T_OFFSET = 0.01
// Vertical travel: fully sunk (hidden low, behind/below the panel) -> risen
// (shifted up clear of the panel's top edge entirely — it should read as
// peeking from behind the top-right corner, never overlapping the text).
const FLOATER_Y_SUNK = 120
const FLOATER_Y_RISEN = -260
const FLOATER_X = 260 // fixed rightward shift — sits at the top-right corner

/** The portrait that floats up from behind the hub banner as you approach it,
 * and sinks back down while fading out as you pass — tied to the exact same
 * distance-based opacity curve as the banner, so the two move in lockstep. */
function HubFloater() {
  const pos = useMemo(() => pointAt(BANNER_ANCHOR.hub + FLOATER_T_OFFSET), [])
  const ref = useRef<HTMLDivElement>(null)

  useFrame(({ camera }) => {
    const el = ref.current
    if (!el) return
    const d = camera.position.distanceTo(pos)
    _to.copy(pos).sub(camera.position)
    camera.getWorldDirection(_fwd)
    const behind = _to.dot(_fwd) < 0
    const o = behind ? 0 : Math.min(smoothstep(FADE_FAR, FADE_MID, d), smoothstep(NEAR_LO, NEAR_HI, d))
    el.style.opacity = o.toFixed(3)
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
    const y = FLOATER_Y_SUNK + (FLOATER_Y_RISEN - FLOATER_Y_SUNK) * o
    el.style.transform = `translate(${FLOATER_X}px, ${y.toFixed(1)}px)`
  })

  return (
    <group position={pos}>
      <Html transform sprite distanceFactor={DIST_FACTOR} center zIndexRange={[5, 0]}>
        <div ref={ref} style={{ opacity: 0, willChange: 'opacity, transform' }}>
          <img
            src="/floating-daph.png"
            alt=""
            className="edge-fade h-[190px] w-[190px] rounded-2xl object-cover"
          />
        </div>
      </Html>
    </group>
  )
}

/** All the site content, living inside the 3D tunnel on the curve centreline. */
export function TunnelContent() {
  return (
    <>
      {BEATS.map((b) => (
        <Beat3D key={b.key} beat={b} />
      ))}
      <HubFloater />
    </>
  )
}
