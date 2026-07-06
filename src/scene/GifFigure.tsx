import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { tunnelCurve } from './curve'

const FRAMES = [
  '/gif/Daph2_1.png',
  '/gif/Daph2_2.png',
  '/gif/Daph2_3.png',
  '/gif/Daph2_4.png',
  '/gif/Daph2_5.png',
  '/gif/Daph2_6.png',
  '/gif/Daph2_7.png',
  '/gif/Daph2_8.png',
]

const FPS = 10 // frame swap rate — like a hand-animated gif
const HEIGHT = 70 // world units tall
const HUB_T = 0.06 // where in the "who I am" stretch to place her

/**
 * Plays the Daph2 frame sequence as a looping gif inside the hub ("who I am")
 * area: a billboarded plane whose texture cycles through the frames each tick.
 */
export function GifFigure() {
  const textures = useTexture(FRAMES) as THREE.Texture[]
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const frame = useRef(0)
  const acc = useRef(0)

  const { position, aspect } = useMemo(() => {
    const p = tunnelCurve.getPointAt(HUB_T)
    const img = textures[0].image as { width: number; height: number } | undefined
    return { position: p, aspect: img ? img.width / img.height : 0.4 }
  }, [textures])

  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current >= 1 / FPS) {
      acc.current = 0
      frame.current = (frame.current + 1) % textures.length
      if (matRef.current) {
        matRef.current.map = textures[frame.current]
        matRef.current.needsUpdate = true
      }
    }
  })

  return (
    <group position={position}>
      <Billboard>
        <mesh scale={[HEIGHT * aspect, HEIGHT, 1]}>
          <planeGeometry />
          <meshBasicMaterial
            ref={matRef}
            map={textures[0]}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </group>
  )
}
