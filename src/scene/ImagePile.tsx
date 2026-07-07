import { useMemo, useRef } from 'react'
import { type ThreeEvent } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { detourState } from '../lib/scroll'
import { PILE_CENTER } from './curve'

// Every scanned sketchbook page (public/items/sketchbook), each with its own
// real width/height ratio so it doesn't stretch/crop lying in the pile.
const SKETCH_FILES = Array.from({ length: 21 }, (_, i) => `sketch-${String(i + 1).padStart(2, '0')}.jpg`)
const SKETCH_ASPECT: Record<string, number> = {
  'sketch-01.jpg': 0.52,
  'sketch-02.jpg': 1.0,
  'sketch-03.jpg': 0.9783,
  'sketch-04.jpg': 0.8,
  'sketch-05.jpg': 0.7124,
  'sketch-06.jpg': 0.687,
  'sketch-07.jpg': 0.697,
  'sketch-08.jpg': 0.75,
  'sketch-09.jpg': 0.6937,
  'sketch-10.jpg': 0.6895,
  'sketch-11.jpg': 1.093,
  'sketch-12.jpg': 0.9701,
  'sketch-13.jpg': 1.0,
  'sketch-14.jpg': 0.9989,
  'sketch-15.jpg': 1.1707,
  'sketch-16.jpg': 0.7254,
  'sketch-17.jpg': 1.0,
  'sketch-18.jpg': 1.0729,
  'sketch-19.jpg': 0.975,
  'sketch-20.jpg': 0.7059,
  'sketch-21.jpg': 0.9787,
}

const PILE_SCATTER_RADIUS = 85 // how far from centre pages can land, in world units
const PILE_BASE_SIZE = 68 // long-edge size of a page, world units
const PILE_LIFT = 3 // extra height a page pops to once you've picked it up

interface PlacedSketch {
  file: string
  aspect: number
  x: number
  z: number
  y: number
  quaternion: THREE.Quaternion
  size: number
}

// Scratch objects for the quaternion composition below — module-scoped so
// placeSketches() (called once, memoized) doesn't allocate per-call either.
const _axisX = new THREE.Vector3(1, 0, 0)
const _axisY = new THREE.Vector3(0, 1, 0)
const _axisZ = new THREE.Vector3(0, 0, 1)
const _qFlatten = new THREE.Quaternion()
const _qSpin = new THREE.Quaternion()
const _qJitter = new THREE.Quaternion()

/** Deterministic-but-scattered placement — varies by index, not Math.random,
 * so the pile looks the same every visit rather than reshuffling on remount.
 *
 * Orientation is built as an explicit quaternion, not a plain [x,y,z] Euler,
 * and the ORDER matters: flatten first (inner), spin second (outer). Flatten
 * lays the plane down around the fixed world-X axis while it still faces its
 * original default direction, which is the only orientation that axis
 * actually tips flat. Spinning around world-Y first (before flattening) turns
 * the plane to face some other compass direction — then the SAME fixed-X
 * flatten no longer lies along that plane's own tipping axis, so instead of
 * lying down it stands back up facing a new direction, which is what a first
 * attempt at this (spin-then-flatten) produced: pages standing upright in a
 * dramatic fan instead of scattered flat on the "table". Flatten-then-spin
 * lies each one down correctly first, then just rotates it in place. */
function placeSketches(): PlacedSketch[] {
  return SKETCH_FILES.map((file, i) => {
    const angle = i * 2.399963 // golden-angle spread, same trick as FloatingItems
    const r = PILE_SCATTER_RADIUS * (0.15 + ((i * 53) % 100) / 120)
    const rotY = (i * 2.399963 + ((i * 17) % 10) * 0.3) % (Math.PI * 2)
    const tiltX = (((i * 13) % 10) / 10 - 0.5) * 0.18
    const tiltZ = (((i * 29) % 10) / 10 - 0.5) * 0.18

    _qSpin.setFromAxisAngle(_axisY, rotY)
    _qFlatten.setFromAxisAngle(_axisX, -Math.PI / 2 + tiltX)
    _qJitter.setFromAxisAngle(_axisZ, tiltZ)
    // Apply order (rightmost/innermost first): flatten, then spin, then jitter.
    const quaternion = _qJitter.clone().multiply(_qSpin).multiply(_qFlatten)

    return {
      file,
      aspect: SKETCH_ASPECT[file] ?? 1,
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      y: i * 0.55 + ((i * 31) % 10) * 0.12, // gentle stacking order + jitter
      quaternion,
      size: PILE_BASE_SIZE * (0.85 + ((i * 19) % 10) / 30),
    }
  })
}

/** One draggable sketchbook page lying in the pile. Real 3D depth/tilt (no
 * billboarding) — a fixed plane you can slide around a horizontal drag-plane
 * at its own current height, same "sliding a photo on a table" feel. Only
 * draggable once the pile is actually the parked detour (mirrors the papers
 * carousel's focusState-gated drag), so it can't be grabbed by a stray click
 * while still flying toward it. */
function SketchPage({ tex, s }: { tex: THREE.Texture; s: PlacedSketch }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const draggingRef = useRef(false)
  const dragPlane = useRef(new THREE.Plane())
  const dragOffset = useRef(new THREE.Vector3())
  const hitPoint = useRef(new THREE.Vector3())

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!detourState.active) return
    e.stopPropagation()
    const mesh = meshRef.current
    if (!mesh) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    draggingRef.current = true
    dragPlane.current.set(new THREE.Vector3(0, 1, 0), -mesh.position.y)
    if (e.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
      dragOffset.current.copy(mesh.position).sub(hitPoint.current)
    }
    mesh.position.y = PILE_LIFT // pop above the rest of the pile while it's "picked up"
  }
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    const mesh = meshRef.current
    if (!mesh) return
    if (e.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
      mesh.position.x = hitPoint.current.x + dragOffset.current.x
      mesh.position.z = hitPoint.current.z + dragOffset.current.z
    }
  }
  const onPointerUp = () => {
    draggingRef.current = false
  }

  return (
    <mesh
      ref={meshRef}
      position={[s.x, s.y, s.z]}
      quaternion={s.quaternion}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerOut={onPointerUp}
    >
      <planeGeometry args={[s.size * s.aspect, s.size]} />
      <meshBasicMaterial map={tex} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** The sketchbook page pile, scattered at the loop's centre (PILE_CENTER) —
 * an off-curve location reached via the "detour" camera state, triggered by
 * clicking the hub banner's floater photo (see WorldContent.tsx). Real 3D
 * planes, not billboarded, each independently draggable once parked here. */
export function ImagePile() {
  const textures = useTexture(SKETCH_FILES.map((f) => `/items/sketchbook/${f}`))
  const placed = useMemo(placeSketches, [])

  return (
    <group position={PILE_CENTER}>
      {placed.map((s, i) => (
        <SketchPage key={s.file} tex={textures[i] as THREE.Texture} s={s} />
      ))}
    </group>
  )
}
