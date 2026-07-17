import { motion } from 'framer-motion'
import { useIntegrityTone } from './providers/ExperienceProvider'

/** Persistent, low-contrast motion layer used across the product surfaces. */
export default function AmbientBackground() {
  const { integrityTone } = useIntegrityTone()
  return (
    <div className={`ambient-background ambient-${integrityTone}`} aria-hidden="true">
      <div className="ambient-grid" />
      <motion.div
        className="ambient-orb ambient-orb-one"
        animate={{ x: [0, 80, -30, 0], y: [0, 50, 95, 0], scale: [1, 1.16, .92, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="ambient-orb ambient-orb-two"
        animate={{ x: [0, -70, 45, 0], y: [0, 75, 35, 0], scale: [1, .86, 1.12, 1] }}
        transition={{ duration: 27, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="ambient-orb ambient-orb-three"
        animate={{ x: [0, -60, 30, 0], y: [0, -45, 55, 0], scale: [.85, 1.08, .95, .85] }}
        transition={{ duration: 31, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="ambient-noise" />
    </div>
  )
}
