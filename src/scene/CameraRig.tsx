import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '../lib/scroll'
import { pointAt, tangentAt } from './curve'

const _pos = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _look = new THREE.Vector3()

/**
 * Camera travel driven directly by scroll progress. Position eases toward the
 * point on the curve (smooth), orientation looks straight down the forward
 * tangent with NO slerp — so it can't drift out of sync with position. Result:
 * scrolling down dollies forward, scrolling up dollies backward, no turning.
 * Movement through space happens only from scrolling.
 */
export function CameraRig() {
  const { camera } = useThree()

  useFrame(() => {
    const t = scrollState.progress

    pointAt(t, _pos)
    tangentAt(t, _tan) // forward direction along the ring (always +t), stays continuous

    // Ease position toward the target on the curve.
    camera.position.lerp(_pos, 0.12)

    // Face the forward tangent, measured from where the camera ACTUALLY is — not
    // the (lagging) target point. This keeps the facing locked to the ring's
    // forward direction, so reversing scroll just dollies backward: no flip.
    _look.copy(camera.position).add(_tan)
    camera.up.set(0, 1, 0)
    camera.lookAt(_look)
  })

  return null
}
