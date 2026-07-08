import { useMemo, useRef } from 'react'
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Billboard, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { detourState } from '../lib/scroll'
import { PILE_CENTER } from './curve'

// Every scanned sketchbook page (public/items/sketchbook), each with its own
// real width/height ratio so it doesn't stretch/crop lying in the pile.
// sketch-28, -31..-35 are "Copy Subject" cutouts (real alpha channel,
// transparent background) rather than plain flat scans — PNG instead of JPEG,
// and their material needs transparent:true or the cutout edge shows as a
// solid block instead of fading into the pile behind it.
// sketch-16, -21, -24 were removed from public/items/sketchbook, hence the
// filter — kept as a generated range + filter rather than hand-listing every
// remaining file, so re-adding a page later is still just bumping the range.
const SKETCH_FILES = [
  ...Array.from({ length: 23 }, (_, i) => `sketch-${String(i + 1).padStart(2, '0')}.jpg`),
  'sketch-24.png',
  'sketch-25.jpg',
  'sketch-26.jpg',
  'sketch-27.jpg',
  'sketch-28.png',
  'sketch-29.jpg',
  'sketch-30.jpg',
  'sketch-31.png',
  'sketch-32.png',
  'sketch-33.png',
  'sketch-34.png',
  'sketch-35.png',
].filter((f) => !['sketch-16.jpg', 'sketch-21.jpg', 'sketch-24.png'].includes(f))
const SKETCH_ASPECT: Record<string, number> = {
  'sketch-01.jpg': 1.3571,
  'sketch-02.jpg': 0.52,
  'sketch-03.jpg': 0.4331,
  'sketch-04.jpg': 1.0,
  'sketch-05.jpg': 0.9783,
  'sketch-06.jpg': 1.3311,
  'sketch-07.jpg': 1.025,
  'sketch-08.jpg': 0.8,
  'sketch-09.jpg': 0.7124,
  'sketch-10.jpg': 0.6937,
  'sketch-11.jpg': 0.697,
  'sketch-12.jpg': 0.75,
  'sketch-13.jpg': 1.0492,
  'sketch-14.jpg': 1.027,
  'sketch-15.jpg': 0.6937,
  'sketch-17.jpg': 1.093,
  'sketch-18.jpg': 0.9701,
  'sketch-19.jpg': 1.0,
  'sketch-20.jpg': 0.9989,
  'sketch-22.jpg': 1.4047,
  'sketch-23.jpg': 1.0458,
  'sketch-25.jpg': 0.975,
  'sketch-26.jpg': 1.3289,
  'sketch-27.jpg': 0.7059,
  'sketch-28.png': 0.97,
  'sketch-29.jpg': 0.9787,
  'sketch-30.jpg': 0.7238,
  'sketch-31.png': 0.9986,
  'sketch-32.png': 0.9971,
  'sketch-33.png': 0.7529,
  'sketch-34.png': 0.705,
  'sketch-35.png': 0.9907,
}

// Contact-shadow blob, shared by every page — a single blurred rounded-rect
// drawn once to a canvas, not loaded per-instance. Stretched under each page
// (via plane geometry, not the texture itself) so its feathered edge scales
// with that page's own aspect ratio, same trick .edge-fade's CSS mask uses.
// Sized/blurred to hug close to the page's own silhouette (small inset, tight
// blur) rather than a big diffuse blob — in a dense, tightly overlapping
// pile, a wide soft shadow mostly disappears under whichever page is on top
// of it; a tight rim shows as a real edge on THIS page wherever it's visible,
// stacked on the dark background or on a neighbour underneath it.
let _shadowTexture: THREE.CanvasTexture | null = null
function getShadowTexture(): THREE.CanvasTexture {
  if (_shadowTexture) return _shadowTexture
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const inset = 20
  ctx.filter = 'blur(14px)'
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.roundRect(inset, inset, size - inset * 2, size - inset * 2, 22)
  ctx.fill()
  _shadowTexture = new THREE.CanvasTexture(canvas)
  return _shadowTexture
}
const SHADOW_SCALE = 1.08 // just a touch larger than the page — a hugging rim, not a wide halo
const SHADOW_OFFSET = 3 // world units, down + right of the page — "light from top-left"

