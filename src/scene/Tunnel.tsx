import { useMemo } from 'react'
import * as THREE from 'three'
import { tunnelCurve, TUNNEL_RADIUS } from './curve'

// old-computer phosphor green — hot enough (toneMapped off) to blow out into bloom
const PHOSPHOR = '#9dff66'

// grid always sits at this low, "in-the-zone" opacity — no brightening at transitions
const MERIDIAN_OPACITY = 0.16
const RING_OPACITY = 0.1

// Grid resolution
const LENGTH_SEGMENTS = 520 // stations along the spine
const RADIAL = 32 // points around the ring
const RING_EVERY = 5 // draw a full ring every N stations

/**
 * Wireframe grid tunnel (as in the intimacy view): meridian lines running the
 * length of the tube + circular rings around it, swept along the curve with
 * Frenet frames. Glowing lines fade into the dark via fog + bloom.
 */
export function Tunnel() {
  const { meridians, rings } = useMemo(() => {
    const frames = tunnelCurve.computeFrenetFrames(LENGTH_SEGMENTS, true) // closed: seamless seam
    const centers: THREE.Vector3[] = []
    for (let i = 0; i <= LENGTH_SEGMENTS; i++) {
      centers.push(tunnelCurve.getPointAt(i / LENGTH_SEGMENTS))
    }

    const ringPoint = (i: number, j: number, out = new THREE.Vector3()) => {
      const a = (j / RADIAL) * Math.PI * 2
      const n = frames.normals[Math.min(i, frames.normals.length - 1)]
      const b = frames.binormals[Math.min(i, frames.binormals.length - 1)]
      return out
        .copy(centers[i])
        .addScaledVector(n, Math.cos(a) * TUNNEL_RADIUS)
        .addScaledVector(b, Math.sin(a) * TUNNEL_RADIUS)
    }

    // Meridians: for each radial slot, a line following the whole length.
    const meridianPts: number[] = []
    for (let j = 0; j < RADIAL; j++) {
      for (let i = 0; i < LENGTH_SEGMENTS; i++) {
        const p1 = ringPoint(i, j)
        const p2 = ringPoint(i + 1, j)
        meridianPts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      }
    }

    // Rings: a closed loop around the tube every RING_EVERY stations.
    const ringPts: number[] = []
    for (let i = 0; i <= LENGTH_SEGMENTS; i += RING_EVERY) {
      for (let j = 0; j < RADIAL; j++) {
        const p1 = ringPoint(i, j)
        const p2 = ringPoint(i, (j + 1) % RADIAL)
        ringPts.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
      }
    }

    const mGeo = new THREE.BufferGeometry()
    mGeo.setAttribute('position', new THREE.Float32BufferAttribute(meridianPts, 3))
    const rGeo = new THREE.BufferGeometry()
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(ringPts, 3))
    return { meridians: mGeo, rings: rGeo }
  }, [])

  return (
    <group>
      {/* longitudinal lines — glowing phosphor green, lead the eye forward */}
      <lineSegments geometry={meridians}>
        <lineBasicMaterial color={PHOSPHOR} transparent opacity={MERIDIAN_OPACITY} toneMapped={false} fog />
      </lineSegments>
      {/* circular ribs — dimmer structural rhythm */}
      <lineSegments geometry={rings}>
        <lineBasicMaterial color={PHOSPHOR} transparent opacity={RING_OPACITY} toneMapped={false} fog />
      </lineSegments>
    </group>
  )
}
