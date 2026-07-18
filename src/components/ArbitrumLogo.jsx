import { motion } from 'framer-motion'

/** ArbitrumLogo — official "A" mark with optional animated glow */
export function ArbitrumLogo({ size = 24, className, animated = false }) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      animate={animated ? { filter: ['drop-shadow(0 0 4px #12AAFF60)', 'drop-shadow(0 0 10px #12AAFF90)', 'drop-shadow(0 0 4px #12AAFF60)'] } : undefined}
      transition={animated ? { duration: 2.5, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      <path d="M3.5 20.5L9.5 3.5H14.5L20.5 20.5H16.5L15.3 17H8.7L7.5 20.5H3.5ZM9.9 13.7H14.1L12 7.2L9.9 13.7Z" fill="#12AAFF" />
    </motion.svg>
  )
}

/** VeriTraceLogo — shield with checkmark */
export function VeriTraceLogo({ size = 32, className }) {
  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: 'drop-shadow(0 2px 10px rgba(18,170,255,0.22))' }}
      >
        <defs>
          <linearGradient id="vt-logo-grad" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#58d5ff" />
            <stop offset="50%" stopColor="#12AAFF" />
            <stop offset="100%" stopColor="#1b4add" />
          </linearGradient>
        </defs>

        {/* Left Leg (White / CurrentColor) */}
        <path
          d="M26 26.5 H40 L47.5 56.5 H33.5 Z"
          fill="currentColor"
        />

        {/* Right Leg / Checkmark (Blue Gradient) */}
        <path
          d="M38 42 H45 L48 54 L73 26.5 H61.5 L48 47.5 L38 42 Z"
          fill="url(#vt-logo-grad)"
        />

        {/* Floating Digital Pixel Dispersion */}
        <rect x="66" y="24" width="3" height="3" fill="#58d5ff" />
        <rect x="70" y="21" width="3" height="3" fill="#12AAFF" />
        <rect x="74" y="25" width="2" height="2" fill="#58d5ff" />
        <rect x="64" y="20" width="2" height="2" fill="#1B4ADD" opacity="0.8" />
        <rect x="72" y="18" width="2.5" height="2.5" fill="#58d5ff" />
        <rect x="67" y="28" width="2" height="2" fill="#12AAFF" />
        <rect x="76" y="21" width="2" height="2" fill="#58d5ff" />
        <rect x="69" y="16" width="1.5" height="1.5" fill="#12AAFF" />
        <rect x="71" y="25" width="1.8" height="1.8" fill="#1B4ADD" />
        <rect x="65" y="25" width="2" height="2" fill="#12AAFF" />
      </svg>
    </div>
  )
}

/** AnimatedArbitrumBadge — pill badge with rotating ring + glow */
export function AnimatedArbitrumBadge({ text }) {
  return (
    <div className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(18,170,255,0.1)', border: '1px solid rgba(18,170,255,0.3)' }}>
      {/* Animated rotating ring behind logo */}
      <div className="relative w-5 h-5 flex items-center justify-center flex-shrink-0">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: '1.5px solid rgba(18,170,255,0.5)', borderTopColor: '#12AAFF', borderRightColor: 'transparent' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
        <ArbitrumLogo size={12} animated />
      </div>
      <span style={{ color: '#12AAFF' }}>{text}</span>
    </div>
  )
}

/** AnimatedNetworkBadge — live dot with pulse for network status */
export function AnimatedNetworkBadge({ text }) {
  return (
    <div className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'rgba(0,211,149,0.1)', border: '1px solid rgba(0,211,149,0.3)' }}>
      <div className="relative w-4 h-4 flex items-center justify-center flex-shrink-0">
        {/* Expanding ring pulse */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'rgba(0,211,149,0.3)' }}
          animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="w-2 h-2 rounded-full bg-[#00D395] shadow-[0_0_8px_#00D395] flex-shrink-0" />
      </div>
      <span style={{ color: '#00D395' }}>{text}</span>
    </div>
  )
}

/** ArbitrumOrbit — concentric orbit rings */
export function ArbitrumOrbit({ size = 200, className }) {
  return (
    <div className={`relative ${className || ''}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 arb-ring" />
      <div className="absolute inset-[15%] arb-ring" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
      {[0, 120, 240].map((angle, i) => (
        <motion.div key={i} className="absolute top-1/2 left-1/2" animate={{ rotate: 360 }} transition={{ duration: 20 + i * 5, repeat: Infinity, ease: 'linear' }}>
          <div style={{ transform: `rotate(${angle}deg) translateX(${size / 2 - 12}px) rotate(-${angle}deg)` }}>
            <motion.div animate={{ rotate: -360 }} transition={{ duration: 20 + i * 5, repeat: Infinity, ease: 'linear' }}>
              <ArbitrumLogo size={20} animated />
            </motion.div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
