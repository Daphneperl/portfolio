import { Canvas } from '@react-three/fiber'
import { useLenis } from './lib/scroll'
import { Scene } from './scene/Scene'
import { Hud } from './ui/Hud'
import { CursorGlow } from './ui/CursorGlow'

/**
 * The canvas is fixed and full-screen; a tall invisible track behind it gives
 * us something to scroll. Lenis drives scrollState.progress, the scene reads it.
 */
export default function App() {
  useLenis()

  return (
    <>
      {/* fixed 3D layer */}
      <div className="fixed inset-0 h-screen w-screen">
        <Canvas
          camera={{ fov: 68, near: 0.1, far: 5000, position: [0, 0, 0] }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
        >
          <Scene />
        </Canvas>
      </div>

      <Hud />
      <CursorGlow />

      {/* SVG refraction filter for the liquid glass — a smooth, low-frequency noise
          field (blurred so it has no static/grain) drives a gentle displacement of
          the backdrop, so the scene behind bends like a real glass lens (Chrome).
          Low baseFrequency = big soft waves; modest scale = subtle magnified warp. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter id="glass-refract" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.009 0.012" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2.2" result="soft" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="soft"
            scale="17"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/* scroll track — sets the length of the journey (taller = slower ride) */}
      <div style={{ height: '900vh' }} aria-hidden />
    </>
  )
}
