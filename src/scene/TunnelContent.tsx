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
const _viewSpace = new THREE.Vector3()
const _right = new THREE.Vector3()
const _corrected = new THREE.Vector3()

// Below this canvas width, actively cancel a beat's lateral (left/right) drift
// from screen-centre every frame (see the useFrame below). The tunnel curves,
// so a beat further along it is naturally a little off the camera's exact
// viewing axis — desktop's WIDE aspect ratio makes that a small fraction of
// screen width (barely visible, and it's part of the intended "converges as
// you approach" feel). A narrow PORTRAIT phone screen makes the same offset a
// much bigger fraction of the width, reading as "not centered." Scoped to
// mobile only so desktop's established behaviour is untouched.
const MOBILE_BREAKPOINT = 640

function Beat3D({ beat }: { beat: Beat }) {
  const pos = useMemo(() => pointAt(beat.a), [beat.a])
  const ref = useRef<HTMLDivElement>(null)
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ camera, size }) => {
    const el = ref.current
    const grp = groupRef.current
    if (!el || !grp) return

    if (size.width < MOBILE_BREAKPOINT) {
      // cancel the anchor's view-space X (its lateral offset from the
      // camera's straight-ahead axis) so it always projects to screen-centre
      _viewSpace.copy(pos).applyMatrix4(camera.matrixWorldInverse)
      _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      _corrected.copy(pos).addScaledVector(_right, -_viewSpace.x)
      grp.position.copy(_corrected)
    } else {
      grp.position.copy(pos)
    }

    const d = camera.position.distanceTo(grp.position)
    // hide anything behind the camera (already flew past)
    _to.copy(grp.position).sub(camera.position)
    camera.getWorldDirection(_fwd)
    const behind = _to.dot(_fwd) < 0
    // emerge from the fog (far) and blow past the camera (near); no abrupt UI fade
    const o = behind ? 0 : Math.min(smoothstep(FADE_FAR, FADE_MID, d), smoothstep(NEAR_LO, NEAR_HI, d))
    // opacity cascades to every descendant (including a beat's floater, if any)
    // automatically — it's one CSS property on the shared wrapper, not per-child.
    el.style.opacity = o.toFixed(3)
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible'
  })

  return (
    <group ref={groupRef} position={pos}>
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
