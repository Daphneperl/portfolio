import * as THREE from 'three'

/**
 * The spine of the whole site: one CLOSED loop in space. The camera travels
 * around it as the user scrolls; because start === end, scrolling past the last
 * world (drawings) flows seamlessly back into the first (about me) — that's what
 * makes the infinite scroll have no visible seam. Worlds are ranges of t.
 */
const LOOP_POINTS = 64
const LOOP_RADIUS = 900
const LOOP_TILT = 0.28 // gentle 3D tilt so it isn't a flat disc
export const tunnelCurve = new THREE.CatmullRomCurve3(
  Array.from({ length: LOOP_POINTS }, (_, i) => {
    const a = (i / LOOP_POINTS) * Math.PI * 2
    // A clean circle: CONSTANT radius = constant curvature = perfectly smooth,
    // consistent scroll speed all the way around (no bulges, no jerk). The y
    // term is a single cycle, so the ring is just tilted in space and still
    // closes seamlessly.
    const x = Math.cos(a) * LOOP_RADIUS
    const z = Math.sin(a) * LOOP_RADIUS
    const y = Math.sin(a) * LOOP_RADIUS * LOOP_TILT
    return new THREE.Vector3(x, y, z)
  }),
  true, // closed
  'catmullrom',
  0.5,
)
// Denser arc-length table => even, glitch-free mapping of scroll -> position.
tunnelCurve.arcLengthDivisions = 2000
// Real arc length of the loop, in world units — lets other modules convert a
// world-unit distance (e.g. "land 350 units before this beat") into a t-delta.
export const CURVE_LENGTH = tunnelCurve.getLength()

export const FRENET_SEGMENTS = 400
// Precompute closed Frenet frames once — used to place walls, items, everything
// in the tube's local frame. closed=true keeps the frame continuous at the seam.
export const frenet = tunnelCurve.computeFrenetFrames(FRENET_SEGMENTS, true)

export const TUNNEL_RADIUS = 90

export type WorldId = 'hub' | 'web' | 'sci'

export interface World {
  id: WorldId
  label: string
  index: string
  /** t-range along the curve [start, end] */
  range: [number, number]
  accent: string
}

/**
 * The journey, front to back. Each world owns a stretch of the tunnel.
 * The hub bookends the ride (intro at the very start).
 */
export const WORLDS: World[] = [
  { id: 'hub', label: 'About Me', index: '00', range: [0.0, 0.14], accent: '#ece3cf' },
  { id: 'web', label: 'Web Design & Dev', index: '01', range: [0.14, 0.72], accent: '#ff9d3c' },
  { id: 'sci', label: 'Scientific Graphics', index: '02', range: [0.72, 1.0], accent: '#9dff66' },
]

/** Which world is active for a given global progress (0..1). */
export function worldAt(progress: number): World {
  return WORLDS.find((w) => progress >= w.range[0] && progress < w.range[1]) ?? WORLDS[WORLDS.length - 1]
}

/** Local 0..1 progress within the active world. */
export function localProgress(progress: number, world: World): number {
  const [a, b] = world.range
  return THREE.MathUtils.clamp((progress - a) / (b - a), 0, 1)
}

/** Point on the curve, using arc-length param for constant scroll speed. */
export function pointAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
  return tunnelCurve.getPointAt(THREE.MathUtils.clamp(t, 0, 1), target)
}

export function tangentAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
  return tunnelCurve.getTangentAt(THREE.MathUtils.clamp(t, 0, 1), target)
}
