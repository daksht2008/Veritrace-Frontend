/**
 * VerifyPage.jsx — Verification and Search Engine Flow
 * 
 * This page performs a comprehensive check for content authenticity by running:
 * 1. Local SHA-256 Hash Generation:
 *    Uses the browser's native Web Crypto API to generate the SHA-256 checksum of the file locally.
 * 2. On-Chain Smart Contract Lookup (Arbitrum Sepolia):
 *    Directly queries the deployed `verifyContent` read-only method on the Stylus contract 
 *    using ethers.js (via Metamask or a public JSON-RPC fallback provider).
 * 3. Fuzzy Match & Similarity Search (Hash Engine API):
 *    Posts the file to the Hash Engine backend to compute its perceptual visual signature (pHash) 
 *    and query the database for visually similar derivatives (Hamming distance match).
 * 
 * Deployed Contract: 0x468edc5b2fe9d1c919f2377cbe0ccb16f32ead29
 */
import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import HashDisplay from '../components/HashDisplay'
import SearchResults from '../components/SearchResults'
import { useUpload } from '../context/UploadContext'
import { readContract, getContractEvents } from '@wagmi/core'
import { parseAbi } from 'viem'
import { config } from '../wagmiConfig'
import {
  HASH_ENGINE_API,
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ARBITRUM_SEPOLIA,
  CORE_BACKEND_API,
} from '../config'

