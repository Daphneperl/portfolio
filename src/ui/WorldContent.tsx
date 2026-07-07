import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { WORLDS, CURVE_LENGTH, type WorldId } from '../scene/curve'
import { CONTENT } from '../content/site'
import { enterPileDetour, focusState, scrollState, scrollToProgress } from '../lib/scroll'

/**
 * The readable content, and where each piece sits ALONG the tunnel curve.
 * Nothing here positions in 3D or animates — <TunnelContent> in the scene places
 * each beat as a real object on the curve so it moves with the grid. This module
 * only builds the beat list and renders each beat's DOM.
 */

type IntroData = NonNullable<(typeof CONTENT)['hub']['intro']>
type ProjectData = NonNullable<IntroData['projects']>[number]
type PaperData = NonNullable<IntroData['papers']>[number]

export type Beat =
  | { key: string; kind: 'panel'; intro: IntroData; accent: string; a: number }
  | { key: string; kind: 'project'; project: ProjectData; accent: string; a: number }
  | { key: string; kind: 'papers'; papers: PaperData[]; accent: string; a: number }

// Each beat is pinned to a curve param `a` (same 0..1 the camera travels). Panels
// sit at their zone centre; a zone with projects puts its title near the front
// and spreads the windows through the back so you fly past them one by one.
export const BEATS: Beat[] = WORLDS.flatMap((w) => {
  const intro = CONTENT[w.id].intro
  if (!intro) return []
  const [s, e] = w.range
  const span = e - s
  const projects = intro.projects ?? []
  const papers = intro.papers ?? []
  if (projects.length === 0 && papers.length === 0) {
    return [{ key: w.id, kind: 'panel', intro, accent: w.accent, a: s + 0.5 * span }]
  }
  const list: Beat[] = [{ key: `${w.id}-banner`, kind: 'panel', intro, accent: w.accent, a: s + 0.12 * span }]
  // Spread evenly between PROJECT_START and PROJECT_END regardless of count,
  // so adding/removing a project never needs the spacing retuned by hand —
  // 2 projects land exactly where the old fixed 0.38/0.32 step put them.
  const PROJECT_START = 0.38
  const PROJECT_END = 0.85
  projects.forEach((p, i) => {
    const frac =
      projects.length > 1 ? PROJECT_START + ((PROJECT_END - PROJECT_START) * i) / (projects.length - 1) : PROJECT_START
    list.push({
      key: `${w.id}-${p.name}`,
      kind: 'project',
      project: p,
      accent: w.accent,
      a: s + frac * span,
    })
  })
  if (papers.length > 0) {
    list.push({ key: `${w.id}-papers`, kind: 'papers', papers, accent: w.accent, a: s + 0.6 * span })
  }
  return list
})

// Where each world's title banner actually sits (its beat's anchor).
export const BANNER_ANCHOR: Record<WorldId, number> = Object.fromEntries(
  WORLDS.map((w) => {
    const beat = BEATS.find((b) => b.key === w.id || b.key === `${w.id}-banner`)
    return [w.id, beat?.a ?? w.range[0]]
  }),
) as Record<WorldId, number>

// A beat is only fully visible while the camera is still APPROACHING it (see
// TunnelContent's FADE_MID/NEAR_HI band) — once the camera reaches the exact
// anchor the distance collapses to ~0 and it's treated as "behind" (invisible).
// So the chapter nav can't jump to the anchor itself; it has to land a fixed
// world-distance short of it, still on the approach side, comfortably inside
// the fully-opaque band. 350 units sits mid-band between NEAR_HI(170)/FADE_MID(620).
const JUMP_VIEW_DISTANCE = 160
const JUMP_BACKOFF_T = JUMP_VIEW_DISTANCE / CURVE_LENGTH

