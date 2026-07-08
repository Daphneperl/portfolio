import { useEffect, useRef, useState } from 'react'
import { detourState, exitPileDetour, focusState, scrollState, scrollToProgress } from '../lib/scroll'
import { WORLDS, worldAt, type WorldId } from '../scene/curve'
import { BANNER_ANCHOR, JUMP_ANCHOR } from './WorldContent'

// Bottom-nav labels only — split the long ones onto two centered lines so
// every button reads at a consistent height, independent of the shared
// `label` field used elsewhere (top-right display stays single-line).
const NAV_LINES: Record<WorldId, string[]> = {
  hub: ['ABOUT ME'],
  web: ['WEB DESIGN', '& DEV'],
  sci: ['SCIENTIFIC', 'GRAPHICS'],
}

/**
 * Fixed DOM layer over the 3D canvas: shows which world you're travelling
 * through and lets you jump. Updates from scrollState each frame.
 */
export function Hud() {
  const [progress, setProgress] = useState(0)
  const [activeId, setActiveId] = useState<WorldId>('hub')
  const [inPile, setInPile] = useState(false)
  const raf = useRef(0)

  useEffect(() => {
    const tick = () => {
      setProgress(scrollState.progress)
      setActiveId(worldAt(scrollState.progress).id)
      setInPile(detourState.active)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const active = worldAt(progress)

  const jump = (id: WorldId) => {
    // While parked at the sketchbook pile, the nav's normal per-world jump
    // doesn't make sense (the camera isn't following the curve at all right
    // now) — just leave the pile instead, same as the back button. Since
    // scrollState.progress hasn't moved during the detour, this already
    // lands back on the About Me banner it was entered from.
    if (detourState.active) {
      exitPileDetour()
      return
    }
    // land a fixed distance BEFORE the banner (still approaching, fully lit) —
    // not at its exact anchor, which collapses to "just behind you" (invisible).
    focusState.a = BANNER_ANCHOR[id] // TunnelContent nudges just the banner onto the camera axis once close
    scrollToProgress(JUMP_ANCHOR[id])
  }

  const exitPileOrNoop = () => {
    if (detourState.active) exitPileDetour()
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* Only shown while parked at the sketchbook pile (see lib/scroll.ts's
          detourState) — scrolling also exits (App.tsx's wheel listener), but
          touch has no equivalent (indistinguishable from dragging a photo).
          Desktop only here (top-center, sm and up) — on mobile this collides
          with the top-left name block at narrower widths (both sit in the
          same top row), so mobile gets its own separate button below instead. */}
      <div
        className="absolute left-1/2 top-8 hidden -translate-x-1/2 transition-opacity duration-500 sm:block"
        style={{ opacity: inPile ? 1 : 0, pointerEvents: inPile ? 'auto' : 'none' }}
      >
        <button
          onClick={exitPileDetour}
          className="hover-glow pointer-events-auto flex items-center gap-2 font-mono text-sm tracking-[0.2em] text-[#e8e0cf]/80 uppercase"
        >
          ← Back
        </button>
      </div>

      {/* Mobile-only equivalent — bottom-right, clear of the bottom-left
          chapter rail and the top row's name/world-label clutter. A pinch/
          2-finger gesture used to fall through to native browser zoom-out
          here (no dedicated exit besides scroll, title-click, or Esc — none
          obvious on a touch device), so this gives mobile an explicit, always-
          reachable way out of the pile. */}
      <div
        className="absolute bottom-6 right-4 transition-opacity duration-500 sm:hidden"
        style={{ opacity: inPile ? 1 : 0, pointerEvents: inPile ? 'auto' : 'none' }}
      >
        <button
          onClick={exitPileDetour}
          className="hover-glow pointer-events-auto flex items-center gap-2 rounded-full border border-[#e8e0cf]/25 bg-black/30 px-4 py-2.5 font-mono text-base tracking-[0.2em] text-[#e8e0cf] uppercase"
        >
          ← Back
        </button>
      </div>

      {/* top-left: identity — name/tagline/email fade together while the
          "About Me" banner (which already says this) is on screen, back in
          once you scroll past it (or while parked at the sketchbook pile,
          where clicking the title doubles as another way back out — activeId
          is still 'hub' there since scrollState.progress hasn't moved, so
          that condition alone would otherwise keep this hidden the whole
          time you're at the pile). Mobile-first: smaller text/tighter margin
          at the base, current desktop sizing restored unchanged at sm: and up. */}
      <div
        className="absolute left-4 top-4 max-w-[45vw] font-mono text-sm tracking-widest text-[#e8e0cf]/80 transition-opacity duration-700 ease-out sm:left-8 sm:top-8 sm:max-w-none sm:text-base"
        style={{
          opacity: activeId === 'hub' && !inPile ? 0 : 1,
          pointerEvents: activeId === 'hub' && !inPile ? 'none' : 'auto',
        }}
      >
        <div
          className={inPile ? 'hover-glow cursor-pointer text-base text-[#e8e0cf] sm:text-xl' : 'text-base text-[#e8e0cf] sm:text-xl'}
          onClick={inPile ? exitPileOrNoop : undefined}
        >
          DAPHNE PERLMAN
        </div>
        <div className="text-xs text-[#e8e0cf]/50 sm:text-sm">designer · dev · artist · Scientist</div>
        <a
          href="mailto:tech@citizencafetlv.com"
          className="hover-glow mt-2 inline-block font-mono text-[10px] tracking-[0.2em] text-[#e8e0cf]/60 uppercase sm:text-xs"
        >
          Email ↗
        </a>
      </div>

      {/* top-right: current world */}
      <div className="absolute right-4 top-4 max-w-[45vw] text-right sm:right-8 sm:top-8 sm:max-w-none">
        <div
          className="font-mono text-sm leading-tight tracking-[0.2em] transition-colors sm:text-xl sm:leading-normal sm:tracking-[0.25em]"
          style={{ color: active.accent }}
        >
          {active.label.toUpperCase()}
        </div>
      </div>

      {/* bottom center: world rail (sm and up) — fixed-width buttons so short
          ("ABOUT ME") and long ("SCIENTIFIC GRAPHICS") labels still space out
          evenly. Hidden on mobile in favour of the stacked bottom-left rail. */}
      <nav className="pointer-events-auto absolute bottom-4 left-1/2 hidden -translate-x-1/2 justify-center gap-10 sm:flex">
        {WORLDS.map((w) => {
          const on = w.id === activeId
          return (
            <button
              key={w.id}
              onClick={() => jump(w.id)}
              className="hover-glow group flex w-40 flex-col items-center gap-3 py-3"
              style={{ color: w.accent }}
            >
              <span
                className="h-[4px] w-24 rounded-full transition-all duration-300"
                style={{
                  background: on ? w.accent : 'rgba(232,224,207,0.2)',
                  boxShadow: on ? `0 0 12px ${w.accent}` : 'none',
                }}
              />
              <span
                className="flex min-h-[2.25rem] flex-col items-center justify-start text-center font-mono text-xs leading-tight tracking-[0.2em] transition-opacity"
                style={{ color: w.accent, opacity: on ? 1 : 0.35 }}
              >
                {NAV_LINES[w.id].map((line, i) => (
                  <span key={i}>{line}</span>
                ))}
              </span>
            </button>
          )
        })}
      </nav>

      {/* bottom-left world rail (mobile only) — three stacked rows, each a
          short tick + the chapter name to its right; allowed to run close to
          the screen edge rather than wrapping/shrinking to fit. */}
      <nav className="pointer-events-auto absolute bottom-6 left-4 flex flex-col gap-2.5 sm:hidden">
        {WORLDS.map((w) => {
          const on = w.id === activeId
          return (
            <button
              key={w.id}
              onClick={() => jump(w.id)}
              className="hover-glow flex items-center gap-2.5"
              style={{ color: w.accent }}
            >
              <span
                className="h-[3px] w-6 flex-none rounded-full transition-all duration-300"
                style={{
                  background: on ? w.accent : 'rgba(232,224,207,0.2)',
                  boxShadow: on ? `0 0 8px ${w.accent}` : 'none',
                }}
              />
              <span
                className="whitespace-nowrap font-mono text-[10px] tracking-[0.15em] transition-opacity"
                style={{ color: w.accent, opacity: on ? 1 : 0.35 }}
              >
                {w.label.toUpperCase()}
              </span>
            </button>
          )
        })}
      </nav>

      {/* scroll hint, fades after you start */}
      <div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-[#e8e0cf]/50 transition-opacity duration-500 sm:bottom-24"
        style={{ opacity: progress > 0.01 ? 0 : 1 }}
      >
        SCROLL TO TRAVEL ↓
      </div>
    </div>
  )
}
