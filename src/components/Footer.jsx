import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CONTRACT_ADDRESS, ARBITRUM_SEPOLIA } from '../config'
import { VeriTraceLogo } from './ArbitrumLogo'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

// Inline SVG component for Twitter (X) to avoid trademark icon issues
function TwitterIcon({ size = 20, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export default function Footer() {
  const [isHighlighted, setIsHighlighted] = useState(false)

  return (
    <footer className="border-t border-[var(--border)] bg-[#090a0f] backdrop-blur-xl mt-16 overflow-hidden">
      <div className="max-w-[1280px] mx-auto px-6 pt-16 pb-10">
        {/* Responsive grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Column 1: Pages */}
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] mb-4">Pages</h3>
            <ul className="flex flex-col gap-2.5">
              <li><Link to="/" className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors">Home</Link></li>
              <li><Link to="/register" className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors">Register</Link></li>
              <li><Link to="/verify" className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors">Verify</Link></li>
              <li><Link to="/library" className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors">Library</Link></li>
              <li><Link to="/about" className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors">About</Link></li>
              <li><Link to="/profile" className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors">Profile</Link></li>
              <li><Link to="/enterprise" className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors">Enterprise</Link></li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div>
            <h3 className="text-sm font-bold text-[var(--text)] mb-4">Resources</h3>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a 
                  href={`${ARBITRUM_SEPOLIA.explorer}/address/${CONTRACT_ADDRESS}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> Contract on Arbiscan
                </a>
              </li>
              <li>
                <a 
                  href="https://www.arbitrum.io/" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm text-[var(--text-3)] hover:text-[#12AAFF] transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> Arbitrum.io
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Brand Logo, Description, Socials */}
          <div className="md:pl-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-[0_2px_10px_rgba(255,255,255,0.1)]">
                <VeriTraceLogo size={18} className="text-black" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">VeriTrace</span>
            </div>
            <p className="text-sm text-[var(--text-3)] mb-6 leading-relaxed max-w-[280px]">
              Decentralized authenticity verification and multi-modal digital fingerprinting. Built on Arbitrum.
            </p>
            <div className="flex items-center gap-4 text-[var(--text-3)]">
              <a
                href="https://x.com/veritrace_arb"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#12AAFF] transition-colors hover:scale-110 duration-200"
                aria-label="X (formerly Twitter)"
              >
                <TwitterIcon size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* Center copyright & contract */}
        <div className="mt-12 pt-8 border-t border-[var(--border)] flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-[var(--text-3)]">
            © {new Date().getFullYear()} VeriTrace. All rights reserved.
          </p>
          <p className="text-[10px] font-mono text-[var(--text-4)] break-all max-w-lg">
            Contract: {CONTRACT_ADDRESS}
          </p>
        </div>
      </div>

      {/* Giant Bottom Highlight Brand Title */}
      <div 
        onClick={() => setIsHighlighted(!isHighlighted)}
        className="w-full flex justify-center overflow-hidden h-[9vw] cursor-pointer select-none mt-8 border-t border-[var(--border)] pt-8 relative animate-duration-500"
      >
        <div 
          className={cn(
            "text-[15vw] font-black leading-[0.75] tracking-tighter transition-all duration-700 ease-out select-none",
            isHighlighted 
              ? "text-[#12AAFF] [text-shadow:0_0_30px_rgba(18,170,255,0.75),0_0_60px_rgba(18,170,255,0.4)] opacity-100" 
              : "text-[var(--text-4)] dark:text-[#161b22] opacity-20 hover:opacity-40"
          )}
        >
          VERITRACE
        </div>
      </div>
    </footer>
  )
}
