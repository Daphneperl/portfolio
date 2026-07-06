import { Suspense, useRef, type ReactNode } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Noise, Vignette, Bloom } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { CameraRig } from './CameraRig'
import { Tunnel } from './Tunnel'
import { TunnelContent } from './TunnelContent'
import { scrollState } from '../lib/scroll'
import { pointAt } from './curve'
import { BEATS } from '../ui/WorldContent'

const FOG_COLOR = '#0f2b18' // forest-green haze so distance blends into the void

/**
 * Everything inside the <Canvas>. Dark junk_is backdrop, glowing grid tunnel,
 * grain + vignette + bloom for the analogue-but-polished look.
 */
export function Scene() {
  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 140, 780]} />

      <Suspense fallback={null}>
        <Background />
        <MobileRecenter>
          <Tunnel />
          <TunnelContent />
        </MobileRecenter>
      </Suspense>

      <CameraRig />

      <EffectComposer>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.3}
          radius={0.5}
          mipmapBlur
        />
        <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.8} />
        <Vignette eskil={false} offset={0.25} darkness={0.9} />
      </EffectComposer>
    </>
  )
}

/**
 * Fixed background image at ~50% strength over the dark scene. `backgroundIntensity`
 * halves the texture so it reads as a dimmed layer on the dark base; it fills the
 * screen and doesn't move with scroll, so it's consistent the whole way through.
 */
function Background() {
  const tex = useTexture('/textures/Background.png')
  const { scene } = useThree()
  tex.colorSpace = THREE.SRGBColorSpace
  scene.background = tex
  // Dimmed hard during the CRT pivot so it wouldn't fight the grid + accent;
  // brought back up a bit — still reads as a culture behind the void, not a
  // loud field, but more visible than before.
  scene.backgroundIntensity = 0.28
  return null
}

const MOBILE_BREAKPOINT = 640
const _nearestPos = new THREE.Vector3()
const _viewSpace = new THREE.Vector3()
const _right = new THREE.Vector3()
const _target = new THREE.Vector3()

/** The beat anchor with the smallest wrapped forward distance from `t`. */
function nearestUpcomingBeatA(t: number): number {
  let best = BEATS[0]?.a ?? 0
  let bestDist = Infinity
  for (const b of BEATS) {
    let d = b.a - t
    if (d < 0) d += 1
    if (d < bestDist) {
      bestDist = d
      best = b.a
    }
  }
  return best
}

/**
 * Mobile only: rigidly shifts the WHOLE tunnel (grid + all content, as one
 * group) so the nearest upcoming beat is dead-centre on screen. The tunnel
 * curves, so content centred independently of the grid (which keeps curving
 * off toward its own vanishing direction) breaks the "exiting the tunnel"
 * illusion — shifting them together keeps the grid's vanishing point and the
 * content it frames always visually consistent. Desktop's established
 * behaviour (content converges naturally, not forced to dead-centre) is
 * untouched — the shift eases to zero above the breakpoint.
 */
function MobileRecenter({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ camera, size }) => {
    const grp = groupRef.current
    if (!grp) return

    if (size.width < MOBILE_BREAKPOINT) {
      const a = nearestUpcomingBeatA(scrollState.progress)
      pointAt(a, _nearestPos)
      _viewSpace.copy(_nearestPos).applyMatrix4(camera.matrixWorldInverse)
      _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      _target.copy(_right).multiplyScalar(-_viewSpace.x)
    } else {
      _target.set(0, 0, 0)
    }
    grp.position.lerp(_target, 0.15)
  })

  return <group ref={groupRef}>{children}</group>
}
