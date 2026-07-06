import { useEffect } from 'react'
import Lenis from 'lenis'

/**
 * Global scroll state. `progress` is 0..1 across the whole journey.
 * The 3D scene reads this every frame; React UI can subscribe too.
 */
export const scrollState = {
  progress: 0,
  velocity: 0,
  // Screen-space vanishing point of the tunnel (NDC, -1..1; 0,0 = centre).
  // Written each frame by the scene; the HTML overlay reads it so deep elements
  // sit where the tunnel actually recedes instead of at screen centre.
  vpx: 0,
  vpy: 0,
}

let lenis: Lenis | null = null

/** Jump to a global progress (0..1) THROUGH Lenis, so it doesn't fight native scroll. */
export function scrollToProgress(p: number, duration = 1.6) {
  if (!lenis) return
  lenis.scrollTo(Math.max(0, Math.min(1, p)) * lenis.limit, { duration })
}

/** Mount once at the app root. Drives buttery smooth scroll via Lenis. */
export function useLenis() {
  useEffect(() => {
    lenis = new Lenis({
      lerp: 0.08, // lower = smoother/heavier inertia. THIS is the feel the original lacked.
      wheelMultiplier: 1,
      smoothWheel: true,
      infinite: true, // scroll never ends — it wraps around the loop
    })

    lenis.on('scroll', (e: Lenis) => {
      const max = e.limit || 1
      // wrap into [0,1); the tunnel is a closed loop so this is seamless
      let p = e.scroll / max
      p = ((p % 1) + 1) % 1
      scrollState.progress = p
      scrollState.velocity = e.velocity
    })

    let raf = 0
    const loop = (time: number) => {
      lenis?.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis?.destroy()
      lenis = null
    }
  }, [])
}
