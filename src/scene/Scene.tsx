import { Suspense, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { EffectComposer, Noise, Vignette, Bloom } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { detourState } from '../lib/scroll'
import { CameraRig } from './CameraRig'
import { ImagePile } from './ImagePile'
import { Tunnel } from './Tunnel'
import { TunnelContent } from './TunnelContent'

const FOG_COLOR = '#0f2b18' // forest-green haze so distance blends into the void

/**
 * Everything inside the <Canvas>. Dark junk_is backdrop, glowing grid tunnel,
 * grain + vignette + bloom for the analogue-but-polished look.
 */
export function Scene() {
  // Bloom/Noise/Vignette all run on the whole rendered WebGL frame — unlike
  // every other image on the site (DOM overlays sitting outside the canvas,
  // untouched by any of this), the sketchbook pile is real geometry IN that
  // frame, so it's the one place that actually shows grain, highlight bloom-
  // bleed, and edge-darkening. Since the pile is the only thing on screen
  // while parked there anyway, fading all three out for that view costs
  // nothing elsewhere and reads as a clean, accurately-colored photo.
  const [inPile, setInPile] = useState(detourState.active)
  useFrame(() => {
    if (detourState.active !== inPile) setInPile(detourState.active)
  })

  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 140, 780]} />

      <Suspense fallback={null}>
        <Background />
        <Tunnel />
        <TunnelContent />
        <ImagePile />
      </Suspense>

      <CameraRig />

      <EffectComposer>
        <Bloom
          intensity={inPile ? 0 : 1.2}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.3}
          radius={0.5}
          mipmapBlur
        />
        <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={inPile ? 0 : 0.8} />
        <Vignette eskil={false} offset={0.25} darkness={inPile ? 0 : 0.9} />
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
