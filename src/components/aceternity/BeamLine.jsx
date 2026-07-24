import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * BeamLine — Animated horizontal beam (data flowing left to right)
 */
export function BeamLine({ className, color = '#12AAFF', duration = 2.5, delay = 0 }) {
  return (
    <div className={cn('relative h-px w-full overflow-hidden', className)} style={{ background: 'var(--border)' }}>
      <motion.div
        className="absolute top-0 left-0 h-full w-[40%]"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          boxShadow: `0 0 8px ${color}`,
          willChange: 'transform',
        }}
        initial={{ x: '-100%' }}
        animate={{ x: '250%' }}
        transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

/**
 * AnimatedBeam — Vertical beam connecting nodes
 */
export function AnimatedBeam({ className, color = '#12AAFF', duration = 2 }) {
  return (
    <div className={cn('relative w-px flex-1 overflow-hidden', className)} style={{ background: 'var(--border)' }}>
      <motion.div
        className="absolute top-0 left-0 w-full h-[30%]"
        style={{
          background: `linear-gradient(180deg, transparent, ${color}, transparent)`,
          boxShadow: `0 0 8px ${color}`,
          willChange: 'transform',
        }}
        initial={{ y: '-100%' }}
        animate={{ y: '333.3%' }}
        transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}
