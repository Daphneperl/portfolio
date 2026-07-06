import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { pointAt } from './curve'
import { BEATS, BeatContent, type Beat } from '../ui/WorldContent'

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

/** All the site content, living inside the 3D tunnel on the curve centreline. */
export function TunnelContent() {
  return (
    <>
      {BEATS.map((b) => (
        <Beat3D key={b.key} beat={b} />
      ))}
    </>
  )
}