export const JUMP_ANCHOR: Record<WorldId, number> = Object.fromEntries(
  WORLDS.map((w) => {
    const [s] = w.range
    // clamp so the backoff can never leave the zone (or cross the loop seam)
    const target = Math.max(s + 0.002, BANNER_ANCHOR[w.id] - JUMP_BACKOFF_T)
    return [w.id, target]
  }),
) as Record<WorldId, number>

// Project windows are much wider/taller than a banner, so stopping at the
// same distance as JUMP_VIEW_DISTANCE lands too close — the window overflows
// the viewport (title bar cropped at the top, blurb pushed off the bottom).
// Back off further so the whole window, plus its caption below, fits inside.
// Mobile's window renders at a much smaller CSS size than desktop's (see
// ProjectBlock's cls below), so the same backoff would look tiny/distant —
// park the camera closer on mobile so it reads at a comparable on-screen size.
const PROJECT_VIEW_DISTANCE = 320
const PROJECT_VIEW_DISTANCE_MOBILE = 200
const MOBILE_BREAKPOINT = 640

function projectBackoffT(): number {
  const mobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  return (mobile ? PROJECT_VIEW_DISTANCE_MOBILE : PROJECT_VIEW_DISTANCE) / CURVE_LENGTH
}

/** Same backoff distance as JUMP_ANCHOR, but for ANY beat anchor (not just a
 * world's title banner) — used when clicking a beat directly in 3D space. */
function jumpAnchorFor(a: number, backoffT: number = JUMP_BACKOFF_T): number {
  return (((a - backoffT) % 1) + 1) % 1
}

// How close scrollState.progress must already be to a beat's own jump anchor
// to count as "already brought into view" (a second click, not a first).
const FOCUS_TOLERANCE = 0.012

function isFocused(a: number, backoffT: number): boolean {
  const target = jumpAnchorFor(a, backoffT)
  const raw = Math.abs(scrollState.progress - target)
  return Math.min(raw, 1 - raw) < FOCUS_TOLERANCE
}

/** Click handler shared by banners and project windows: the first click just
 * scrolls the beat into full view (front of camera); a second click — only
 * meaningful for a project window with a real href — lets the native link
 * navigation proceed instead of scrolling again. */
function handleBeatClick(a: number, hasLink: boolean, e: MouseEvent, backoffT: number = JUMP_BACKOFF_T) {
  if (hasLink && isFocused(a, backoffT)) return // already in view — let the link navigate
  e.preventDefault()
  focusState.a = a // TunnelContent nudges just this beat onto the camera axis once close
  scrollToProgress(jumpAnchorFor(a, backoffT))
}

/** DOM for one beat — rendered inside a drei <Html> that lives in the 3D scene. */
export function BeatContent({ beat }: { beat: Beat }) {
  if (beat.kind === 'panel') {
    return <GlassPanel intro={beat.intro} accent={beat.accent} a={beat.a} withStars={beat.key === 'hub'} />
  }
  if (beat.kind === 'project') {
    return <ProjectBlock p={beat.project} accent={beat.accent} a={beat.a} />
  }
  return <PapersCarousel papers={beat.papers} accent={beat.accent} a={beat.a} />
}

