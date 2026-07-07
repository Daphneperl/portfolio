import type { CSSProperties } from 'react'
import { WORLDS, CURVE_LENGTH, type WorldId } from '../scene/curve'
import { CONTENT } from '../content/site'

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
  projects.forEach((p, i) => {
    list.push({
      key: `${w.id}-${p.name}`,
      kind: 'project',
      project: p,
      accent: w.accent,
      a: s + (0.38 + i * 0.32) * span,
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

/** DOM for one beat — rendered inside a drei <Html> that lives in the 3D scene. */
export function BeatContent({ beat }: { beat: Beat }) {
  return beat.kind === 'panel' ? (
    <GlassPanel intro={beat.intro} accent={beat.accent} />
  ) : (
    <ProjectBlock p={beat.project} accent={beat.accent} />
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
function ProjectBlock({ p, accent }: { p: ProjectData; accent: string }) {
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
        <span className="font-mono text-xl tracking-tight text-[#f2ecdd] sm:text-3xl">{p.name}</span>
        {p.href && (
          <span className="font-mono text-base" style={{ color: accent }}>
            ↗
          </span>
        )}
      </div>
      <p
        className="mx-auto mt-4 max-w-[40rem] text-sm leading-relaxed text-[#e8e0cf]/85 sm:text-lg"
        style={{ textShadow: '0 1px 14px rgba(0,0,0,0.95)' }}
      >
        {p.blurb}
      </p>
    </>
  )
  const cls = 'block w-[86vw] max-w-[380px] text-center sm:w-[950px] sm:max-w-none'
  return p.href ? (
    <a href={p.href} target="_blank" rel="noreferrer" className={`${cls} transition-opacity hover:opacity-80`}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

/** The glass banner: heading, optional paragraphs, optional links. */
function GlassPanel({ intro, accent }: { intro: IntroData; accent: string }) {
  const panel = (
    <div
      className={`liquid-glass px-10 py-9 sm:px-12 sm:py-11 ${
        intro.wide
          ? 'w-[86vw] max-w-[380px] sm:w-[560px] sm:max-w-none'
          : 'w-[86vw] max-w-[340px] sm:w-[460px] sm:max-w-none'
      }`}
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

  if (!intro.floater) return panel

  return (
    <div className="relative">
      {panel}
      {/* Plain CSS sibling, not a separate 3D object — it shares the exact same
          transform/scale as the panel (both live inside the same beat), so its
          position relative to the panel can never drift with distance. Fixed
          in place (no rise/sink motion); opacity cascades from the shared
          beat wrapper, so it only ever fades in/out with the panel. */}
      <div className="pointer-events-none absolute right-[20px] top-[-140px] sm:right-[40px] sm:top-[-220px]">
        <img
          src={intro.floater}
          alt=""
          className="edge-fade h-[140px] w-[140px] rounded-2xl object-cover sm:h-[220px] sm:w-[220px]"
        />
      </div>
    </div>
  )
}