const PILE_SCATTER_RADIUS = 85 // how far from centre pages can land, in world units
const PILE_BASE_SIZE = 68 // long-edge size of a page, world units
const PILE_LIFT = 3 // extra height a page pops to once you've picked it up
const PILE_MAX_ROLL = (10 * Math.PI) / 180 // "crooked, but only 10deg either way"
const PILE_ENLARGE_SCALE = 1.9 // double-click "bring to front" size multiplier
const PILE_ENLARGE_LERP_TO_CAMERA = 0.5 // how far toward the camera it pulls, 0..1
const PILE_LERP_SPEED = 0.18 // per-frame ease toward the enlarge/restore target
const PILE_CLICK_THRESHOLD = 6 // px of pointer travel before a release counts as a drag, not a click
const DOUBLE_TAP_MS = 350 // max gap between taps/clicks to count as a double
const DOUBLE_TAP_DIST = 30 // max travel between taps to still count as "the same spot" (touch is less precise than a mouse)

interface PlacedSketch {
  file: string
  aspect: number
  alpha: boolean
  x: number
  z: number
  y: number
  roll: number
  size: number
}

/** Shuffled once per visit (Math.random(), Fisher-Yates) so which page lands
 * in which slot is different every time you open the pile — but the SLOTS
 * themselves still come from the same tuned golden-angle scatter/jitter
 * formula, keyed off the shuffled position rather than the file's fixed index,
 * so the pile's overall shape/spread never changes, only who's where in it. */
function placeSketches(): PlacedSketch[] {
  const shuffled = [...SKETCH_FILES]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.map((file, i) => {
    const angle = i * 2.399963 // golden-angle spread, same trick as FloatingItems
    const r = PILE_SCATTER_RADIUS * (0.15 + ((i * 53) % 100) / 120)
    return {
      file,
      aspect: SKETCH_ASPECT[file] ?? 1,
      alpha: file.endsWith('.png'),
      x: Math.cos(angle) * r,
      z: Math.sin(angle) * r,
      y: i * 0.55 + ((i * 31) % 10) * 0.12, // gentle stacking order + jitter
      roll: (((i * 13) % 10) / 10 - 0.5) * 2 * PILE_MAX_ROLL,
      size: PILE_BASE_SIZE * (0.85 + ((i * 19) % 10) / 30),
    }
  })
}

/** One draggable, double-clickable (or double-tappable) sketchbook page in
 * the pile — always facing the camera dead on (drei's Billboard) like a
 * regular flat image, just held slightly crooked (+/-10deg roll around the
 * view axis). Real independent world positions still give the pile genuine
 * depth/parallax as the camera flies in; only the ORIENTATION is locked to
 * face you, not the position. Dragging slides it around a plane parallel to
 * the camera at its own current depth — matches how it looks (a flat photo
 * held up in front of you), not the world-horizontal "table" a lying-flat
 * version would use. A double tap/click toggles "bring to front": pulls it
 * partway toward the camera and scales it up, eased in over a few frames;
 * doing it again returns it to wherever it was beforehand — still draggable
 * while enlarged (moves the enlarged page around without shrinking it back),
 * only another double-tap actually restores it. Detected manually off
 * pointerdown timing (see toggleEnlarge/
 * onPointerDown below) rather than the browser's native 'dblclick' — that
 * event doesn't fire reliably for a touch double-tap, so one mechanism
 * drives both mouse and touch identically. Only interactive once the pile is
 * actually the parked detour (mirrors the papers carousel's focusState-gated
 * drag), so it can't be grabbed by a stray click while still flying toward
 * it. */