// Face frame size + orbit radius (CSS px, independent of each image's own
// aspect ratio — a carousel needs a uniform footprint per face for the
// rotation to read as one mechanical ring; images letterbox via object-fit
// inside it rather than cropping — no visible frame behind them, though, so
// letterboxing just reads as empty space). Radius keeps the ring's diameter
// comfortably larger than the face width so faces don't intersect mid-spin.
const CAROUSEL_FACE_W = 510
const CAROUSEL_FACE_W_MOBILE = 240
const CAROUSEL_FACE_H = 340
const CAROUSEL_FACE_H_MOBILE = 190
const CAROUSEL_RADIUS = 780
const CAROUSEL_RADIUS_MOBILE = 380
const CAROUSEL_SPIN_PERIOD_MS = 130_000 // ambient auto-spin: one full turn every ~2min
const CAROUSEL_DRAG_SENSITIVITY = 0.5
const CAROUSEL_CLICK_THRESHOLD = 12 // px of pointer movement before a click reads as a drag instead
const CAROUSEL_FRONT_TOLERANCE = 8 // degrees within which a face counts as "already facing front"
// The face nearest "front" (whichever angle, however it got there — auto-spin,
// drag, or a click-to-front animation) grows; the rest shrink by how far
// they've turned away. This is done by pushing it closer to the viewer along
// its OWN local Z (extra translateZ, tapering to 0 at the back) rather than
// literally CSS-scaling its box: scaling inflates a face's own footprint and
// eats into its neighbours' gap, since the ring's angular spacing is fixed
// but a scaled-up box gets visually wider. Depth-based growth uses genuine
// perspective instead, so each face's actual box — and therefore the gap
// between it and its neighbours — never changes size, only how close it is.
const CAROUSEL_DEPTH_BOOST = 220
const CAROUSEL_DEPTH_BOOST_MOBILE = 110
// Each face is double-sided: the paper image on the front, this dark water
// texture on the back (shown automatically via backface-visibility once a
// face has turned more than 90deg away — no JS needed for the flip itself).
const CAROUSEL_BACK_TEXTURE = '/textures/carousel-back2.png'
// Caption fades in only once a face has turned into the front half of the
// ring (closeness > 0.5, i.e. within 90deg of dead-centre); fully transparent
// the rest of the way round, matching the dark/hidden back.
const CAROUSEL_CAPTION_FADE_START = 0.5
// Same persimmon/rust glow as the banner's .liquid-glass:hover (rgba(232,98,42,...)),
// just always-on and toned down — applied to both front and back faces alike.
const CAROUSEL_GLOW = '0 0 18px rgba(232, 98, 42, 0.22), 0 0 46px rgba(232, 98, 42, 0.14)'

/** Shortest signed distance from angle `b` to angle `a`, in (-180, 180]. */
function angleDiff(a: number, b: number): number {
  return (((a - b) % 360) + 540) % 360 - 180
}

/** All papers in the world's `papers` list, sorted oldest -> newest, arranged
 * as a draggable 3D carousel (pure CSS: rotateY + translateZ faces inside a
 * perspective container) — modeled on the memory_almost_full gallery
 * carousel. Ambient auto-spin always runs; drag-to-rotate and face clicks
 * only work once this beat is the click-focused one (focusState.a === a),
 * matching the same "only interactive once close/focused" rule used
 * elsewhere. Click behaves like the rest of the site: the first click on a
 * face rotates it to the front; a second click, once it's already there,
 * opens its link. Every frame (auto-spin, drag, or the click-to-front
 * animation alike), whichever face is nearest front grows and the rest
 * shrink by angular distance, and its title/year caption below updates to
 * match. */
