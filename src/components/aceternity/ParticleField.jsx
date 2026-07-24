import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '../providers/ExperienceProvider'

/**
 * ParticleField — Canvas-based animated particle network
 * Highly optimized: uses useTheme hook to avoid DOM queries in the render loop,
 * pre-parses colors to integers once, and uses rgba string template to avoid hex conversion GC pressure.
 */
export function ParticleField({ className, density = 50, color = '#12AAFF' }) {
  const canvasRef = useRef(null)
  const { theme } = useTheme()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let particles = []

    // Pre-parse hex color to RGB integers
    const hex = color.replace('#', '')
    const r = parseInt(hex.substring(0, 2), 16) || 18
    const g = parseInt(hex.substring(2, 4), 16) || 170
    const b = parseInt(hex.substring(4, 6), 16) || 255
    const opacityBase = theme === 'dark' ? 0.5 : 0.25
    const fillStyleStr = `rgba(${r}, ${g}, ${b}, ${theme === 'dark' ? '0.37' : '0.25'})`

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.offsetWidth
      canvas.height = parent.offsetHeight
      particles = Array.from({ length: density }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p, i) => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = fillStyleStr
        ctx.fill()

        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x
          const dy = p.y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(particles[j].x, particles[j].y)
            const alpha = (opacityBase * (1 - dist / 120)).toFixed(2)
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })
      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [density, color, theme])

  return (
    <canvas
      ref={canvasRef}
      className={cn('absolute inset-0 pointer-events-none', className)}
    />
  )
}
