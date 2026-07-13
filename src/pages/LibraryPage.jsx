/**
 * LibraryPage.jsx — Decentralized Content Registry Explorer
 * 
 * This page queries the smart contract's historical event logs directly 
 * from the Arbitrum Sepolia blockchain (using ethers.js queryFilter).
 * 
 * It extracts all `ContentRegistered` events emitted by the registry contract,
 * displaying an immutable, real-time list of all registered media assets, 
 * including their cryptographic hashes, visual perceptual hashes (pHash), 
 * owners, block timestamps, and AI model attributions.
 * 
 * Written for VeriTrace. Zero backend database dependencies.
 */
import { useState, useEffect } from 'react'
import HashDisplay from '../components/HashDisplay'
import { getContractEvents } from '@wagmi/core'
import { parseAbi } from 'viem'
import { config } from '../wagmiConfig'
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ARBITRUM_SEPOLIA,
} from '../config'

export default function LibraryPage() {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch all registrations from the blockchain logs on mount
  useEffect(() => {
    const fetchEventLogs = async () => {
      try {
        setLoading(true)
        setError(null)

        // 1. Query all historical "ContentRegistered" events
        const events = await getContractEvents(config, {
          address: CONTRACT_ADDRESS,
          abi: parseAbi(CONTRACT_ABI),
          eventName: 'ContentRegistered',
          fromBlock: 0n,
          toBlock: 'latest',
        })

        // 2. Map events to user-friendly registration entries
        const parsedLogs = events.map(event => {
          const args = event.args || {}
          return {
            sha256: args.sha256hash,
            creator: args.creator,
            phash: args.phash?.toString() || '0',
            timestamp: Number(args.timestamp || 0n),
            ipfsCid: args.ipfsCid || '',
            aiTool: args.aitool || '',
            txHash: event.transactionHash,
            blockNumber: Number(event.blockNumber),
          }
        })

        // Sort descending (newest registrations first)
        setRegistrations(parsedLogs.reverse())
      } catch (err) {
        console.error('Failed to query contract logs:', err)
        setError(`Failed to read on-chain registry: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    fetchEventLogs()
  }, [])

  /** Truncate address for safe display: 0x1234...abcd */
  const formatAddress = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  return (
    <section className="container" style={{ paddingTop: '1.5rem' }}>
      {/* Page Title */}
      <div className="page-title">
        <h1>On-Chain Asset Library</h1>
        <div className="page-title-sub">
          Immutable history of all registered media assets parsed directly from Arbitrum Sepolia logs
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert-box danger" style={{ marginBottom: '1.5rem' }}>
          <span>⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {/* ── Main content block ── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-header-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            Registered Assets ({registrations.length})
          </h2>
        </div>

        {/* ── Loading State ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div className="spinner" />
            <div style={{ fontWeight: 600, marginTop: '1rem' }}>Reading blockchain event log...</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Connecting to RPC node and querying Arbitrum Sepolia contract filters
            </div>
          </div>
        ) : registrations.length === 0 ? (
          /* ── Empty State ── */
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </div>
            <div className="empty-state-title">No assets registered yet</div>
            <div className="empty-state-text">
              Go to the Register tab to write the first cryptographic fingerprint to the contract!
            </div>
          </div>
        ) : (
          /* ── Data Table ── */
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cryptographic SHA-256</th>
                  <th>Visual pHash (Decimal)</th>
                  <th>Registrant Owner</th>
                  <th>AI Model</th>
                  <th>Date Anchored</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((item, idx) => (
                  <tr key={idx} className="animate-fade-in" style={{ animationDelay: `${idx * 40}ms` }}>
                    {/* SHA-256 hex display */}
                    <td>
                      <span className="hash-tag" title={item.sha256}>
                        {item.sha256.slice(0, 10)}...{item.sha256.slice(-8)}
                      </span>
                    </td>
                    
                    {/* Visual pHash */}
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--color-text)' }}>
                        {item.phash !== '0' ? item.phash : <span className="text-muted" style={{ fontStyle: 'italic' }}>None</span>}
                      </span>
                    </td>
                    
                    {/* Registrant Address */}
                    <td>
                      <a
                        href={`${ARBITRUM_SEPOLIA.explorer}/address/${item.creator}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="address-tag"
                      >
                        {formatAddress(item.creator)}
                      </a>
                    </td>

                    {/* AI Tool */}
                    <td>
                      {item.aiTool ? (
                        <span className="badge badge-info">{item.aiTool}</span>
                      ) : (
                        <span className="badge badge-success">Authentic</span>
                      )}
                    </td>

                    {/* Block Timestamp */}
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                        {new Date(item.timestamp * 1000).toLocaleString()}
                      </span>
                    </td>

                    {/* Explorer Tx Link */}
                    <td>
                      <a
                        href={`${ARBITRUM_SEPOLIA.explorer}/tx/${item.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline"
                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.6875rem' }}
                      >
                        View Tx ↗
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