export default function VerifyPage() {
  // ── Access persisted global state from UploadContext ──
  const {
    verFile: file, setVerFile: setFile,
    verLoading: loading, setVerLoading: setLoading,
    verUploadProgress: uploadProgress, setVerUploadProgress: setUploadProgress,
    verError: error, setVerError: setError,
    verLocalSha256: localSha256, setVerLocalSha256: setLocalSha256,
    verPhash: phash, setVerPhash: setPhash,
    verBlockchainRecord: blockchainRecord, setVerBlockchainRecord: setBlockchainRecord,
    verDbResults: dbResults, setVerDbResults: setDbResults,
  } = useUpload()



  /**
   * computeLocalSHA256 — Uses the Web Crypto API to generate a SHA-256 hash.
   * Runs locally inside the user's browser, providing instant feedback.
   */
  const computeLocalSHA256 = async (f) => {
    const arrayBuffer = await f.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * queryBlockchainRegistry — Reads the smart contract to check if this hash is registered.
   * Since this is a read-only ("view") function call, it does NOT require signing or gas fees.
   */
  const queryBlockchainRegistry = async (sha256Hex) => {
    try {
      // 1. Prepare hex hash to match bytes32 parameter expectation
      const bytes32Hash = '0x' + sha256Hex

      // 2. Call verifyContent(bytes32) on the contract using readContract
      // Returns: (address creator, uint64 timestamp, uint64 phash, string ipfs_cid, string ai_tool)
      const record = await readContract(config, {
        address: CONTRACT_ADDRESS,
        abi: parseAbi(CONTRACT_ABI),
        functionName: 'verifyContent',
        args: [bytes32Hash],
      })

      return {
        isRegistered: true,
        creator: record[0],
        timestamp: Number(record[1]),
        phash: Number(record[2]),
        ipfsCid: record[3],
        aiTool: record[4],
      }
    } catch (err) {
      // Stylus reverts with custom errors (e.g. ContentNotFound) if not registered
      console.log('Blockchain lookup returned no matches:', err.message)
      return null
    }
  }

  /**
   * handleFileSelected — Coordinates the full verification workflow.
   */
  const handleFileSelected = async (f) => {
    setFile(f)
    setError(null)
    setLocalSha256(null)
    setPhash(null)
    setBlockchainRecord(null)
    setDbResults(null)
    setUploadProgress(0)

    if (!f) return

    try {
      setLoading(true)

      // ─────────────────────────────────────────────────────────────
      // STAGE 1: Calculate SHA-256 locally
      // ─────────────────────────────────────────────────────────────
      const sha256Hex = await computeLocalSHA256(f)
      setLocalSha256(sha256Hex)

      // ─────────────────────────────────────────────────────────────
      // STAGE 2: Query On-Chain Registry
      // ─────────────────────────────────────────────────────────────
      const onChainData = await queryBlockchainRegistry(sha256Hex)
      if (onChainData) {
        setBlockchainRecord(onChainData)
      }

      // ─────────────────────────────────────────────────────────────
      // STAGE 3: Call Hash Engine to generate visual perceptual hash
      // ─────────────────────────────────────────────────────────────
      const hashData = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        const formData = new FormData()
        formData.append('file', f)
        formData.append('filename', f.name)

        // Track upload progress events
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100)
            setUploadProgress(percent)
          }
        })

        // On upload and response complete
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText))
            } catch (err) {
              reject(new Error('Invalid response format from server'))
            }
          } else {
            reject(new Error(`Server error: status code ${xhr.status}`))
          }
        })

        xhr.addEventListener('error', () => reject(new Error('Verification upload failed due to network error')))

        xhr.open('POST', `${HASH_ENGINE_API}/api/v1/hash`)
        xhr.send(formData)
      })

      // Store the computed perceptual hash globally
      if (hashData.phash) {
        setPhash(hashData.phash)
      }

      // ─────────────────────────────────────────────────────────────
      // STAGE 4: Decentralized On-Chain Fuzzy Similarity Matching (Frontend-Only)
      // ─────────────────────────────────────────────────────────────
      const matches = []

      // Helper function to calculate Hamming Distance between two BigInt values
      const getHammingDistance = (a, b) => {
        let xor = BigInt(a) ^ BigInt(b)
        let dist = 0
        while (xor > 0n) {
          if (xor & 1n) dist++
          xor >>= 1n
        }
        return dist
      }

      // Helper function to calculate similarity percentage based on Hamming Distance
      const getSimilarityScore = (dist) => {
        return 100 - (dist / 64) * 100
      }

      try {
        // Query blockchain events (just like the Library page) to fetch all registered visual hashes
        const events = await getContractEvents(config, {
          address: CONTRACT_ADDRESS,
          abi: parseAbi(CONTRACT_ABI),
          eventName: 'ContentRegistered',
          fromBlock: 0n,
          toBlock: 'latest',
        })

        // Loop through all registered logs and compute visual distance locally!
        if (hashData.phash) {
          const uploadedPhash = BigInt(hashData.phash)

          for (const event of events) {
            const args = event.args || {}
            const registeredSha = args.sha256hash
            const registeredCreator = args.creator
            const registeredPhash = args.phash || 0n
            const registeredTime = Number(args.timestamp || 0n)
            const registeredIpfs = args.ipfsCid || ''
            const registeredAi = args.aitool || ''

            // Skip if this is the exact same file (will be handled by the exact match display)
            const isExactSha = registeredSha.toLowerCase() === ('0x' + sha256Hex).toLowerCase()

            if (registeredPhash !== 0n) {
              const distance = getHammingDistance(uploadedPhash, registeredPhash)
              const score = getSimilarityScore(distance)

              // If similarity is >= 80% (same logic as the backend BoltDB threshold)
              if (score >= 80) {
                // Fetch the metadata JSON from IPFS to extract the S3/IPFS image URL!
                let mediaS3Url, mediaIpfsUrl
                if (registeredIpfs && registeredIpfs !== '') {
                  try {
                    const controller = new AbortController()
                    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 seconds timeout

                    const metaRes = await fetch(`https://gateway.pinata.cloud/ipfs/${registeredIpfs}`, {
                      signal: controller.signal
                    })
                    clearTimeout(timeoutId)

                    if (metaRes.ok) {
                      const metaData = await metaRes.json()
                      mediaS3Url = metaData.media_s3_url
                      mediaIpfsUrl = metaData.media_ipfs_url
                    }
                  } catch (e) {
                    console.warn(`Failed to fetch IPFS metadata for ${registeredIpfs}:`, e.message)
                  }
                }

                matches.push({
                  matchType: isExactSha ? 'exact' : 'similar',
                  similarity: score,
                  assetId: registeredSha.slice(0, 16),
                  sha256: registeredSha,
                  mediaType: hashData.media_type || 'unknown',
                  registeredAt: new Date(registeredTime * 1000).toLocaleString(),
                  creator: registeredCreator,
                  aiTool: registeredAi,
                  ipfsCid: registeredIpfs,
                  mediaS3Url: mediaS3Url,
                  mediaIpfsUrl: mediaIpfsUrl,
                })
              }
            }
          }
        }
      } catch (logErr) {
        console.error('On-chain fuzzy search lookup failed:', logErr)
      }

      // If we got blockchain record via exact match and it wasn't caught in the loop above
      if (onChainData && matches.filter(m => m.matchType === 'exact').length === 0) {
        matches.push({
          matchType: 'exact',
          similarity: 100,
          assetId: `onchain-${sha256Hex.slice(0, 8)}`,
          sha256: `0x${sha256Hex}`,
          mediaType: hashData.media_type || 'unknown',
          registeredAt: new Date(onChainData.timestamp * 1000).toLocaleString(),
          creator: onChainData.creator,
          aiTool: onChainData.aiTool,
          ipfsCid: onChainData.ipfsCid,
        })
      }

      // ─────────────────────────────────────────────────────────────
      // STAGE 5: Query Core Backend for Database Records (Fallback/Crosscheck)
      // ─────────────────────────────────────────────────────────────
      try {
        // Query Core Backend Exact Match Database
        const exactRes = await fetch(`${CORE_BACKEND_API}/api/v1/verify/exact?hash=0x${sha256Hex}`)
        if (exactRes.ok) {
          const exactData = await exactRes.json()
          if (exactData.match_found && exactData.record) {
            // Only add if not already in matches list
            const alreadyMatched = matches.some(m => m.assetId.toLowerCase().includes(sha256Hex.slice(0, 8).toLowerCase()))

            if (onChainData) {
              setBlockchainRecord(prev => ({
                ...prev,
                mediaS3Url: exactData.record.MediaS3Url,
                mediaIpfsUrl: exactData.record.MediaIpfsUrl
              }))
            }

            if (!alreadyMatched) {
              matches.push({
                matchType: 'exact',
                similarity: 100,
                assetId: exactData.record.Sha256Hash?.slice(0, 16),
                sha256: exactData.record.Sha256Hash,
                mediaType: hashData.media_type || 'unknown',
                registeredAt: new Date(exactData.record.Timestamp * 1000).toLocaleString(),
                creator: exactData.record.CreatorAddress,
                aiTool: exactData.record.AiTool,
                ipfsCid: exactData.record.IpfsCid,
                mediaS3Url: exactData.record.MediaS3Url,
                mediaIpfsUrl: exactData.record.MediaIpfsUrl,
              })
            }
          }
        }
      } catch (dbErr) {
        console.warn('Core Backend exact match lookup failed:', dbErr.message)
      }

      try {
        // Build the segments payload. For videos/docs, it's an array of keyframes. For images, it's a single keyframe.
        let segmentsPayload = [];
        if (hashData.keyframes && hashData.keyframes.length > 0) {
          segmentsPayload = hashData.keyframes.map(k => ({
            offset: Number(k.offset),
            phash: Number(k.phash),
            semantic_hash: k.semantic_hash || [],
            face_hash: k.face_hash || [],
          }));
        } else if (hashData.phash) {
          segmentsPayload = [{
            offset: 0,
            phash: Number(hashData.phash),
            semantic_hash: hashData.semantic_hash || [],
            face_hash: hashData.face_hash || [],
          }];
        }

        if (segmentsPayload.length > 0) {
          const segmentRes = await fetch(`${CORE_BACKEND_API}/api/v1/verify/segments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sha256: '0x' + sha256Hex,
              media_type: hashData.media_type,
              segments: segmentsPayload,
            }),
          });

          if (segmentRes.ok) {
            const segmentData = await segmentRes.json();
            if (segmentData.match_found && segmentData.record) {
              const existingIndex = matches.findIndex(m => m.assetId.toLowerCase().includes(segmentData.record.Sha256Hash?.slice(0, 8).toLowerCase()));
              const newMatch = {
                matchType: segmentData.is_deepfake ? 'deepfake' : 'similar',
                isDeepfake: segmentData.is_deepfake,
                similarity: segmentData.similarity || 90,
                assetId: segmentData.record.Sha256Hash?.slice(0, 16),
                sha256: segmentData.record.Sha256Hash,
                mediaType: hashData.media_type || 'unknown',
                registeredAt: new Date(segmentData.record.Timestamp * 1000).toLocaleString(),
                creator: segmentData.record.CreatorAddress,
                aiTool: segmentData.record.AiTool,
                ipfsCid: segmentData.record.IpfsCid,
                mediaS3Url: segmentData.record.MediaS3Url,
                mediaIpfsUrl: segmentData.record.MediaIpfsUrl,
              };

              if (existingIndex >= 0) {
                // Upgrade the match if the backend found a deepfake, or if it has more accurate similarity
                if (segmentData.is_deepfake || matches[existingIndex].matchType !== 'exact') {
                  matches[existingIndex] = { ...matches[existingIndex], ...newMatch };
                }
              } else {
                matches.push(newMatch);
              }
            }
          }
        }
      } catch (dbErr) {
        console.warn('Core Backend similarity search failed:', dbErr.message)
      }
      setDbResults(matches)

      // Increment local verification stats
      try {
        const count = Number(localStorage.getItem('vt_verifs_count') || 0)
        localStorage.setItem('vt_verifs_count', count + 1)
      } catch (e) { }
    } catch (err) {
      console.error('Verification error:', err)
      setError(`Failed to perform verification check: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="container" style={{ paddingTop: '1.5rem' }}>
      {/* Page Title */}
      <div className="page-title">
        <h1>Verify & Search Content</h1>
        <div className="page-title-sub">
          Upload a file to check if it's registered or search for visual matches in the database
        </div>
      </div>

      <div className="verify-grid">
        {/* ── LEFT COLUMN: File Upload + Hash Display ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* File Upload Zone */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Upload File to Verify
              </h2>
            </div>
            <div className="card-body">
              <FileUpload
                onFileSelected={handleFileSelected}
                label="Drop a file to check it against the VeriTrace registry"
              />
            </div>
          </div>

          {/* Computed Hashes Dashboard */}
          {(localSha256 || loading) && (
            <div className="card animate-slide-up">
              <div className="card-header">
                <h2 className="card-header-title">Computed Fingerprints</h2>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {loading && !localSha256 ? (
                  <div className="skeleton skeleton-text" style={{ width: '100%', height: 38 }} />
                ) : (
                  <>
                    <HashDisplay
                      label="SHA-256 Cryptographic Hash"
                      hash={localSha256 ? `0x${localSha256}` : null}
                      icon="C"
                      variant="crypto"
                    />

                    {phash && (
                      <HashDisplay
                        label="Visual Perceptual Hash (phash)"
                        hash={phash}
                        icon="P"
                        variant="perceptual"
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Verification Indicators Legend */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">Understanding Results</h2>
            </div>
            <div className="card-body" style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="badge badge-success" style={{ flexShrink: 0 }}>100%</span>
                <div>
                  <strong>Exact Match</strong> — Cryptographic hashes are identical. This file is byte-for-byte identical to the registered original.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="badge badge-warning" style={{ flexShrink: 0 }}>80-99%</span>
                <div>
                  <strong>Similar Content</strong> — Perceptual signatures match closely. The file might be compressed, resized, cropped, or slightly adjusted.
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span className="badge badge-neutral" style={{ flexShrink: 0 }}>&lt;80%</span>
                <div>
                  <strong>No Match</strong> — No entries found that fall within visual or cryptographic thresholds.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Verification Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* On-Chain Provenance Record */}
          {(blockchainRecord || loading) && (
            <div className="card animate-slide-up" style={{ borderColor: blockchainRecord ? 'var(--color-success)' : 'var(--color-border)' }}>
              <div className="card-header" style={{ background: blockchainRecord ? 'var(--color-success-bg)' : 'var(--color-bg)' }}>
                <h2 className="card-header-title" style={{ color: blockchainRecord ? 'var(--color-success)' : 'inherit' }}>
                  🛡️ On-Chain Smart Contract Proof
                </h2>
                {blockchainRecord && <span className="badge badge-success">Verified Original</span>}
              </div>
              <div className="card-body">
                {loading && !blockchainRecord ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div className="skeleton skeleton-text" />
                    <div className="skeleton skeleton-text" style={{ width: '80%' }} />
                    <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Registrant Wallet</span>
                      <a
                        href={`${ARBITRUM_SEPOLIA.explorer}/address/${blockchainRecord.creator}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="address-tag"
                        style={{ fontWeight: 600 }}
                      >
                        {blockchainRecord.creator.slice(0, 10)}...{blockchainRecord.creator.slice(-6)}
                      </a>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>Proof Committed At</span>
                      <span>{new Date(blockchainRecord.timestamp * 1000).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--color-text-muted)' }}>AI Tool Attribution</span>
                      <span style={{ fontWeight: 600 }}>{blockchainRecord.aiTool || 'None'}</span>
                    </div>
                    {blockchainRecord.ipfsCid && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Metadata (IPFS)</span>
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${blockchainRecord.ipfsCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'underline' }}
                        >
                          View Metadata CID ↗
                        </a>
                      </div>
                    )}
                    {blockchainRecord.mediaIpfsUrl && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Media (IPFS)</span>
                        <a
                          href={blockchainRecord.mediaIpfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'underline' }}
                        >
                          View Media IPFS ↗
                        </a>
                      </div>
                    )}
                    {blockchainRecord.mediaS3Url && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>Media (S3)</span>
                        <a
                          href={blockchainRecord.mediaS3Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'underline' }}
                        >
                          View Media S3 ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Database Lookalike Matches */}
          <div className="card animate-slide-up">
            <div className="card-header">
              <h2 className="card-header-title">Database Similarity Results</h2>
              {dbResults && dbResults.length > 0 && (
                <span className="badge badge-info">{dbResults.length} matches</span>
              )}
            </div>
            <div className="card-body" style={{ maxHeight: '520px', overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '0.5rem 0' }}>
                  {uploadProgress < 100 ? (
                    <div className="progress-container animate-fade-in" style={{ marginTop: 0 }}>
                      <div className="progress-header">
                        <span>Uploading Media File...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
                        Uploading payload to remote Hash Engine
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center' }} className="animate-fade-in">
                      <div className="spinner" />
                      <div style={{ fontWeight: 600, marginTop: '1rem' }}>Searching similarity index...</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        Checking visual profiles and comparing perceptual Hamming distances on the server.
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <SearchResults results={dbResults} loading={loading} uploadedFile={file} />
              )}
            </div>
          </div>


          {/* Error Banner */}
          {error && (
            <div className="alert-box danger">
              <span>⚠️</span>
              <div>{error}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