function SketchPage({ tex, s }: { tex: THREE.Texture; s: PlacedSketch }) {
  const { camera, gl } = useThree()
  const shadowTex = useMemo(getShadowTexture, [])
  const groupRef = useRef<THREE.Group>(null)
  const draggingRef = useRef(false)
  const dragPlane = useRef(new THREE.Plane())
  const dragOffset = useRef(new THREE.Vector3())
  const hitPoint = useRef(new THREE.Vector3())
  const camForward = useRef(new THREE.Vector3())
  const raycaster = useRef(new THREE.Raycaster())
  const ndc = useRef(new THREE.Vector2())
  // Cumulative pointer travel this press, in screen px — tells a plain click
  // (both halves of a double-click included) apart from an actual drag, so a
  // double-click's own two pointerup events don't reset enlargedRef before
  // onDoubleClick ever gets to read it.
  const movedRef = useRef(0)
  const downClientPos = useRef({ x: 0, y: 0 })
  // Manual double-tap/double-click detection, driven off pointerdown timing
  // rather than the browser's native 'dblclick' — that event doesn't fire
  // reliably for a touch double-tap (same class of issue as the drag fix
  // above), so this one mechanism covers mouse and touch identically.
  const lastTapTime = useRef(0)
  const lastTapPos = useRef({ x: 0, y: 0 })
  // Bound per-press so add/removeEventListener target the exact same
  // function reference; recreated fresh each pointerdown.
  const windowMoveHandler = useRef<((e: PointerEvent) => void) | null>(null)
  const windowUpHandler = useRef<(() => void) | null>(null)

  // Eased toward by the useFrame below whenever not actively being dragged
  // (dragging writes group.position directly for 1:1 tracking, and keeps
  // these targets in sync so a double-click right after a drag enlarges/
  // restores from the correct spot instead of fighting the drag on release).
  const targetPos = useRef(new THREE.Vector3(s.x, s.y, s.z))
  const targetScale = useRef(1)
  // Exactly two states, both computed fresh from this ONE fixed anchor every
  // toggle — never from group's current (possibly still-animating, or
  // already-enlarged) position/scale. That drift is what let repeated
  // double-taps compound into "even bigger" instead of alternating cleanly:
  // capturing "restore" from wherever the group currently was let an
  // in-flight enlarge, or a drag performed while enlarged, get baked in as
  // the new "normal" state. homePos is the page's one true resting spot —
  // updated only by a genuine drag (see endDrag), which also always drops it
  // back into the normal (unenlarged) state, so there's never a third,
  // in-between state to drift through.
  const homePos = useRef(new THREE.Vector3(s.x, s.y, s.z))
  const enlargedRef = useRef(false)

  useFrame(() => {
    const group = groupRef.current
    if (!group || draggingRef.current) return
    group.position.lerp(targetPos.current, PILE_LERP_SPEED)
    const scale = THREE.MathUtils.lerp(group.scale.x, targetScale.current, PILE_LERP_SPEED)
    group.scale.setScalar(scale)
  })

  // Drags to wherever the ray (from clientX/clientY, cast manually) hits the
  // drag plane. Used by the window-level move handler below, NOT R3F's own
  // per-mesh onPointerMove — see the onPointerDown comment for why.
  const dragToClientPoint = (clientX: number, clientY: number) => {
    const group = groupRef.current
    if (!group) return
    const rect = gl.domElement.getBoundingClientRect()
    ndc.current.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.current.setFromCamera(ndc.current, camera)
    if (raycaster.current.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
      group.position.copy(hitPoint.current).add(dragOffset.current)
      targetPos.current.copy(group.position)
    }
  }
  const endDrag = () => {
    draggingRef.current = false
    if (windowMoveHandler.current) {
      window.removeEventListener('pointermove', windowMoveHandler.current)
      windowMoveHandler.current = null
    }
    if (windowUpHandler.current) {
      window.removeEventListener('pointerup', windowUpHandler.current)
      window.removeEventListener('pointercancel', windowUpHandler.current)
      windowUpHandler.current = null
    }
    // Only a REAL drag implicitly "puts it down" (next double-click starts a
    // fresh enlarge from wherever it just landed) — a plain click's release
    // must leave enlargedRef alone, since both halves of a double-click also
    // fire this, and resetting here would stop onDoubleClick below from ever
    // seeing enlargedRef as true.
    if (movedRef.current <= PILE_CLICK_THRESHOLD) return
    // Dragging an ENLARGED page just relocates it — still held up close,
    // still full scale, still toggled off by another double-tap back to its
    // real pile spot. So home (the un-enlarged resting position) and scale
    // are only ever touched by a drag that started at rest.
    if (enlargedRef.current) return
    const group = groupRef.current
    if (group) homePos.current.copy(group.position)
  }
  const toggleEnlarge = () => {
    if (!groupRef.current) return
    enlargedRef.current = !enlargedRef.current
    if (enlargedRef.current) {
      targetPos.current.copy(homePos.current).lerp(camera.position, PILE_ENLARGE_LERP_TO_CAMERA)
      targetScale.current = PILE_ENLARGE_SCALE
    } else {
      targetPos.current.copy(homePos.current)
      targetScale.current = 1
    }
  }
  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!detourState.active) return
    e.stopPropagation()
    const now = performance.now()
    const sinceLastTap = now - lastTapTime.current
    const tapDist = Math.hypot(e.clientX - lastTapPos.current.x, e.clientY - lastTapPos.current.y)
    const isDoubleTap = sinceLastTap < DOUBLE_TAP_MS && tapDist < DOUBLE_TAP_DIST
    if (isDoubleTap) {
      toggleEnlarge()
      lastTapTime.current = 0 // consumed — a third rapid tap starts a fresh pair, not another double
    } else {
      lastTapTime.current = now
      lastTapPos.current = { x: e.clientX, y: e.clientY }
    }
    // Move/up tracking happens via plain window-level listeners below, NOT
    // R3F's own onPointerMove/onPointerUp props — R3F's per-mesh pointer
    // "capture" (event.target.setPointerCapture, its own shim, not the DOM's,
    // since event.target here is a three.js object, not an Element) doesn't
    // reliably keep routing events to this mesh for TOUCH-origin pointers.
    // Window listeners don't depend on R3F's raycast-based routing at all, so
    // they keep tracking regardless of pointer type. (canvas touch-action is
    // set to 'none' persistently while parked at the pile — see useTouchActionForDrag
    // below — NOT reactively here, which is one gesture too late: Chrome
    // decides at touchstart whether a touch is a pan/zoom gesture or a
    // "pointer" one based on the touch-action value already in effect, then
    // fires pointercancel if it picked pan/zoom, so setting it after the
    // pointerdown already fired never arrives in time.)
    e.nativeEvent.preventDefault()

    // The tap that just completed a double-tap doesn't also start a drag —
    // toggleEnlarge() above already did its job for this press. Dragging
    // itself is now allowed from EITHER state: at rest (relocates + rebases
    // home on release, see endDrag) or enlarged (just relocates the enlarged
    // page — see endDrag's enlargedRef branch, which leaves home/scale alone
    // so it's still exactly where it was, still full size, and another
    // double-tap still shrinks it back to its real pile spot).
    if (isDoubleTap) return

    const group = groupRef.current
    if (!group) return
    draggingRef.current = true
    movedRef.current = 0
    downClientPos.current = { x: e.clientX, y: e.clientY }
    camera.getWorldDirection(camForward.current)
    dragPlane.current.setFromNormalAndCoplanarPoint(camForward.current, group.position)
    if (e.ray.intersectPlane(dragPlane.current, hitPoint.current)) {
      dragOffset.current.copy(group.position).sub(hitPoint.current)
    }
    // The "picked up" pop only makes sense from the flat resting pile — an
    // already-enlarged page is already pulled forward, so skip the extra
    // nudge and let the drag itself take over from wherever it currently is.
    if (!enlargedRef.current) {
      group.position.y += PILE_LIFT
      targetPos.current.copy(group.position)
    }

    const onMove = (ev: PointerEvent) => {
      ev.preventDefault()
      movedRef.current = Math.max(
        movedRef.current,
        Math.hypot(ev.clientX - downClientPos.current.x, ev.clientY - downClientPos.current.y),
      )
      dragToClientPoint(ev.clientX, ev.clientY)
    }
    const onUp = () => endDrag()
    windowMoveHandler.current = onMove
    windowUpHandler.current = onUp
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }
  return (
    <group ref={groupRef} position={[s.x, s.y, s.z]}>
      <Billboard>
        {/* Soft drop shadow, behind and slightly offset from the page itself —
            purely decorative, so it's excluded from raycasting (no onPointerDown)
            and never writes depth, matching the page's own transparent pages. */}
        <mesh
          position={[SHADOW_OFFSET, -SHADOW_OFFSET, -1.5]}
          rotation={[0, 0, s.roll]}
          raycast={() => null}
        >
          <planeGeometry args={[s.size * s.aspect * SHADOW_SCALE, s.size * SHADOW_SCALE]} />
          <meshBasicMaterial
            map={shadowTex}
            transparent
            opacity={0.92}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>
        <mesh rotation={[0, 0, s.roll]} onPointerDown={onPointerDown}>
          <planeGeometry args={[s.size * s.aspect, s.size]} />
          <meshBasicMaterial
            map={tex}
            side={THREE.DoubleSide}
            toneMapped={false}
            fog={false}
            transparent={s.alpha}
            alphaTest={s.alpha ? 0.1 : 0}
          />
        </mesh>
      </Billboard>
    </group>
  )
}