function PapersCarousel({ papers, accent, a }: { papers: PaperData[]; accent: string; a: number }) {
  const sorted = useMemo(() => [...papers].sort((x, y) => x.year - y.year), [papers])
  const mobile = typeof window !== 'undefined' && window.innerWidth < 640
  const faceW = mobile ? CAROUSEL_FACE_W_MOBILE : CAROUSEL_FACE_W
  const faceH = mobile ? CAROUSEL_FACE_H_MOBILE : CAROUSEL_FACE_H
  const radius = mobile ? CAROUSEL_RADIUS_MOBILE : CAROUSEL_RADIUS
  const depthBoost = mobile ? CAROUSEL_DEPTH_BOOST_MOBILE : CAROUSEL_DEPTH_BOOST
  const angleStep = 360 / sorted.length
  const backoffT = projectBackoffT()

  const carouselRef = useRef<HTMLDivElement>(null)
  const faceRefs = useRef<(HTMLDivElement | null)[]>([])
  const captionRefs = useRef<(HTMLDivElement | null)[]>([])
  const rotationRef = useRef(0)
  const draggingRef = useRef(false)
  const movedRef = useRef(0) // cumulative pointer travel this press, to tell a click from a drag
  const animatingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, rotation: 0 })

  const applyRotation = (deg: number) => {
    rotationRef.current = deg
    if (carouselRef.current) carouselRef.current.style.transform = `rotateY(${deg}deg)`
  }

  // One rAF loop drives everything: auto-spin (paused while dragging or mid
  // click-animation) plus, unconditionally every frame, each face's
  // grow/shrink-by-proximity-to-front.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (t: number) => {
      const dt = t - last
      last = t
      if (!draggingRef.current && !animatingRef.current) {
        applyRotation(rotationRef.current + (dt / CAROUSEL_SPIN_PERIOD_MS) * 360)
      }
      const currentFrontAngle = ((-rotationRef.current % 360) + 360) % 360
      sorted.forEach((_, i) => {
        const faceAngle = i * angleStep
        const diff = angleDiff(faceAngle, currentFrontAngle)
        const closeness = (Math.cos((diff * Math.PI) / 180) + 1) / 2 // 1 at front, 0 at the back
        const effectiveZ = radius + closeness * depthBoost
        const el = faceRefs.current[i]
        if (el) el.style.transform = `rotateY(${faceAngle}deg) translateZ(${effectiveZ}px)`
        const caption = captionRefs.current[i]
        if (caption) {
          const opacity = Math.max(0, (closeness - CAROUSEL_CAPTION_FADE_START) / (1 - CAROUSEL_CAPTION_FADE_START))
          caption.style.opacity = String(opacity)
        }
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [sorted, angleStep, radius, depthBoost])

  // Drag-to-rotate, mouse + touch — gated to focus mode (see doc comment above).
  useEffect(() => {
    const el = carouselRef.current
    if (!el) return
    const onDown = (clientX: number) => {
      if (focusState.a !== a || animatingRef.current) return
      draggingRef.current = true
      movedRef.current = 0
      dragStartRef.current = { x: clientX, rotation: rotationRef.current }
      el.style.cursor = 'grabbing'
    }
    const onMove = (clientX: number) => {
      if (!draggingRef.current) return
      const deltaX = clientX - dragStartRef.current.x
      movedRef.current = Math.max(movedRef.current, Math.abs(deltaX))
      applyRotation(dragStartRef.current.rotation + (deltaX / el.offsetWidth) * 360 * CAROUSEL_DRAG_SENSITIVITY)
    }
    const onUp = () => {
      draggingRef.current = false
      el.style.cursor = 'grab'
    }
    const mouseDown = (e: globalThis.MouseEvent) => {
      onDown(e.clientX)
      e.preventDefault()
    }
    const mouseMove = (e: globalThis.MouseEvent) => onMove(e.clientX)
    const touchStart = (e: TouchEvent) => onDown(e.touches[0].clientX)
    const touchMove = (e: TouchEvent) => onMove(e.touches[0].clientX)
    el.addEventListener('mousedown', mouseDown)
    window.addEventListener('mousemove', mouseMove)
    window.addEventListener('mouseup', onUp)
    el.addEventListener('touchstart', touchStart, { passive: true })
    window.addEventListener('touchmove', touchMove, { passive: true })
    window.addEventListener('touchend', onUp)
    return () => {
      el.removeEventListener('mousedown', mouseDown)
      window.removeEventListener('mousemove', mouseMove)
      window.removeEventListener('mouseup', onUp)
      el.removeEventListener('touchstart', touchStart)
      window.removeEventListener('touchmove', touchMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [a])

  const onFaceClick = (e: MouseEvent, index: number, paper: PaperData) => {
    // Not focused yet: do nothing here and let the click bubble to the
    // container below, which brings the whole carousel into view first —
    // same as clicking a blank part of it.
    if (focusState.a !== a) return
    e.stopPropagation()
    if (movedRef.current > CAROUSEL_CLICK_THRESHOLD) return // that was a drag release, not a click

    const faceAngle = index * angleStep
    const currentFrontAngle = ((-rotationRef.current % 360) + 360) % 360
    const diff = angleDiff(faceAngle, currentFrontAngle)
    if (Math.abs(diff) < CAROUSEL_FRONT_TOLERANCE) {
      if (paper.href) window.open(paper.href, '_blank', 'noreferrer')
      return
    }
    animatingRef.current = true
    const el = carouselRef.current
    if (el) el.style.transition = 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)'
    applyRotation(rotationRef.current - diff)
    window.setTimeout(() => {
      if (el) el.style.transition = 'none'
      animatingRef.current = false
    }, 700)
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{ color: accent, transform: `translateY(${mobile ? -20 : -40}px)` }}
      onClick={(e) => handleBeatClick(a, false, e, backoffT)}
    >
      <div
        className="flex items-center justify-center"
        style={{ perspective: mobile ? 1000 : 1600, width: radius * 2, height: faceH + radius * 0.6 }}
      >
        <div
          ref={carouselRef}
          style={{
            position: 'relative',
            width: faceW,
            height: faceH,
            transformStyle: 'preserve-3d',
            cursor: 'grab',
          }}
        >
          {sorted.map((p, i) => {
            // object-contain kept the <img> element itself at the full faceW x
            // faceH placeholder box, so a box-shadow on it traced that whole
            // rectangle — including the letterboxed empty margin for any paper
            // whose own aspect doesn't match the frame — rather than hugging the
            // actual picture. Sizing the element itself to the paper's own
            // aspect (still bounded by the same faceW x faceH frame) fixes that;
            // the back face already did this implicitly via object-cover
            // filling its box edge-to-edge with no letterboxing.
            const imgW = p.aspect > faceW / faceH ? faceW : faceH * p.aspect
            const imgH = p.aspect > faceW / faceH ? faceW / p.aspect : faceH
            return (
              // Positioned by its own top-left + negative margins (not inset-0)
              // so the box can grow taller than faceH to fit the caption below,
              // while the image itself still lands at exactly the same vertical
              // centre inset-0 gave it — marginTop is -faceH/2, not -total/2.
              <div
                key={p.image}
                ref={(el) => {
                  faceRefs.current[i] = el
                }}
                onClick={(e) => onFaceClick(e, i, p)}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: faceW,
                  height: faceH,
                  marginLeft: -faceW / 2,
                  marginTop: -faceH / 2,
                  transform: `rotateY(${i * angleStep}deg) translateZ(${radius}px)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* front: the actual paper image, sized to its own aspect ratio —
                    hidden automatically once this face has turned past 90deg,
                    no JS involved in the flip itself */}
                <img
                  src={p.image}
                  alt={p.title}
                  draggable={false}
                  className="absolute left-1/2 top-1/2 rounded-none"
                  style={{
                    width: imgW,
                    height: imgH,
                    marginLeft: -imgW / 2,
                    marginTop: -imgH / 2,
                    backfaceVisibility: 'hidden',
                    boxShadow: CAROUSEL_GLOW,
                  }}
                />
                {/* back: dark textured pattern, only visible on the flip side */}
                <img
                  src={CAROUSEL_BACK_TEXTURE}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full rounded-none object-cover"
                  style={{
                    transform: 'rotateY(180deg)',
                    backfaceVisibility: 'hidden',
                    filter: 'brightness(0.75) saturate(0.85)',
                    boxShadow: CAROUSEL_GLOW,
                  }}
                />
                {/* caption: its own opacity (not backface-hidden) fades in only in
                    the front half, driven by closeness in the rAF loop above —
                    already invisible for the whole back half, so it never needs
                    to fight a mirrored-text flip like the images above do */}
                <div
                  ref={(el) => {
                    captionRefs.current[i] = el
                  }}
                  className="absolute left-1/2 top-full mt-3 max-w-[36rem] -translate-x-1/2 text-center font-mono text-[8px] leading-snug text-[#e8e0cf] sm:text-[10px]"
                  style={{ textShadow: '0 1px 12px rgba(0,0,0,0.95)', opacity: 0 }}
                >
                  {p.title}
                  <div className="mt-1 tracking-[0.2em]" style={{ color: accent }}>
                    {p.year}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Every star PNG in public/items/stars — small gold clip-art stars, several
// silhouettes so the fall doesn't look like one shape repeating.
const STAR_FILES = [
  'star_0002_Layer-4.png',
  'star_0005_Layer-7.png',
  'star_0006_Layer-8.png',
  'star_0008_Layer-10.png',
  'star_0010_Layer-12.png',
]
const STAR_COUNT = 60

// Stars start on the user's very first scroll input — not once they've
// scrolled far enough to leave the banner behind — so any non-zero scroll
// velocity counts; a small epsilon just filters out floating-point noise.
const SCROLL_VELOCITY_EPSILON = 0.0005
// Once triggered, stars don't all start at once — each activates after its
// own random delay within this window, so the fall visibly builds up rather
// than popping in as one block.
const STARTUP_SPREAD_MS = 2600

/** Small stars falling + rotating from the bottom edge of the hub banner,
 * behind it (negative z-index) so they read as spawning from behind the
 * glass. Each spawns just above the panel's bottom edge (--fall-start is a
 * small negative offset) so the actual pop-in point is hidden behind the
 * glass, only becoming visible once it's fallen past the real edge.
 * Randomized once per mount — spawn x (full banner width), size, spin,
 * distance/speed/delay — so they don't move as one synchronized block. */
function FallingStars() {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (startedAt !== null) return
    let raf = 0
    const check = () => {
      if (Math.abs(scrollState.velocity) > SCROLL_VELOCITY_EPSILON) {
        setStartedAt(performance.now())
        return
      }
      raf = requestAnimationFrame(check)
    }
    raf = requestAnimationFrame(check)
    return () => cancelAnimationFrame(raf)
  }, [startedAt])

  useEffect(() => {
    if (startedAt === null) return
    // Re-render periodically while stars are still trickling in so each one's
    // own staggered start gets picked up; stops once the spread window has
    // fully elapsed (nothing left to activate after that).
    const id = setInterval(() => forceTick((n) => n + 1), 120)
    const stop = setTimeout(() => clearInterval(id), STARTUP_SPREAD_MS + 200)
    return () => {
      clearInterval(id)
      clearTimeout(stop)
    }
  }, [startedAt])

  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => {
        const duration = 4 + Math.random() * 5
        return {
          key: i,
          file: STAR_FILES[Math.floor(Math.random() * STAR_FILES.length)],
          left: Math.random() * 100,
          size: 12 + Math.random() * 16,
          duration,
          startupStagger: Math.random() * STARTUP_SPREAD_MS,
          fallStart: -(10 + Math.random() * 6), // spawns from one crisp line along the panel's bottom margin
          fallDistance: 220 + Math.random() * 260,
          spin: (Math.random() < 0.5 ? -1 : 1) * (240 + Math.random() * 360),
        }
      }),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-x-0 top-full -z-10 h-0 overflow-visible">
      {stars.map((s) => {
        const active = startedAt !== null && performance.now() - startedAt >= s.startupStagger
        return (
          <img
            key={s.key}
            src={`/items/stars/${s.file}`}
            alt=""
            className="falling-star"
            style={
              {
                left: `${s.left}%`,
                width: s.size,
                // 'none' until this star's own staggered start arrives: a CSS
                // animation overrides any inline value for a property it
                // targets even while paused, so pausing alone can't keep it
                // invisible — the animation itself has to not be attached yet.
                animationName: active ? 'star-fall' : 'none',
                animationDuration: `${s.duration}s`,
                '--fall-start': `${s.fallStart}px`,
                '--fall-distance': `${s.fallDistance}px`,
                '--fall-spin': `${s.spin}deg`,
              } as CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

/** A project shown as a retro Internet Explorer window: the gif is the "webpage". */
function RetroWindow({
  title,
  url,
  gif,
  alt,
  aspect,
  accent,
}: {
  title: string
  url: string
  gif: string
  alt: string
  aspect: string
  accent: string
}) {
  return (
    <div className="retro-window" style={{ '--rw-accent': accent } as CSSProperties}>
      <div className="retro-titlebar">
        <span className="retro-ico">e</span>
        <span className="retro-title-text">{title} - Microsoft Internet Explorer</span>
        <span className="retro-winbtns">
          <span className="retro-winbtn">_</span>
          <span className="retro-winbtn">☐</span>
          <span className="retro-winbtn">✕</span>
        </span>
      </div>
      <div className="retro-row retro-menu">
        <span>
          <u>F</u>ile
        </span>
        <span>
          <u>E</u>dit
        </span>
        <span>
          <u>V</u>iew
        </span>
        <span>
          F<u>a</u>vorites
        </span>
        <span>
          <u>T</u>ools
        </span>
        <span>
          <u>H</u>elp
        </span>
      </div>
      <div className="retro-row retro-toolbar">
        <span>← Back</span>
        <span>→ Forward</span>
        <span className="retro-sep" />
        <span>✕ Stop</span>
        <span>⟳ Refresh</span>
        <span>⌂ Home</span>
        <span className="retro-sep" />
        <span>Search</span>
        <span>Favorites</span>
        <span>History</span>
      </div>
      <div className="retro-row retro-address">
        <span className="retro-address-label">Address</span>
        <span className="retro-field">
          <span className="retro-fav">e</span>
          <span className="retro-url">{url}</span>
        </span>
        <span className="retro-go">→ Go</span>
      </div>
      <div className="retro-content" style={{ aspectRatio: aspect }}>
        <img src={gif} alt={alt} />
      </div>
      <div className="retro-status">
        <span className="retro-status-cell">Done</span>
        <span className="retro-status-cell">🖳 Internet</span>
      </div>
    </div>
  )
}

/** A retro browser window with the project name + description below it. */
function ProjectBlock({ p, accent, a }: { p: ProjectData; accent: string; a: number }) {
  // Split the blurb into one line per sentence (on ".") instead of one flowing
  // paragraph — same treatment as the hub banner's multi-line intro.
  const sentences = p.blurb
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
  const inner = (
    <>
      {p.gif && (
        <RetroWindow
          title={p.title ?? p.name}
          url={p.href ?? ''}
          gif={p.gif}
          alt={p.name}
          aspect={p.aspect ?? '4 / 3'}
          accent={accent}
        />
      )}
      <div className="mt-4 flex items-baseline justify-start gap-3">
        <span className="font-mono text-xl tracking-tight text-[#f2ecdd] sm:text-5xl">{p.name}</span>
        {p.href && (
          <span className="font-mono text-base sm:text-2xl" style={{ color: accent }}>
            ↗
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1">
        {sentences.map((s, i) => {
          // Only the first paragraph stays left — every one after it flips to
          // the window's right edge instead of stacking left underneath.
          const alignRight = i > 0
          return (
            <p
              key={i}
              className={`max-w-[54rem] text-base leading-snug text-[#e8e0cf]/85 sm:text-3xl ${
                alignRight ? 'ml-auto text-right' : ''
              }`}
              style={{ textShadow: '0 1px 14px rgba(0,0,0,0.95)' }}
            >
              {s}.
            </p>
          )
        })}
      </div>
    </>
  )
  const cls = 'block w-[94vw] max-w-[480px] text-left sm:w-[1320px] sm:max-w-none'
  // Right-aligning every paragraph after the first (above) makes a 3-sentence
  // blurb reach far enough down to collide with the bottom chapter nav, since
  // that text now sits under it instead of off to the left. junk_is has more
  // spare room at the top than the bottom, so lift 3+-sentence blurbs extra to
  // spend that headroom instead of shifting every project by the same amount.
  const mobile = typeof window !== 'undefined' && window.innerWidth < 640
  const lift = (mobile ? 15 : 30) + (sentences.length >= 3 ? (mobile ? 20 : 45) : 0)
  const liftStyle = { transform: `translateY(-${lift}px)` }
  return p.href ? (
    <a
      href={p.href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => handleBeatClick(a, true, e, projectBackoffT())}
      className={`${cls} transition-opacity hover:opacity-80`}
      style={liftStyle}
    >
      {inner}
    </a>
  ) : (
    <div className={cls} onClick={(e) => handleBeatClick(a, false, e, projectBackoffT())} style={liftStyle}>
      {inner}
    </div>
  )
}

/** The glass banner: heading, optional paragraphs, optional links. */
function GlassPanel({
  intro,
  accent,
  a,
  withStars,
}: {
  intro: IntroData
  accent: string
  a: number
  withStars?: boolean
}) {
  const panel = (
    <div
      className={`liquid-glass px-10 py-9 sm:px-12 sm:py-11 ${
        intro.wide
          ? 'w-[86vw] max-w-[380px] sm:w-[560px] sm:max-w-none'
          : 'w-[86vw] max-w-[340px] sm:w-[460px] sm:max-w-none'
      }`}
      onClick={(e) => handleBeatClick(a, false, e)}
    >
      <h1
        className="font-serif text-3xl leading-[1.05] text-[#f2ecdd] sm:text-6xl"
        style={{ textShadow: '0 2px 30px rgba(0,0,0,0.6)' }}
      >
        {intro.heading}
      </h1>
      {intro.lines && intro.lines.length > 0 && (
        <div className="mt-6 space-y-3">
          {intro.lines.map((line, i) => (
            <p
              key={i}
              className="text-[15px] leading-relaxed text-[#e8e0cf]/85 sm:text-base"
              style={{ textShadow: '0 1px 16px rgba(0,0,0,0.7)' }}
            >
              {line}
            </p>
          ))}
        </div>
      )}
      {intro.links && intro.links.length > 0 && (
        <div className="mt-7 flex flex-wrap gap-4">
          {intro.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              target={l.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-xs tracking-[0.2em] uppercase transition-opacity hover:opacity-100"
              style={{ color: accent, opacity: 0.8 }}
            >
              {l.label} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  )

  if (!intro.floater && !withStars) return panel

  return (
    <div className="relative">
      {withStars && <FallingStars />}
      {panel}
      {/* Plain CSS sibling, not a separate 3D object — it shares the exact same
          transform/scale as the panel (both live inside the same beat), so its
          position relative to the panel can never drift with distance. Fixed
          in place (no rise/sink motion); opacity cascades from the shared
          beat wrapper, so it only ever fades in/out with the panel. */}
      {intro.floater && (
        <div
          className="hover-glow pointer-events-auto absolute right-[20px] top-[-140px] cursor-pointer sm:right-[40px] sm:top-[-220px]"
          style={{ color: accent }}
          onClick={(e) => {
            // Stop it bubbling to the panel's own onClick, which would
            // otherwise also re-trigger this beat's scroll-to-self focus.
            e.stopPropagation()
            enterPileDetour()
          }}
        >
          <img
            src={intro.floater}
            alt="Open the sketchbook"
            className="edge-fade h-[140px] w-[140px] rounded-2xl object-cover sm:h-[220px] sm:w-[220px]"
          />
        </div>
      )}
    </div>
  )
}
