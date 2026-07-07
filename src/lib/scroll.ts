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

// Set when a beat is click-focused (see WorldContent's handleBeatClick), holding
// that beat's own curve anchor `a`. TunnelContent's Beat3D reads this to nudge
// ONLY that beat's own displayed position (never the camera) exactly onto the
// camera's forward axis once close enough — cosmetic, per-beat, so it can't
// affect the camera orientation that visibility elsewhere depends on. Cleared
// once scrolled away.
export const focusState = { a: null as number | null }

// Set when the user has clicked into the sketchbook image pile parked at the
// loop's centre (an off-curve location — see scene/curve.ts's PILE_CENTER),
// entirely independent of scrollState.progress. CameraRig checks this before
// its normal pointAt/tangentAt drive and parks/looks at the pile instead;
// ImagePile gates drag interactivity on it, same "only interactive once
// you've actually arrived" rule the papers carousel uses via focusState.
// Lenis keeps running in the background the whole time (scrollState.progress
// keeps updating) so exiting just resumes the normal curve-follow from
// wherever that now is — no separate "saved position" to restore.
export const detourState = { active: false }
export function enterPileDetour() {
  detourState.active = true
}
export function exitPileDetour() {
  detourState.active = false
}

let lenis: Lenis | null = null

/** Jump to a global progress (0..1) THROUGH Lenis, so it doesn't fight native scroll. */
export function scrollToProgress(p: number, duration = 1.6) {
  if (!lenis) return
  lenis.scrollTo(Math.max(0, Math.min(1, p)) * lenis.limit, { duration })
}

/** Mount once at the app root. Drives buttery smooth scroll via Lenis.
 * `initialProgress`, if given, teleports the scroll there immediately (no
 * animation) before the first frame renders — used to open the site already
 * framed on the hub banner instead of at the raw t=0 start of the curve. */
export function useLenis(initialProgress = 0) {
  useEffect(() => {
    lenis = new Lenis({
      lerp: 0.08, // lower = smoother/heavier inertia. THIS is the feel the original lacked.
      wheelMultiplier: -1, // flip scroll direction: scroll down = travel forward through the tunnel
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

    if (initialProgress > 0) {
      lenis.scrollTo(initialProgress * lenis.limit, { immediate: true })
      scrollState.progress = initialProgress // don't wait on the scroll event to reflect it
    }

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
