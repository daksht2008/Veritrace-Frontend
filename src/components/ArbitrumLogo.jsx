import { motion } from 'framer-motion'

/**
 * ArbitrumLogo — Official Arbitrum star logo
 */
export function ArbitrumLogo({ size = 24, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3.5 20.5L9.5 3.5H14.5L20.5 20.5H16.5L15.3 17H8.7L7.5 20.5H3.5ZM9.9 13.7H14.1L12 7.2L9.9 13.7Z" fill="#12AAFF"/>
    </svg>
  )
}

/**
 * VeriTraceLogo — Combined VeriTrace + Arbitrum logo
 */
export function VeriTraceLogo({ size = 32, className }) {
  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div className="relative">
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
          <defs>
            <linearGradient id="vt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#12AAFF" />
              <stop offset="100%" stopColor="#1B4ADD" />
            </linearGradient>
          </defs>
          <path
            d="M16 2L28 7V17C28 23.5 22.5 28.5 16 30C9.5 28.5 4 23.5 4 17V7L16 2Z"
            fill="url(#vt-grad)"
            style={{ filter: 'drop-shadow(0 2px 8px rgba(18,170,255,0.3))' }}
          />
          <path d="M10 16L14.5 20.5L22 13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

/**
 * AnimatedArbitrumOrbit — Orbiting Arbitrum logos around content
 */
export function ArbitrumOrbit({ size = 200, className }) {
  return (
    <div className={`relative ${className || ''}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 arb-ring" />
      <div className="absolute inset-[15%] arb-ring" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />

      {/* Orbiting logos */}
      {[0, 120, 240].map((angle, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2"
          style={{ '--radius': `${size / 2 - 12}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 20 + i * 5, repeat: Infinity, ease: 'linear' }}
        >
          <div
            style={{
              transform: `rotate(${angle}deg) translateX(${size / 2 - 12}px) rotate(-${angle}deg)`,
            }}
          >
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 20 + i * 5, repeat: Infinity, ease: 'linear' }}
            >
              <ArbitrumLogo size={20} />
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
