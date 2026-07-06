import { Suspense } from 'react'
import { useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Noise, Vignette, Bloom } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { CameraRig } from './CameraRig'
import { Tunnel } from './Tunnel'
import { TunnelContent } from './TunnelContent'

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
        <Tunnel />
        <TunnelContent />
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
  scene.backgroundIntensity = 0.5
  return null
}
