import { useEffect, useRef } from 'react'
import { scrollState } from '../lib/scroll'
import { worldAt } from '../scene/curve'

/**
 * A soft phosphor glow that trails the real cursor, using the exact same
 * drop-shadow recipe as .hover-glow:hover — so the cursor itself feels like
 * part of the CRT system, not a separate OS artifact. Tints to whichever
 * section's accent is currently active (amber in Web Design & Dev, etc).
 */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)
  const pos = useRef({ x: -999, y: -999 })
  const raf = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onMove = (e: MouseEvent) => {
      pos.current.x = e.clientX
      pos.current.y = e.clientY
      el.style.opacity = '1'
    }
    const onLeave = () => {
      el.style.opacity = '0'
    }

    window.addEventListener('mousemove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)

    const tick = () => {
      el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%)`
      el.style.setProperty('--glow-color', worldAt(scrollState.progress).accent)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  return <div ref={ref} className="cursor-glow" aria-hidden />
}
