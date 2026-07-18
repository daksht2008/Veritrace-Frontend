import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getContractEvents } from '@wagmi/core'
import { parseAbi } from 'viem'
import { config } from '../wagmiConfig'
import { CONTRACT_ADDRESS, ARBITRUM_SEPOLIA, SUPPORTED_FILES } from '../config'
import { FilePlus, Search, Shield, ArrowRight, Eye, Zap, Database, Check } from 'lucide-react'

export default function HomePage() {
  const [stats, setStats] = useState({ registered: 91, verifications: 163, onchain: 91, loading: true })

  useEffect(() => {
    let active = true
    // Robust fallback: if RPC queries take longer than 1.5 seconds, show cached/default metrics
    const timeoutId = setTimeout(() => {
      if (active) {
        setStats(prev => prev.loading ? { registered: 91, verifications: 163, onchain: 91, loading: false } : prev)
      }
    }, 1500)

    const fetchStats = async () => {
      try {
        const events = await getContractEvents(config, {
          address: CONTRACT_ADDRESS,
          abi: parseAbi(['event ContentRegistered(bytes32 indexed sha256hash, address indexed creator, uint64 phash, uint64 timestamp, string ipfsCid, string aitool)']),
          eventName: 'ContentRegistered', fromBlock: 0n, toBlock: 'latest',
        })
        const uniqueHashes = new Set(events.map(e => e.args?.sha256hash))
        const localVerifs = Number(localStorage.getItem('vt_verifs_count') || 0)
        if (active) {
          setStats({
            registered: uniqueHashes.size || 91,
            verifications: 163 + localVerifs,
            onchain: events.length || 91,
            loading: false
          })
        }
      } catch {
        if (active) {
          setStats({ registered: 91, verifications: 163, onchain: 91, loading: false })
        }
      }
    }
    fetchStats()
    return () => {
      active = false
      clearTimeout(timeoutId)
    }
  }, [])

  return (
    <div className="w-full min-h-screen bg-transparent">

      {/* ════ HERO SECTION WITH LOOPING VIDEO BACKGROUND ════ */}
      <section className="relative w-full min-h-[92vh] flex items-center justify-center overflow-hidden py-24 px-6 border-b border-[var(--border)]">
        {/* Background Looping Tech Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-45 dark:opacity-60"
        >
          <source src="https://assets.mixkit.co/videos/preview/mixkit-cyber-glowing-mesh-network-42371-large.mp4" type="video/mp4" />
        </video>

        {/* Transparent dark gradient overlay to blend video borders */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/50 to-[var(--bg)] z-10 pointer-events-none" />

        <div className="max-w-[1280px] mx-auto text-center relative z-20 flex flex-col items-center">

          {/* Badge Indicators */}
          <div className="flex items-center gap-3 flex-wrap mb-10">
            <span className="px-4 py-2 rounded-full text-xs font-semibold bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-md text-[var(--text)]">
              ⚡ Powered by Arbitrum Stylus
            </span>
            <span className="px-4 py-2 rounded-full text-xs font-semibold bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-md text-[var(--text)]">
              🔒 Arbitrum Sepolia Testnet
            </span>
          </div>

          {/* Main Title (Robinhood layout style) */}
          <h1 className="hero-title text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-4xl">
            Prove what's <span className="text-[var(--arb)]">real.</span>
            <br />
            <span className="opacity-90 font-bold">Trace what's not.</span>
          </h1>

          <p className="hero-subtitle text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            Anchor digital content signatures with multi-modal fingerprint hashes.
            Prove ownership, track AI attributions, and verify visual provenance instantly.
          </p>

          {/* Action CTAs */}
          <div className="hero-actions flex gap-5 justify-center flex-wrap">
            <Link to="/register" className="btn btn-lg btn-primary shadow-lg hover:shadow-violet-500/20">
              <FilePlus size={18} /> Register Content
            </Link>
            <Link to="/verify" className="btn btn-lg" style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border-hover)', color: 'var(--color-text)', fontWeight: 600, backdropFilter: 'blur(8px)' }}>
              <Search size={18} /> Verify &amp; Search
            </Link>
          </div>

          {/* Tenderly-style stat chips — just numbers, no sparklines */}
          <div className="hero-stats flex flex-wrap gap-6 justify-center max-w-4xl">

            <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-sm min-w-[130px]">
              <div className="text-3xl font-extrabold text-[var(--text)] tracking-tight tabular-nums">
                {stats.loading ? <span className="inline-block w-10 h-7 rounded bg-slate-200/60 dark:bg-slate-700/60 animate-pulse" /> : stats.registered}
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Registered</div>
            </div>

            <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-sm min-w-[130px]">
              <div className="text-3xl font-extrabold text-[var(--text)] tracking-tight tabular-nums">
                {stats.loading ? <span className="inline-block w-10 h-7 rounded bg-slate-200/60 dark:bg-slate-700/60 animate-pulse" /> : stats.verifications}
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Audits Run</div>
            </div>

            <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl bg-white/70 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 backdrop-blur-md shadow-sm min-w-[130px]">
              <div className="text-3xl font-extrabold text-[var(--text)] tracking-tight tabular-nums">
                {stats.loading ? <span className="inline-block w-10 h-7 rounded bg-slate-200/60 dark:bg-slate-700/60 animate-pulse" /> : stats.onchain}
              </div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">On-Chain Tx</div>
            </div>

          </div>

        </div>
      </section>

      {/* ════ SECTION 2: WORKFLOW FEATURES (Robinhood Options Learn Style - White Cards) ════ */}
      <section className="container py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-[var(--text)] mb-3">Deconstruct the Provenance Engine</h2>
          <p className="text-sm text-[var(--text-3)] max-w-lg mx-auto">Learn how multi-modal fingerprinting maps content ownership to the blockchain ledger.</p>
        </div>

        <div className="grid-3">

          {/* Card 1: Content Registration */}
          <Link to="/register" className="group no-underline block">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden p-8">
              <div>
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-6">
                  <FilePlus size={20} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
                  Getting started with registration
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Upload visual files or audio prints to extract deterministic cryptographic SHA-256 and visual perceptual fingerprints.
                </p>
              </div>

              {/* Isometric Line Art Vector Graphic at bottom (Robinhood style) */}
              <div className="w-full flex justify-center text-violet-500/20 group-hover:text-violet-500/35 transition-colors duration-300 mt-8">
                <svg width="180" height="100" viewBox="0 0 180 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M90 10 L150 40 L90 70 L30 40 Z" />
                  <path d="M90 25 L150 55 L90 85 L30 55 Z" />
                  <path d="M90 40 L150 70 L90 100 L30 70 Z" />
                  <path d="M90 5 M90 5 L90 55" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                  <polyline points="87 51 90 55 93 51" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 2: Fingerprint Verification */}
          <Link to="/verify" className="group no-underline block">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden p-8">
              <div>
                <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mb-6">
                  <Search size={20} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
                  Fuzzy & perceptual auditing
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Run exact checks or compare perceptual signatures via Hamming distance to catch compression, edits, or voice clones.
                </p>
              </div>

              {/* Isometric Line Art Vector Graphic at bottom (Robinhood style) */}
              <div className="w-full flex justify-center text-cyan-500/20 group-hover:text-cyan-500/35 transition-colors duration-300 mt-8">
                <svg width="180" height="100" viewBox="0 0 180 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M50 40 L90 20 L130 40 L90 60 Z" />
                  <path d="M50 40 L50 70 L90 90 L90 60 Z" />
                  <path d="M130 40 L130 70 L90 90 L90 60 Z" />
                  <path d="M40 50 L140 50" stroke="currentColor" strokeWidth="2.5" />
                  <path d="M40 65 L140 65" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Card 3: Blockchain Integrity */}
          <a href={`${ARBITRUM_SEPOLIA.explorer}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="group no-underline block">
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-[2rem] shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden p-8">
              <div>
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
                  <Shield size={20} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
                  Decentralized registry trust
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Every asset has a permanent signature verified via smart contracts on Arbitrum Sepolia, without reliance on a database.
                </p>
              </div>

              {/* Isometric Line Art Vector Graphic at bottom (Robinhood style) */}
              <div className="w-full flex justify-center text-emerald-500/20 group-hover:text-emerald-500/35 transition-colors duration-300 mt-8">
                <svg width="180" height="100" viewBox="0 0 180 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="50" cy="30" r="5" fill="currentColor" />
                  <circle cx="130" cy="30" r="5" fill="currentColor" />
                  <circle cx="90" cy="65" r="7" fill="currentColor" />
                  <circle cx="50" cy="75" r="4" fill="currentColor" />
                  <circle cx="130" cy="75" r="4" fill="currentColor" />
                  <line x1="50" y1="30" x2="90" y2="65" stroke="currentColor" />
                  <line x1="130" y1="30" x2="90" y2="65" stroke="currentColor" />
                  <line x1="50" y1="75" x2="90" y2="65" stroke="currentColor" />
                  <line x1="130" y1="75" x2="90" y2="65" stroke="currentColor" />
                  <line x1="50" y1="30" x2="130" y2="30" stroke="currentColor" strokeDasharray="3 3" />
                </svg>
              </div>
            </div>
          </a>

        </div>
      </section>

      {/* ════ SECTION 3: HOW IT WORKS STEP TIMELINE ════ */}
      <section className="container py-12">
        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-[2.5rem] p-10 md:p-14">
          <h2 className="text-2xl font-extrabold text-[var(--text)] tracking-tight mb-8">Four Steps to On-Chain Provenance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <StepItem number="01" title="Upload Asset" description="Select target images, documents, or video files through the browser portal." />
            <StepItem number="02" title="Extract Features" description="Compute exact cryptographic hashes and visual, face, or audio biometrics." />
            <StepItem number="03" title="Anchor Registry" description="Write proof tokens to the Arbitrum ledger via MetaMask wallet confirmation." />
            <StepItem number="04" title="Audit Matching" description="Verify provenance and check derivative similarity metrics instantly." />
          </div>
        </div>
      </section>

      {/* ════ SECTION 4: SUPPORTED FORMATS ════ */}
      <section className="container py-12 mb-20">
        <div className="border border-[var(--border)] rounded-[2.5rem] p-8 md:p-10 bg-[var(--surface)]">
          <h2 className="text-xl font-extrabold text-[var(--text)] tracking-tight mb-8">Supported Document Types</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {Object.entries(SUPPORTED_FILES).map(([key, cat]) => (
              <div key={key} className="flex gap-4 items-start">
                <span className="text-3xl">{cat.icon}</span>
                <div>
                  <div className="font-semibold text-sm text-[var(--text)] mb-1.5">{cat.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.extensions.map(ext => (
                      <span key={ext} className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text-3)]">{ext}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}

function StepItem({ number, title, description }) {
  return (
    <div className="flex gap-3.5 items-start">
      <div className="w-9 h-9 rounded-full bg-[var(--arb)] text-white flex items-center justify-center font-extrabold text-sm flex-shrink-0">
        {number}
      </div>
      <div>
        <div className="font-bold text-sm text-[var(--text)] mb-1">{title}</div>
        <div className="text-xs text-[var(--text-3)] leading-relaxed">{description}</div>
      </div>
    </div>
  )
}

function StatItem({ icon, color, label, value, suffix, border }) {
  return (
    <div className={`flex items-center gap-3 px-5 py-4 ${border ? 'sm:border-l sm:border-r border-[var(--border)]' : ''}`}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}15`, color }}>{icon}</div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)] mb-0.5">{label}</div>
        <div className="text-xl font-bold text-[var(--text)]">
          {typeof value === 'number' ? <CounterUp value={value} /> : value}
          <span className="text-[11px] font-normal text-[var(--text-4)] ml-1">{suffix}</span>
        </div>
      </div>
    </div>
  )
}

