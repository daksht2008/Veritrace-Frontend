/**
 * Navbar.jsx — Primary navigation + MetaMask wallet connection
 * 
 * Features:
 * - VeriTrace brand logo linking to home
 * - Navigation links to Home, Register, Verify pages
 * - Live MetaMask wallet connect button (uses window.ethereum directly)
 * - Sticky positioning with scroll shadow effect
 * - Mobile hamburger toggle for responsive breakpoints
 * 
 * The WalletButton component manages the full MetaMask lifecycle:
 * 1. Checks for existing connection on mount (eth_accounts)
 * 2. Requests connection on click (eth_requestAccounts)
 * 3. Listens for live account changes (accountsChanged event)
 * 4. Also switches network to Arbitrum Sepolia if needed
 */
import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { ARBITRUM_SEPOLIA } from '../config'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import ThemeToggle from './ThemeToggle'

export default function Navbar() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // ── Track scroll position for shadow effect ──
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // ── Close mobile nav on route change ──
  useEffect(() => {
    setMobileOpen(false)
  }, [location])

  /** Check if the given path matches current route */
  const isActive = (path) => location.pathname === path

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="container">
        {/* ── Brand logo ── */}
        <Link to="/" className="navbar-brand" style={{ gap: '0.65rem' }}>
          <LogoIcon size={32} />
          <span style={{ fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, var(--color-text) 30%, var(--color-accent) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>VeriTrace</span>
        </Link>

        {/* ── Navigation links ── */}
        <ul className={`navbar-nav ${mobileOpen ? 'open' : ''}`}>
          <li>
            <Link to="/" className={`nav-link ${isActive('/') ? 'active' : ''}`}>
              Home
            </Link>
          </li>
          <li>
            <Link to="/register" className={`nav-link ${isActive('/register') ? 'active' : ''}`}>
              {/* File-plus icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Register
            </Link>
          </li>
          <li>
            <Link to="/verify" className={`nav-link ${isActive('/verify') ? 'active' : ''}`}>
              {/* Search icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              Verify
            </Link>
          </li>
          <li>
            <Link to="/library" className={`nav-link ${isActive('/library') ? 'active' : ''}`}>
              {/* Document/list icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              Library
            </Link>
          </li>
          <li>
            <Link to="/about" className={`nav-link ${isActive('/about') ? 'active' : ''}`}>
              {/* Info circle icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              About
            </Link>
          </li>
        </ul>

        {/* ── Wallet + Mobile Toggle ── */}
        <div className="nav-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
          <WalletButton />
          <button
            className="nav-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </nav>
  )
}

/**
 * WalletButton — Connects to MetaMask and displays the user's address.
 * 
 * When clicked:
 * 1. Checks if MetaMask (window.ethereum) is installed
 * 2. Calls eth_requestAccounts to trigger the MetaMask popup
 * 3. Attempts to switch to Arbitrum Sepolia network
 * 4. Stores the connected account address in local state
 */
function WalletButton() {
  const { address, isConnected, chain } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain } = useSwitchChain()

  // ── Automatically switch to Arbitrum Sepolia if connected to a different network ──
  useEffect(() => {
    if (isConnected && (!chain || chain.id !== ARBITRUM_SEPOLIA.chainId)) {
      switchChain({ chainId: ARBITRUM_SEPOLIA.chainId })
    }
  }, [isConnected, chain, switchChain])

  const [showDropdown, setShowDropdown] = useState(false)

  const handleMainClick = () => {
    if (isConnected) {
      disconnect()
    } else {
      setShowDropdown(!showDropdown)
    }
  }

  const handleConnect = (connector) => {
    connect({ connector })
    setShowDropdown(false)
  }

  /** Truncate address for display: 0x1234...abcd */
  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <div style={{ position: 'relative' }}>
      <button
        className={`btn btn-wallet ${isConnected ? 'connected' : ''}`}
        onClick={handleMainClick}
      >
        {isConnected && address ? (
          <>
            {/* User icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            {formatAddress(address)}
          </>
        ) : (
          <>
            {/* Wallet icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="14" rx="2"/>
              <path d="M22 10H2"/>
            </svg>
            Connect Wallet
          </>
        )}
      </button>

      {!isConnected && showDropdown && (
        <div 
          className="wallet-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px',
            boxShadow: 'var(--shadow-md)',
            zIndex: 100,
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => handleConnect(connector)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '10px 16px',
                textAlign: 'left',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: 'var(--color-text)',
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.2s ease, color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-accent-bg)'
                e.currentTarget.style.color = 'var(--color-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text)'
              }}
            >
              {/* Optional dynamic icon for the wallet can be added here if available in connector.icon */}
              {connector.icon && <img src={connector.icon} alt={connector.name} style={{ width: 20, height: 20 }} />}
              {connector.name}
            </button>
          ))}
          {connectors.length === 0 && (
            <div style={{ padding: '8px', fontSize: '14px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
              No wallets found
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function LogoIcon({ size = 30, className = "" }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--logo-grad-start)" />
          <stop offset="100%" stopColor="var(--logo-grad-stop)" />
        </linearGradient>
      </defs>
      
      {/* Outer shield structure */}
      <path 
        d="M16 2.5 L26.5 6 C26.5 16.5, 20.5 24.5, 16 29.5 C11.5 24.5, 5.5 16.5, 5.5 6 Z" 
        fill="url(#logo-grad)"
        style={{ filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.15))' }}
      />
      
      {/* Inside checkmark */}
      <path 
        d="M11 16 L14.5 19.5 L21.5 12" 
        stroke="white" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      
      {/* Visual scanning line */}
      <line 
        x1="7" 
        y1="16" 
        x2="25" 
        y2="16" 
        stroke="rgba(255, 255, 255, 0.25)" 
        strokeWidth="1.2" 
        strokeDasharray="2,2" 
      />
    </svg>
  )
}
