import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
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

export type Beat =
  | { key: string; kind: 'panel'; intro: IntroData; accent: string; a: number }
  | { key: string; kind: 'project'; project: ProjectData; accent: string; a: number }

// Each beat is pinned to a curve param `a` (same 0..1 the camera travels). Panels
// sit at their zone centre; a zone with projects puts its title near the front
// and spreads the windows through the back so you fly past them one by one.
export const BEATS: Beat[] = WORLDS.flatMap((w) => {
  const intro = CONTENT[w.id].intro
  if (!intro) return []
  const [s, e] = w.range
  const span = e - s
  const projects = intro.projects ?? []
  if (projects.length === 0) {
    return [{ key: w.id, kind: 'panel', intro, accent: w.accent, a: s + 0.5 * span }]
  }
  const list: Beat[] = [{ key: `${w.id}-banner`, kind: 'panel', intro, accent: w.accent, a: s + 0.12 * span }]
  // Spread evenly between PROJECT_START and PROJECT_END regardless of count,
  // so adding/removing a project never needs the spacing retuned by hand —
  // 2 projects land exactly where the old fixed 0.38/0.32 step put them.
  const PROJECT_START = 0.38
  const PROJECT_END = 0.7
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
  return beat.kind === 'panel' ? (
    <GlassPanel intro={beat.intro} accent={beat.accent} a={beat.a} withStars={beat.key === 'hub'} />
  ) : (
    <ProjectBlock p={beat.project} accent={beat.accent} a={beat.a} />
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
      <div className="mt-6 flex items-baseline justify-center gap-3">
        <span className="font-mono text-xl tracking-tight text-[#f2ecdd] sm:text-4xl">{p.name}</span>
        {p.href && (
          <span className="font-mono text-base sm:text-xl" style={{ color: accent }}>
            ↗
          </span>
        )}
      </div>
      <p
        className="mx-auto mt-4 max-w-[46rem] text-sm leading-relaxed text-[#e8e0cf]/85 sm:text-xl"
        style={{ textShadow: '0 1px 14px rgba(0,0,0,0.95)' }}
      >
        {p.blurb}
      </p>
    </>
  )
  const cls = 'block w-[94vw] max-w-[480px] text-center sm:w-[1150px] sm:max-w-none'
  return p.href ? (
    <a
      href={p.href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => handleBeatClick(a, true, e, projectBackoffT())}
      className={`${cls} transition-opacity hover:opacity-80`}
    >
      {inner}
    </a>
  ) : (
    <div className={cls} onClick={(e) => handleBeatClick(a, false, e, projectBackoffT())}>
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
