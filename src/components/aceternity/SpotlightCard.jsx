import { useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * SpotlightCard — Aceternity-style mouse-follow radial spotlight
 * Highly optimized: uses CSS variables for position and opacity to bypass React re-renders,
 * and caches the bounding rect on mouse enter to avoid layout thrashing.
 */
export function SpotlightCard({ children, className, spotlightColor = 'rgba(18,170,255,0.12)' }) {
  const divRef = useRef(null)
  const rectRef = useRef(null)

  const handleMouseEnter = () => {
    if (divRef.current) {
      rectRef.current = divRef.current.getBoundingClientRect()
      divRef.current.style.setProperty('--opacity', '1')
    }
  }

  const handleMouseMove = (e) => {
    if (!rectRef.current && divRef.current) {
      rectRef.current = divRef.current.getBoundingClientRect()
    }
    if (!rectRef.current || !divRef.current) return
    const x = e.clientX - rectRef.current.left
    const y = e.clientY - rectRef.current.top
    divRef.current.style.setProperty('--x', `${x}px`)
    divRef.current.style.setProperty('--y', `${y}px`)
  }

  const handleMouseLeave = () => {
    if (divRef.current) {
      divRef.current.style.setProperty('--opacity', '0')
    }
  }

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn('spotlight group relative isolate', className)}
      style={{
        '--spotlight-color': spotlightColor,
        '--opacity': 0,
        '--x': '0px',
        '--y': '0px',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] transition-opacity duration-300"
        style={{
          opacity: 'var(--opacity)',
          background: `radial-gradient(300px circle at var(--x) var(--y), var(--spotlight-color), transparent 70%)`,
        }}
      />
      <div className="relative z-20 h-full">{children}</div>
    </div>
  )
}
