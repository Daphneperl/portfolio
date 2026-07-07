import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { WORLDS, CURVE_LENGTH, type WorldId } from '../scene/curve'
import { CONTENT } from '../content/site'
import { focusState, scrollState, scrollToProgress } from '../lib/scroll'

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
  return <PapersGrid papers={beat.papers} accent={beat.accent} a={beat.a} />
}

/** Full-screen preview of a hovered paper — portaled straight to <body>. It
 * has to be a portal, not a sibling inside the grid's own Html sprite: that
 * Html node is positioned with a CSS transform (drei's 3D-to-screen
 * projection), and a `transform` on an ancestor redefines the containing
 * block for `position: fixed` descendants — so a fixed-centered overlay
 * INSIDE the sprite would centre on the sprite's own transformed box, not
 * the real viewport. Portaling to <body> escapes that entirely. Purely
 * visual (pointer-events-none) — clicking/focusing still happens on the
 * small thumbnail underneath, which keeps receiving the real hover events
 * regardless of what's portaled elsewhere on screen.
 *
 * Animates in with a FLIP: `originRect` is the small thumbnail's own
 * bounding box at the moment of hover. On mount, before paint, the preview
 * is transformed (translate+scale, no transition) to exactly overlay that
 * rect — so the very first frame looks identical to the thumbnail still
 * being there. One rAF later the transform is cleared to identity with a
 * transition, so the browser animates FROM the thumbnail's position/size TO
 * the natural centred/full size — it visibly grows out of where you were
 * hovering, rather than just fading in already-centred. */
