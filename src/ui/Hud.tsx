import { useEffect, useRef, useState } from 'react'
import { scrollState, scrollToProgress } from '../lib/scroll'
import { WORLDS, worldAt, type WorldId } from '../scene/curve'
import { JUMP_ANCHOR } from './WorldContent'

// Bottom-nav labels only — split the long ones onto two centered lines so
// every button reads at a consistent height, independent of the shared
// `label` field used elsewhere (top-right display stays single-line).
const NAV_LINES: Record<WorldId, string[]> = {
  hub: ['WHO I AM'],
  web: ['WEB DESIGN', '& DEV'],
  sci: ['SCIENTIFIC', 'GRAPHICS'],
}

/**
 * Fixed DOM layer over the 3D canvas: shows which world you're travelling
 * through, a progress rail, and lets you jump. Updates from scrollState each frame.
 */
export function Hud() {
  const [progress, setProgress] = useState(0)
  const [activeId, setActiveId] = useState<WorldId>('hub')
  const raf = useRef(0)

  useEffect(() => {
    const tick = () => {
      setProgress(scrollState.progress)
      setActiveId(worldAt(scrollState.progress).id)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  const active = worldAt(progress)

  const jump = (id: WorldId) => {
    // land a fixed distance BEFORE the banner (still approaching, fully lit) —
    // not at its exact anchor, which collapses to "just behind you" (invisible).
    scrollToProgress(JUMP_ANCHOR[id])
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      {/* top-left: identity — name/tagline fade out while the "Who I Am" banner
          (which already says this) is on screen, back in once you scroll past
          it. Email stays put — it's no longer repeated in the banner. */}
      <div className="absolute left-8 top-8 font-mono text-base tracking-widest text-[#e8e0cf]/80">
        <div
          className="transition-opacity duration-700 ease-out"
          style={{ opacity: activeId === 'hub' ? 0 : 1 }}
        >
          <div className="text-xl text-[#e8e0cf]">DAPHNE PERLMAN</div>
          <div className="text-sm text-[#e8e0cf]/50">designer · dev · artist · Scientist</div>
        </div>
        <a
          href="mailto:tech@citizencafetlv.com"
          className="hover-glow pointer-events-auto mt-2 inline-block font-mono text-xs tracking-[0.2em] text-[#e8e0cf]/60 uppercase"
        >
          Email ↗
        </a>
      </div>

      {/* top-right: current world */}
      <div className="absolute right-8 top-8 text-right">
        <div className="font-mono text-xs tracking-[0.3em] text-[#e8e0cf]/40">
          {active.index} / {String(WORLDS.length - 1).padStart(2, '0')}
        </div>
        <div
          className="font-mono text-xl tracking-[0.25em] transition-colors"
          style={{ color: active.accent }}
        >
          {active.label.toUpperCase()}
        </div>
      </div>

      {/* bottom center: world rail — fixed-width buttons so short ("WHO I AM")
          and long ("SCIENTIFIC GRAPHICS") labels still space out evenly */}
      <nav className="pointer-events-auto absolute bottom-8 left-1/2 flex -translate-x-1/2 justify-center gap-10">
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
                className="flex min-h-[2.25rem] flex-col items-center justify-center text-center font-mono text-xs leading-tight tracking-[0.2em] transition-opacity"
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

      {/* right edge: vertical progress */}
      <div className="absolute right-6 top-1/2 h-40 w-[2px] -translate-y-1/2 bg-[#e8e0cf]/10">
        <div
          className="w-full bg-[#e8e0cf]/70"
          style={{ height: `${progress * 100}%` }}
        />
      </div>

      {/* scroll hint, fades after you start */}
      <div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.3em] text-[#e8e0cf]/50 transition-opacity duration-500"
        style={{ opacity: progress > 0.01 ? 0 : 1 }}
      >
        SCROLL TO TRAVEL ↓
      </div>
    </div>
  )
}
