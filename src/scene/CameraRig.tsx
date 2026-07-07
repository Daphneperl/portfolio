import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { detourState, scrollState } from '../lib/scroll'
import { PILE_CAMERA_POS, PILE_CENTER, pointAt, tangentAt } from './curve'

const _pos = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _look = new THREE.Vector3()
const _right = new THREE.Vector3()
// Tracks the TRUE unshifted eased position across frames. camera.position
// itself must NOT be used as the lerp base once we start adding the mobile
// shift to it — otherwise the shift feeds back into next frame's lerp start
// point and compounds every frame (verified: it amplifies to ~8x the
// intended offset within a few frames, sending the camera way off the
// tunnel's centreline). Easing happens on this separate vector; the shift is
// applied only to the final camera.position, fresh, every frame.
const _easedPos = new THREE.Vector3()

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

// NOTE: a "focus mode" experiment once lived here — blending the look target
// toward a click-focused beat's exact position as the camera approached, to
// perfectly centre it regardless of curve bending. Reverted: it overrode the
// camera's actual orientation, which TunnelContent's "is this beat behind me
// yet" check also reads (via camera.getWorldDirection) to decide visibility —
// so a stale focus target skewed that forward reference and made already-
// passed beats fade back in. Focus-centering now lives in TunnelContent
// instead, nudging only the focused beat's own displayed position — the
// camera's orientation here is never touched by it.

/**
 * Camera travel driven directly by scroll progress. Position eases toward the
 * point on the curve (smooth), orientation looks straight down the forward
 * tangent with NO slerp — so it can't drift out of sync with position. Result:
 * scrolling down dollies forward, scrolling up dollies backward, no turning.
 * Movement through space happens only from scrolling.
 */
export function CameraRig() {
  const { camera, size } = useThree()

  // Priority -1: must run BEFORE TunnelContent's per-beat useFrame callbacks
  // (default priority 0, and it mounts after this in Scene.tsx anyway) so
  // camera.matrixWorld is already fresh for this frame when Beat3D reads it
  // for its focus-centering correction — otherwise it'd read last frame's.
  useFrame(() => {
    // Detour: parked at the sketchbook pile (see lib/scroll.ts's detourState),
    // completely off the curve. Reuses _easedPos as the SAME persistent lerp
    // base the normal path uses below — so entering eases smoothly from
    // wherever the camera currently is, and exiting (detourState.active back
    // to false) resumes the normal path's lerp from the pile position toward
    // pointAt(scrollState.progress), i.e. a matching "fly back out" for free,
    // no separate saved-position state needed.
    if (detourState.active) {
      _easedPos.lerp(PILE_CAMERA_POS, 0.06)
      camera.position.copy(_easedPos)
      camera.up.set(0, 1, 0)
      camera.lookAt(PILE_CENTER)
      camera.updateMatrixWorld(true)
      return
    }

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
    camera.up.set(0, 1, 0)
    camera.lookAt(_look)

    if (size.width < MOBILE_BREAKPOINT) {
      camera.updateMatrixWorld(true) // matrixWorld must reflect the lookAt just above
      _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
      // Applied only to the render-facing position, never to _easedPos —
      // next frame starts fresh from _easedPos, so this can't compound.
      camera.position.addScaledVector(_right, MOBILE_CAMERA_SHIFT)
    } else {
      camera.updateMatrixWorld(true) // keep matrixWorld fresh on desktop too, for the same reason
    }
  }, -1)

  return null
}
