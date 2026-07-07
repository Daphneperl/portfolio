import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { focusState, scrollState } from '../lib/scroll'
import { pointAt, tangentAt } from './curve'

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const _pos = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _look = new THREE.Vector3()
const _right = new THREE.Vector3()
const _focusPos = new THREE.Vector3()
// Tracks the TRUE unshifted eased position across frames. camera.position
// itself must NOT be used as the lerp base once we start adding the mobile
// shift to it — otherwise the shift feeds back into next frame's lerp start
// point and compounds every frame (verified: it amplifies to ~8x the
// intended offset within a few frames, sending the camera way off the
// tunnel's centreline). Easing happens on this separate vector; the shift is
// applied only to the final camera.position, fresh, every frame.
const _easedPos = new THREE.Vector3()
let _lastFocusA: number | null = null
let _focusArrived = false

// Mobile only: nudge the camera itself sideways (along its OWN right vector,
// after orientation is set — a pure parallax shift, not a re-aim). Content
// was reading as shifted right of screen-centre on narrow portrait screens;
// moving the eye point right shifts the whole view left, pulling it back
// toward centre. A small FIXED constant — unlike the earlier per-beat /
// whole-tunnel approaches, this can't blow up into a large, scene-breaking
// shift regardless of scroll position, since it never depends on distance
// to any particular piece of content. Desktop is completely untouched.
const MOBILE_BREAKPOINT = 640
const MOBILE_CAMERA_SHIFT = 11.7

// A click-focused beat (see WorldContent's handleBeatClick) can sit anywhere
// from a modest to a fairly large backoff off its own curve anchor — banners
// back off 160 world units, project windows 320 — and because the tunnel
// curves, tangent-only look drifts further off-centre the bigger that backoff
// is. So once the camera is this close to the focused beat's real position,
// blend the look target toward it directly (an exact aim, dead-centre on any
// screen regardless of aspect); beyond FOCUS_CLEAR_DIST, drop focus entirely.
const FOCUS_BLEND_FAR = 700
const FOCUS_BLEND_NEAR = 280
const FOCUS_CLEAR_DIST = 900

/**
 * Camera travel driven directly by scroll progress. Position eases toward the
 * point on the curve (smooth), orientation looks straight down the forward
 * tangent with NO slerp — so it can't drift out of sync with position. Result:
 * scrolling down dollies forward, scrolling up dollies backward, no turning.
 * Movement through space happens only from scrolling.
 */
export function CameraRig() {
  const { camera, size } = useThree()

  useFrame(() => {
    const t = scrollState.progress

    pointAt(t, _pos)
    tangentAt(t, _tan) // forward direction along the ring (always +t), stays continuous

    // Ease the TRUE (unshifted) position toward the target on the curve.
    _easedPos.lerp(_pos, 0.12)
    camera.position.copy(_easedPos)

    // Face the forward tangent, measured from where the camera ACTUALLY is — not
    // the (lagging) target point. This keeps the facing locked to the ring's
    // forward direction, so reversing scroll just dollies backward: no flip.
    _look.copy(camera.position).add(_tan)

    // Blend the look target toward a click-focused beat's exact position as we
    // approach it — an exact aim always lands the target dead-centre, on any
    // screen, unlike tangent-only look (which drifts as the curve bends).
    // A fresh focus target starts far away (the camera hasn't eased there
    // yet) — only treat "too far" as "scrolled away and released" AFTER we've
    // actually arrived once; otherwise the very first frame post-click (still
    // far from the target) would immediately clear the focus we just set.
    if (focusState.a !== _lastFocusA) {
      _lastFocusA = focusState.a
      _focusArrived = false
    }

    let focusBlend = 0
    if (focusState.a !== null) {
      pointAt(focusState.a, _focusPos)
      const d = camera.position.distanceTo(_focusPos)
      const proximity = smoothstep(FOCUS_BLEND_FAR, FOCUS_BLEND_NEAR, d)
      if (proximity > 0.5) _focusArrived = true
      if (_focusArrived && d > FOCUS_CLEAR_DIST) {
        focusState.a = null // arrived once, now scrolled away — release focus
        _lastFocusA = null
        _focusArrived = false
      } else {
        focusBlend = proximity
        if (focusBlend > 0) _look.lerp(_focusPos, focusBlend)
      }
    }

    camera.up.set(0, 1, 0)
    camera.lookAt(_look)

    if (size.width < MOBILE_BREAKPOINT) {
      camera.updateMatrixWorld(true) // matrixWorld must reflect the lookAt just above
      _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      // Applied only to the render-facing position, never to _easedPos —
      // next frame starts fresh from _easedPos, so this can't compound. Faded
      // out by focusBlend: once we're aiming exactly at a focused beat, this
      // parallax nudge (tuned for the tangent-only case) would just push the
      // already-centred target back off-centre.
      camera.position.addScaledVector(_right, MOBILE_CAMERA_SHIFT * (1 - focusBlend))
    }
  })

  return null
}