function PaperHoverPreview({ paper, accent, originRect }: { paper: PaperData; accent: string; originRect: DOMRect }) {
  const boxRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return
    const finalRect = box.getBoundingClientRect()
    const scale = Math.min(originRect.width / finalRect.width, originRect.height / finalRect.height)
    const dx = originRect.left + originRect.width / 2 - (finalRect.left + finalRect.width / 2)
    const dy = originRect.top + originRect.height / 2 - (finalRect.top + finalRect.height / 2)
    box.style.transition = 'none'
    box.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`
    box.style.opacity = '0.5'
    void box.offsetHeight // force layout so the browser commits the "from" state before animating
    requestAnimationFrame(() => {
      box.style.transition = 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 320ms ease-out'
      box.style.transform = 'translate(0, 0) scale(1)'
      box.style.opacity = '1'
    })
  }, [originRect])

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[500] flex flex-col items-center justify-center">
      <div className="absolute inset-0 bg-black/40 transition-opacity" />
      <div ref={boxRef} className="relative flex flex-col items-center">
        <img
          src={paper.image}
          alt={paper.title}
          className="rounded-none"
          style={{ maxHeight: '62vh', maxWidth: '72vw', width: 'auto', height: 'auto', boxShadow: '0 30px 90px rgba(0,0,0,0.85)' }}
        />
        <div
          className="mt-5 max-w-[46rem] text-center font-mono text-sm leading-relaxed text-[#e8e0cf] sm:text-lg"
          style={{ textShadow: '0 1px 14px rgba(0,0,0,0.95)' }}
        >
          {paper.title}
          <div className="mt-2 tracking-[0.2em]" style={{ color: accent }}>
            {paper.year}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** One paper's image in the grid — sharp corners, no crop (its real aspect
 * ratio via a computed height + auto width). Click behaves exactly like a
 * project window: first click scrolls/focuses it into view, a second click
 * (only once already focused) lets the link navigate. stopPropagation keeps
 * the container's own click (for clicking the gaps between images) from
 * double-firing. Hovering shows the full-screen preview above — but only
 * once this grid is the click-focused beat (focusState.a === a); hovering
 * while just passing by at a distance does nothing, per the ask that this
 * only kick in once the grid is close/focused for the reader. */
function PaperCell({ paper, a, backoffT, height, onHoverChange }: { paper: PaperData; a: number; backoffT: number; height: number; onHoverChange: (hovered: boolean, rect?: DOMRect) => void }) {
  const img = (
    <img
      src={paper.image}
      alt={paper.title}
      className="w-auto rounded-none"
      style={{ height, boxShadow: '0 10px 30px rgba(0,0,0,0.6)' }}
    />
  )
  const onClick = (e: MouseEvent) => {
    handleBeatClick(a, Boolean(paper.href), e, backoffT)
    e.stopPropagation()
  }
  const hoverHandlers = {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      if (focusState.a !== a) return
      onHoverChange(true, e.currentTarget.getBoundingClientRect())
    },
    onMouseLeave: () => onHoverChange(false),
  }
  return paper.href ? (
    <a
      href={paper.href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      className="block shrink-0 transition-opacity hover:opacity-75"
      {...hoverHandlers}
    >
      {img}
    </a>
  ) : (
    <div onClick={onClick} className="block shrink-0" {...hoverHandlers}>
      {img}
    </div>
  )
}

// Wider now than the original tight contact-sheet spacing — both between
// images within a row, and between the two rows.
const PAPERS_GAP = 28
const PAPERS_GAP_MOBILE = 14
const PAPERS_ROW_GAP = 40
const PAPERS_ROW_GAP_MOBILE = 20
const PAPERS_BASE_HEIGHT = 200 // row 1's height; row 2 is derived to match its total width
const PAPERS_BASE_HEIGHT_MOBILE = 90

function rowWidth(row: PaperData[], height: number, gap: number): number {
  return row.reduce((sum, p) => sum + height * p.aspect, 0) + gap * (row.length - 1)
}
function heightForWidth(row: PaperData[], targetWidth: number, gap: number): number {
  const aspectSum = row.reduce((sum, p) => sum + p.aspect, 0)
  return (targetWidth - gap * (row.length - 1)) / aspectSum
}

/** All papers in the world's `papers` list, sorted oldest -> newest, laid out
 * as a 2-row grid (row 1 = the 5 oldest, row 2 = the 5 newest). Each image
 * keeps its own aspect ratio — row 1 sets a base height, row 2's height is
 * derived so its total width matches row 1's exactly, so the two rows form
 * one clean rectangle instead of two independently-centred, differently-wide
 * strips. Same viewing distance as project windows (projectBackoffT) since it
 * reads at a similar on-screen scale. */
function PapersGrid({ papers, accent, a }: { papers: PaperData[]; accent: string; a: number }) {
  const sorted = useMemo(() => [...papers].sort((x, y) => x.year - y.year), [papers])
  const row1 = sorted.slice(0, 5)
  const row2 = sorted.slice(5, 10)
  const mobile = typeof window !== 'undefined' && window.innerWidth < 640
  const gap = mobile ? PAPERS_GAP_MOBILE : PAPERS_GAP
  const rowGap = mobile ? PAPERS_ROW_GAP_MOBILE : PAPERS_ROW_GAP
  const row1Height = mobile ? PAPERS_BASE_HEIGHT_MOBILE : PAPERS_BASE_HEIGHT
  const targetWidth = rowWidth(row1, row1Height, gap)
  const row2Height = heightForWidth(row2, targetWidth, gap)
  const backoffT = projectBackoffT()
  const [hovered, setHovered] = useState<{ paper: PaperData; rect: DOMRect } | null>(null)
  const onHoverChange = (p: PaperData) => (h: boolean, rect?: DOMRect) => setHovered(h && rect ? { paper: p, rect } : null)
  return (
    <div
      className="flex w-max flex-col items-center"
      style={{ color: accent, gap: rowGap }}
      onClick={(e) => handleBeatClick(a, false, e, backoffT)}
    >
      <div className="flex w-max items-end justify-center" style={{ gap }}>
        {row1.map((p) => (
          <PaperCell key={p.image} paper={p} a={a} backoffT={backoffT} height={row1Height} onHoverChange={onHoverChange(p)} />
        ))}
      </div>
      <div className="flex w-max items-end justify-center" style={{ gap }}>
        {row2.map((p) => (
          <PaperCell key={p.image} paper={p} a={a} backoffT={backoffT} height={row2Height} onHoverChange={onHoverChange(p)} />
        ))}
      </div>
      {hovered && <PaperHoverPreview paper={hovered.paper} accent={accent} originRect={hovered.rect} />}
    </div>
  )
}

// Every star PNG in public/items/stars — small gold clip-art stars, several
// silhouettes so the fall doesn't look like one shape repeating.
const STAR_FILES = [
  'star_0000_Layer-2.png',
  'star_0001_Layer-3.png',
  'star_0002_Layer-4.png',
  'star_0003_Layer-5.png',
  'star_0004_Layer-6.png',
  'star_0005_Layer-7.png',
  'star_0006_Layer-8.png',
  'star_0007_Layer-9.png',
  'star_0008_Layer-10.png',
  'star_0009_Layer-11.png',
  'star_0010_Layer-12.png',
  'star_0011_Layer-13.png',
  'star_0012_Layer-14.png',
  'star_0013_Layer-15.png',
  'star_0014_Layer-1.png',
]
const STAR_COUNT = 60

// How far (in wrapped curve-progress) the camera must have moved from the
// hub's own resting point (JUMP_ANCHOR.hub — where the page opens, framed on
// the banner) before stars are allowed to start — i.e. only once you've
// actually scrolled past the banner's focused/at-rest view, not just any tiny
// scroll input while still sitting on it.
const HUB_REST_T = JUMP_ANCHOR.hub
const HUB_EXIT_THRESHOLD = 0.012
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
      const rawDist = Math.abs(scrollState.progress - HUB_REST_T)
      const distFromRest = Math.min(rawDist, 1 - rawDist)
      if (distFromRest > HUB_EXIT_THRESHOLD) {
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
          delay: -Math.random() * duration, // negative: already mid-fall on activation, staggered
          startupStagger: Math.random() * STARTUP_SPREAD_MS,
          fallStart: -(8 + Math.random() * 22), // spawns just behind the panel's bottom edge
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
                animationDelay: `${s.delay}s`,
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
        <div className="pointer-events-none absolute right-[20px] top-[-140px] sm:right-[40px] sm:top-[-220px]">
          <img
            src={intro.floater}
            alt=""
            className="edge-fade h-[140px] w-[140px] rounded-2xl object-cover sm:h-[220px] sm:w-[220px]"
          />
        </div>
      )}
    </div>
  )
}
