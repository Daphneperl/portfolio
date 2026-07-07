import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { pointAt } from './curve'
import { focusState } from '../lib/scroll'
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

// Click-focus centering: once a beat is the click-focused one (see
// WorldContent's handleBeatClick / Hud's chapter-nav jump, both set
// lib/scroll's focusState.a) and the camera is this close to it, nudge ONLY
// that beat's own displayed position exactly onto the camera's forward axis.
// This is cosmetic and per-beat — it never touches the camera itself, unlike
// an earlier attempt that overrode the camera's look direction and broke the
// "is this beat behind me yet" visibility check for every OTHER beat. Beyond
// FOCUS_CLEAR_DIST (after having arrived once), focus releases automatically.
const FOCUS_BLEND_FAR = 700
const FOCUS_BLEND_NEAR = 280
const FOCUS_CLEAR_DIST = 900

const _fwd = new THREE.Vector3()
const _to = new THREE.Vector3()
const _localPos = new THREE.Vector3()
const _right = new THREE.Vector3()
const _correctedPos = new THREE.Vector3()
let _lastFocusA: number | null = null
let _focusArrived = false

function Beat3D({ beat }: { beat: Beat }) {
  const pos = useMemo(() => pointAt(beat.a), [beat.a])
  const ref = useRef<HTMLDivElement>(null)
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ camera }) => {
    const el = ref.current
    const group = groupRef.current
    if (!el || !group) return
    const d = camera.position.distanceTo(pos)
    // hide anything behind the camera (already flew past)
    _to.copy(pos).sub(camera.position)
    camera.getWorldDirection(_fwd)
    const behind = _to.dot(_fwd) < 0
    // emerge from the fog (far) and blow past the camera (near); no abrupt UI fade
    const o = behind ? 0 : Math.min(smoothstep(FADE_FAR, FADE_MID, d), smoothstep(NEAR_LO, NEAR_HI, d))
    // opacity cascades to every descendant (including a beat's floater, if any)
    // automatically — it's one CSS property on the shared wrapper, not per-child.
    el.style.opacity = o.toFixed(3)
    el.style.visibility = o < 0.01 ? 'hidden' : 'visible'

    // Focus centering (see comment above) — isolated to this one beat's own
    // group position; group.position defaults back to the plain anchor
    // whenever this beat isn't the focused one, every frame.
    let corrected = false
    if (focusState.a === beat.a) {
      if (beat.a !== _lastFocusA) {
        _lastFocusA = beat.a
        _focusArrived = false
      }
      const proximity = smoothstep(FOCUS_BLEND_FAR, FOCUS_BLEND_NEAR, d)
      if (proximity > 0.5) _focusArrived = true
      if (_focusArrived && d > FOCUS_CLEAR_DIST) {
        focusState.a = null // arrived once, now scrolled away — release focus
        _lastFocusA = null
        _focusArrived = false
      } else if (proximity > 0) {
        // pos in camera-local space: its local X IS the lateral (screen-x)
        // offset in world units at this depth. Shifting the point by
        // -localX along the camera's own right vector zeroes that
        // component out, landing it dead-centre regardless of depth, FOV,
        // or aspect ratio — exact math, not an approximation.
        _localPos.copy(pos).applyMatrix4(camera.matrixWorldInverse)
        _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
        _correctedPos.copy(pos).addScaledVector(_right, -_localPos.x * proximity)
        group.position.copy(_correctedPos)
        corrected = true
      }
    }
    if (!corrected) group.position.copy(pos)
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