/** Canvas touch-action must already be 'none' by the time a touch STARTS for
 * Chrome to treat it as a draggable pointer gesture rather than a native pan/
 * pinch-zoom one — setting it reactively inside a mesh's onPointerDown is one
 * gesture too late (that decision is already made by the time the pointerdown
 * handler runs, so the browser hands the rest of the gesture to native pan/
 * zoom and fires pointercancel; confirmed via logging touchmove continuing
 * to fire raw touch events long after pointermove had stopped). So this is
 * toggled persistently for the whole time the pile is the active detour
 * (not tied to any individual drag), which also happens to block the
 * pinch-to-zoom-out gesture that used to escape the pile entirely. Polls
 * detourState.active the same way Scene.tsx's `inPile` bloom/noise fade does. */
function useTouchActionForDrag() {
  const { gl } = useThree()
  const activeRef = useRef(false)
  useFrame(() => {
    if (detourState.active !== activeRef.current) {
      activeRef.current = detourState.active
      gl.domElement.style.touchAction = activeRef.current ? 'none' : ''
    }
  })
}

/** The sketchbook page pile, scattered at the loop's centre (PILE_CENTER) —
 * an off-curve location reached via the "detour" camera state, triggered by
 * clicking the hub banner's floater photo (see WorldContent.tsx). Each page
 * keeps its own real 3D position (so the pile has genuine depth/parallax)
 * but always faces the camera dead-on, independently draggable. */
export function ImagePile() {
  const textures = useTexture(SKETCH_FILES.map((f) => `/items/sketchbook/${f}`))
  // Keyed by filename, not array index — placed is shuffled per visit (see
  // placeSketches), but textures always loads in SKETCH_FILES' fixed order, so
  // textures[i] for the i-th SHUFFLED slot was pairing each page with a
  // random other page's texture (right aspect, wrong image — or rather, the
  // reverse: the image showing through a differently-aspected plane, which is
  // what read as "weird ratios").
  const texByFile = useMemo(
    () => new Map(SKETCH_FILES.map((f, i) => [f, textures[i] as THREE.Texture])),
    [textures],
  )
  const placed = useMemo(placeSketches, [])
  useTouchActionForDrag()

  return (
    <group position={PILE_CENTER}>
      {placed.map((s) => (
        <SketchPage key={s.file} tex={texByFile.get(s.file) as THREE.Texture} s={s} />
      ))}
    </group>
  )
}
