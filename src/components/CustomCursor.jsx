import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useTheme } from './providers/ExperienceProvider'

/**
 * CustomCursor — High-precision cyber forensic lens cursor.
 * Adapts seamlessly between Dark Mode (Electric Arbitrum Cyan glow) 
 * and Light Mode (Deep Indigo / Violet aura).
 */
export default function CustomCursor() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // Direct mouse coordinates for precise inner dot
  const mouseX = useMotionValue(-100)
  const mouseY = useMotionValue(-100)

  // Smooth trailing spring dynamics for outer target lens
  const ringX = useSpring(mouseX, { stiffness: 350, damping: 28, mass: 0.4 })
  const ringY = useSpring(mouseY, { stiffness: 350, damping: 28, mass: 0.4 })

  useEffect(() => {
    // Hide cursor on touch-only devices
    if (window.matchMedia('(pointer: coarse)').matches) {
      setIsTouchDevice(true)
      return
    }

    const onMouseMove = (e) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
      if (!isVisible) setIsVisible(true)

      const target = e.target
      if (target) {
        const interactive = target.closest(
          'a, button, input, textarea, select, label, [role="button"], .card-hover-glow, [data-cursor="hover"], .spotlight, .wallet-account-trigger'
        )
        setIsHovered(!!interactive)
      }
    }

    const onMouseDown = () => setIsClicked(true)
    const onMouseUp = () => setIsClicked(false)
    const onMouseLeave = () => setIsVisible(false)
    const onMouseEnter = () => setIsVisible(true)

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('mouseenter', onMouseEnter)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('mouseenter', onMouseEnter)
    }
  }, [mouseX, mouseY, isVisible])

  if (isTouchDevice || !isVisible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden" aria-hidden="true">
      {/* Outer Spring Lens Target Ring */}
      <motion.div
        style={{
          x: ringX,
          y: ringY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isClicked ? 0.75 : isHovered ? 1.6 : 1,
          opacity: isHovered ? 0.95 : 0.65,
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        className="absolute w-9 h-9 rounded-full flex items-center justify-center pointer-events-none"
      >
        <div
          className="w-full h-full rounded-full transition-all duration-200"
          style={{
            borderWidth: '1.5px',
            borderStyle: 'solid',
            borderColor: isDark
              ? (isHovered ? '#12AAFF' : 'rgba(18, 170, 255, 0.45)')
              : (isHovered ? '#6366f1' : 'rgba(99, 102, 241, 0.5)'),
            backgroundColor: isDark
              ? (isHovered ? 'rgba(18, 170, 255, 0.12)' : 'rgba(18, 170, 255, 0.03)')
              : (isHovered ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.04)'),
            boxShadow: isDark
              ? (isHovered ? '0 0 22px rgba(18, 170, 255, 0.55), inset 0 0 10px rgba(18, 170, 255, 0.2)' : '0 0 8px rgba(18, 170, 255, 0.15)')
              : (isHovered ? '0 0 22px rgba(99, 102, 241, 0.45), inset 0 0 10px rgba(99, 102, 241, 0.18)' : '0 0 8px rgba(99, 102, 241, 0.12)'),
          }}
        />

        {/* Tactical Crosshair Dot when hovering */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            className="absolute w-2 h-2 rounded-full pointer-events-none"
            style={{
              backgroundColor: isDark ? '#12AAFF' : '#6366f1',
              boxShadow: isDark ? '0 0 10px #12AAFF' : '0 0 10px #6366f1',
            }}
          />
        )}
      </motion.div>

      {/* Inner Direct Follower Dot */}
      <motion.div
        style={{
          x: mouseX,
          y: mouseY,
          translateX: '-50%',
          translateY: '-50%',
          backgroundColor: isDark ? '#12AAFF' : '#6366f1',
          boxShadow: isDark
            ? '0 0 8px #12AAFF, 0 0 16px rgba(18, 170, 255, 0.8)'
            : '0 0 8px #6366f1, 0 0 16px rgba(99, 102, 241, 0.6)',
        }}
        animate={{
          scale: isClicked ? 0.5 : isHovered ? 0 : 1,
          opacity: isHovered ? 0 : 1,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        className="absolute w-2 h-2 rounded-full pointer-events-none"
      />
    </div>
  )
}
