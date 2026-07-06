import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { frenet, tunnelCurve, TUNNEL_RADIUS } from './curve'

const ITEM_URLS = [
  '/items/Coffee.png',
  '/items/Moon2.png',
  '/items/Sun.png',
  '/items/Wine.png',
  '/items/Pasta.png',
  '/items/OpenHand.png',
  '/items/ClosedHand.png',
]

const COUNT = 34

interface Placed {
  pos: THREE.Vector3
  scale: number
  seed: number
  speed: number
  amp: number
  phase: number
  tex: number
}

/**
 * Objects from the junk_is world scattered along the tube, billboarded to the
 * camera, drifting with layered-sine jitter so they feel alive / analogue.
 */
export function FloatingItems() {
  const textures = useTexture(ITEM_URLS)

  const placed = useMemo<Placed[]>(() => {
    // deterministic-ish scatter (varies by index, not Math.random at module load)
    const items: Placed[] = []
    for (let i = 0; i < COUNT; i++) {
      const t = (i + 0.5) / COUNT
      const fi = Math.min(frenet.normals.length - 1, Math.floor(t * (frenet.normals.length - 1)))
      const center = tunnelCurve.getPointAt(t)
      const normal = frenet.normals[fi]
      const binormal = frenet.binormals[fi]
      const angle = i * 2.399963 // golden-angle spread around the tube
      const r = TUNNEL_RADIUS * (0.45 + ((i * 37) % 40) / 100)
      const pos = center
        .clone()
        .add(normal.clone().multiplyScalar(Math.cos(angle) * r))
        .add(binormal.clone().multiplyScalar(Math.sin(angle) * r))
      items.push({
        pos,
        scale: 10 + ((i * 13) % 12),
        seed: (i * 97.13) % 1000,
        speed: 0.4 + ((i * 7) % 20) / 10,
        amp: 2 + ((i * 5) % 30) / 10,
        phase: (i * 1.7) % (Math.PI * 2),
        tex: i % ITEM_URLS.length,
      })
    }
    return items
  }, [])

  const groupRefs = useRef<(THREE.Group | null)[]>([])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < placed.length; i++) {
      const g = groupRefs.current[i]
      if (!g) continue
      const p = placed[i]
      const jx =
        Math.sin(t * p.speed + p.phase) * p.amp * 0.3 +
        Math.sin(t * p.speed * 0.7 + p.seed) * p.amp * 0.2
      const jy =
        Math.cos(t * p.speed * 0.8 + p.phase) * p.amp * 0.3 +
        Math.sin(t * p.speed * 0.3 + p.seed) * p.amp * 0.15
      g.position.set(p.pos.x + jx, p.pos.y + jy, p.pos.z)
    }
  })

  return (
    <group>
      {placed.map((p, i) => {
        const tex = textures[p.tex] as THREE.Texture
        const img = tex.image as { width: number; height: number } | undefined
        const aspect = img ? img.width / img.height : 1
        return (
          <group key={i} ref={(el) => (groupRefs.current[i] = el)} position={p.pos}>
            <Billboard>
              <mesh scale={[p.scale * aspect, p.scale, 1]}>
                <planeGeometry />
                <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
              </mesh>
            </Billboard>
          </group>
        )
      })}
    </group>
  )
}