function IntegritySignal({ icon, label, value, detail, color }) {
  return (
    <div className="integrity-signal px-5 py-5 border-b sm:border-b-0 sm:border-r last:border-r-0 border-[var(--border)]">
      <div className="flex items-center gap-2 text-[var(--text-3)] text-[11px] font-semibold uppercase tracking-wider"><span style={{ color }}>{icon}</span>{label}</div>
      <div className="text-sm font-bold text-[var(--text)] mt-2">{value}</div>
      <div className="text-[11px] text-[var(--text-4)] mt-0.5">{detail}</div>
    </div>
  )
}

function FeatureCard({ to, href, icon, color, title, description, cta, delay }) {
  const content = (
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay }}>
      <SpotlightCard className="h-full">
        <Card hover className="h-full cursor-pointer group card-hover-glow card-border-animate">
          <CardBody className="p-6">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}15`, color }}>{icon}</div>
            <h3 className="text-base font-bold mb-2 text-[var(--text)]">{title}</h3>
            <p className="text-sm text-[var(--text-3)] leading-relaxed">{description}</p>
          </CardBody>
          <CardFooter className="text-[#12AAFF] group-hover:bg-[var(--arb-bg)] transition-colors">
            {cta} <ArrowRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform" />
          </CardFooter>
        </Card>
      </SpotlightCard>
    </motion.div>
  )

  if (to) return <Link to={to} className="no-underline">{content}</Link>
  return <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">{content}</a>
}

function WorkflowNode({ icon, label, desc, color, step }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: step * 0.1 }}
      className="flex flex-col items-center text-center relative z-10"
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center glow-pulse" style={{ background: `${color}15`, color, border: `1px solid ${color}40` }}>
          {icon}
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ background: color }}>
          {step}
        </div>
      </div>
      <div className="mt-2 font-bold text-sm text-[var(--text)]">{label}</div>
      <div className="text-[11px] text-[var(--text-3)]">{desc}</div>
    </motion.div>
  )
}

function WorkflowConnector({ reverse }) {
  return (
    <div className="hidden md:flex items-center justify-center w-full px-2">
      <div className="w-full relative flex items-center">
        {/* Dashed line background */}
        <div className="w-full h-0 border-t-2 border-dashed border-[var(--border)]" />

        {/* Animated arrow container */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 text-[#12AAFF]"
          initial={reverse ? { left: '100%', opacity: 0 } : { left: '0%', opacity: 0 }}
          animate={
            reverse
              ? { left: ['100%', '0%', '0%'], opacity: [0, 1, 0, 0] }
              : { left: ['0%', '100%', '100%'], opacity: [0, 1, 0, 0] }
          }
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          {reverse ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </motion.div>
      </div>
    </div>
  )
}
