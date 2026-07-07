import { useMemo, useRef } from 'react'
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
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
const PILE_MAX_ROLL = (10 * Math.PI) / 180 // "crooked, but only 10deg either way"

interface PlacedSketch {
  file: string
  aspect: number
  x: number
  z: number
  y: number
  roll: number
  size: number
}

/** Deterministic-but-scattered placement — varies by index, not Math.random,
 * so the pile looks the same every visit rather than reshuffling on remount. */
function placeSketches(): PlacedSketch[] {
  return SKETCH_FILES.map((file, i) => {
    const angle = i * 2.399963 // golden-angle spread, same trick as FloatingItems
    const r = PILE_SCATTER_RADIUS * (0.15 + ((i * 53) % 100) / 120)
    return {
      file,
      aspect: SKETCH_ASPECT[file] ?? 1,
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      y: i * 0.55 + ((i * 31) % 10) * 0.12, // gentle stacking order + jitter
      roll: (((i * 13) % 10) / 10 - 0.5) * 2 * PILE_MAX_ROLL,
      size: PILE_BASE_SIZE * (0.85 + ((i * 19) % 10) / 30),
    }
  })
}

/** One draggable sketchbook page in the pile — always facing the camera dead
 * on (drei's Billboard) like a regular flat image, just held slightly
 * crooked (+/-10deg roll around the view axis). Real independent world
 * positions still give the pile genuine depth/parallax as the camera flies
 * in; only the ORIENTATION is locked to face you, not the position. Dragging
 * slides it around a plane parallel to the camera at its own current depth —
 * matches how it looks (a flat photo held up in front of you), not the
 * world-horizontal "table" a lying-flat version would use. Only draggable
 * once the pile is actually the parked detour (mirrors the papers carousel's
 * focusState-gated drag), so it can't be grabbed by a stray click while
 * still flying toward it. */
function SketchPage({ tex, s }: { tex: THREE.Texture; s: PlacedSketch }) {
  const { camera } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const draggingRef = useRef(false)
  const dragPlane = useRef(new THREE.Plane())
  const dragOffset = useRef(new THREE.Vector3())
  const hitPoint = useRef(new THREE.Vector3())
  const camForward = useRef(new THREE.Vector3())

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!detourState.active) return
    e.stopPropagation()
    const group = groupRef.current
    if (!group) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    draggingRef.current = true
    camera.getWorldDirection(camForward.current)
    dragPlane.current.setFromNormalAndCoplanarPoint(camForward.current, group.position)
    if (e.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
      dragOffset.current.copy(group.position).sub(hitPoint.current)
    }
    group.position.y += PILE_LIFT // pop above the rest of the pile while it's "picked up"
  }
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return
    const group = groupRef.current
    if (!group) return
    if (e.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
      group.position.copy(hitPoint.current).add(dragOffset.current)
    }
  }
  const onPointerUp = () => {
    draggingRef.current = false
  }

  return (
    <group ref={groupRef} position={[s.x, s.y, s.z]}>
      <Billboard>
        <mesh
          rotation={[0, 0, s.roll]}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerOut={onPointerUp}
        >
          <planeGeometry args={[s.size * s.aspect, s.size]} />
          <meshBasicMaterial map={tex} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  )
}

/** The sketchbook page pile, scattered at the loop's centre (PILE_CENTER) —
 * an off-curve location reached via the "detour" camera state, triggered by
 * clicking the hub banner's floater photo (see WorldContent.tsx). Each page
 * keeps its own real 3D position (so the pile has genuine depth/parallax)
 * but always faces the camera dead-on, independently draggable. */
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
