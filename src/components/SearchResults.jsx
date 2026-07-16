/**
 * SearchResults.jsx — Displays verification/search results
 * 
 * Three visual states:
 * 1. Loading — skeleton pulse animation cards
 * 2. No results — empty state with success icon
 * 3. Results — match cards with colored indicators (exact = green, similar = orange)
 * 
 * Props:
 *   results   — array of match objects, or null (not searched yet)
 *   loading   — boolean, true while API call is in progress
 *   
 * Each result object shape (from the hash engine verify API):
 *   {
 *     matchType: "exact" | "similar",
 *     similarity: number (0-100),
 *     assetId: string,
 *     mediaType: string,
 *     registeredAt: string (ISO date),
 *   }
 */
import { useState, useEffect, useCallback } from 'react'
import { ARBITRUM_SEPOLIA, CORE_BACKEND_API } from '../config'

export default function SearchResults({ results, loading, uploadedFile }) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null)
  const [comparisonMatch, setComparisonMatch] = useState(null)
  const [heatmapBase64, setHeatmapBase64] = useState(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)

  // Client-side on-demand IPFS metadata resolver states for comparison modal
  const [resolvedOriginalUrl, setResolvedOriginalUrl] = useState(null)
  const [resolvedMediaType, setResolvedMediaType] = useState('image')
  const [loadingOriginal, setLoadingOriginal] = useState(false)
  const [uploadingLegacy, setUploadingLegacy] = useState(false)

  // Manage local uploaded file object URL lifecycle in one central location to avoid duplicate creations / leaks
  useEffect(() => {
    if (!uploadedFile || (!uploadedFile.type?.startsWith('image/') && !uploadedFile.type?.startsWith('video/'))) {
      setLocalPreviewUrl(null)
      return
    }

    const url = URL.createObjectURL(uploadedFile)
    setLocalPreviewUrl(url)

    return () => {
      URL.revokeObjectURL(url)
    }
  }, [uploadedFile])

  // Resolve standard gateway URL for S3/IPFS
  const getGatewayUrl = (url) => {
    if (!url) return null
    if (url.startsWith('ipfs://')) {
      return `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`
    }
    return url
  }

  // Client-side metadata resolution effect
  useEffect(() => {
    if (!comparisonMatch) {
      setResolvedOriginalUrl(null)
      setResolvedMediaType('image')
      setLoadingOriginal(false)
      return
    }

    const { mediaS3Url, mediaIpfsUrl, ipfsCid, mediaType, sha256, assetId } = comparisonMatch

    // Check localStorage cache first to support archived legacy overrides and registered cache
    const hashKey = (sha256 || assetId || '').toLowerCase()

    // Check unified media cache first
    const cachedMediaStr = localStorage.getItem(`vt_media_${hashKey}`)
    if (cachedMediaStr) {
      try {
        const cached = JSON.parse(cachedMediaStr)
        if (cached.media_ipfs_url || cached.media_s3_url) {
          setResolvedOriginalUrl(getGatewayUrl(cached.media_s3_url || cached.media_ipfs_url))
          setResolvedMediaType(cached.media_type || mediaType || 'image')
          setLoadingOriginal(false)
          return
        }
      } catch (e) { }
    }

    const cachedUrl = localStorage.getItem(`vt_legacy_${hashKey}`) || localStorage.getItem(`vt_legacy_${sha256 || assetId}`)
    if (cachedUrl) {
      setResolvedOriginalUrl(getGatewayUrl(cachedUrl))
      setResolvedMediaType(mediaType || 'image')
      setLoadingOriginal(false)
      return
    }

    const initialUrl = getGatewayUrl(mediaS3Url) || getGatewayUrl(mediaIpfsUrl)

    if (initialUrl) {
      setResolvedOriginalUrl(initialUrl)
      setResolvedMediaType(mediaType || 'image')
      setLoadingOriginal(false)
      return
    }

    // Try resolving metadata CID if available
    if (ipfsCid && ipfsCid !== '' && !ipfsCid.startsWith('QmYourMetadataCid')) {
      setLoadingOriginal(true)
      const fetchMetadata = async () => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 4000)

          const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCid}`, {
            signal: controller.signal
          })
          clearTimeout(timeoutId)

          if (res.ok) {
            const meta = await res.json()
            const realUrl = getGatewayUrl(meta.media_s3_url || meta.media_ipfs_url)
            setResolvedOriginalUrl(realUrl)
            setResolvedMediaType(meta.media_type || mediaType || 'image')
          } else {
            // Try fallback public gateway
            const fallbackRes = await fetch(`https://ipfs.io/ipfs/${ipfsCid}`)
            if (fallbackRes.ok) {
              const meta = await fallbackRes.json()
              const realUrl = getGatewayUrl(meta.media_s3_url || meta.media_ipfs_url)
              setResolvedOriginalUrl(realUrl)
              setResolvedMediaType(meta.media_type || mediaType || 'image')
            }
          }
        } catch (err) {
          console.warn("Failed resolving comparison metadata from IPFS gateway:", err)
        } finally {
          setLoadingOriginal(false)
        }
      }
      fetchMetadata()
    } else {
      // Legacy registration
      setResolvedOriginalUrl(null)
      setResolvedMediaType(mediaType || 'image')
      setLoadingOriginal(false)
    }
  }, [comparisonMatch])

  const handleViewAlterations = useCallback(async () => {
    if (!uploadedFile || !resolvedOriginalUrl) return
    setHeatmapLoading(true)
    try {
      // 1. Fetch the original image blob
      const res = await fetch(resolvedOriginalUrl)
      const blob = await res.blob()

      // 2. Create FormData with both images
      const fd = new FormData()
      fd.append('file1', blob, 'original.jpg')
      fd.append('file2', uploadedFile)

      // 3. Send to Hashing Engine proxy
      const compareRes = await fetch(`https://api.hash.veritrace.dpkvtrading.online/api/v1/compare`, {
        method: 'POST',
        body: fd
      })

      if (compareRes.ok) {
        const data = await compareRes.json()
        setHeatmapBase64(data.heatmap_base64)
      } else {
        console.error('Heatmap generation failed:', await compareRes.text())
      }
    } catch (err) {
      console.error('Failed to generate heatmap:', err)
    } finally {
      setHeatmapLoading(false)
    }
  }, [uploadedFile, resolvedOriginalUrl])

  // Auto-generate heatmap on image preview
  useEffect(() => {
    if (resolvedOriginalUrl && uploadedFile && resolvedMediaType === 'image') {
      handleViewAlterations()
    } else {
      setHeatmapBase64(null)
    }
  }, [resolvedOriginalUrl, uploadedFile, resolvedMediaType, handleViewAlterations])

  const handleArchiveLegacy = async () => {
    if (!uploadedFile || !comparisonMatch) return

    setUploadingLegacy(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile)

      const res = await fetch(`${CORE_BACKEND_API}/api/v1/pin-file`, {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        const mediaUrl = data.media_s3_url || data.media_ipfs_url
        if (mediaUrl) {
          const hashKey = (comparisonMatch.sha256 || comparisonMatch.assetId || '').toLowerCase()
          const cacheData = {
            sha256: hashKey,
            media_ipfs_url: data.media_ipfs_url,
            media_s3_url: data.media_s3_url,
            media_type: comparisonMatch.mediaType || 'image'
          }
          localStorage.setItem(`vt_media_${hashKey}`, JSON.stringify(cacheData))
          localStorage.setItem(`vt_legacy_${hashKey}`, mediaUrl)
          setResolvedOriginalUrl(getGatewayUrl(mediaUrl))
        }
      } else {
        alert("Backend failed to pin file. Make sure core backend server is online.")
      }
    } catch (err) {
      console.error("Failed to archive legacy media:", err)
      alert(`Archive upload failed: ${err.message}`)
    } finally {
      setUploadingLegacy(false)
    }
  }

  // ── State 1: Loading skeleton ──
  if (loading) {
    return (
      <div>
        {[1, 2, 3].map(i => (
          <div key={i} className="match-card animate-fade-in" style={{ marginBottom: '0.75rem' }}>
            <div className="match-card-indicator" style={{ background: 'var(--color-border)' }} />
            <div className="match-card-body">
              <div className="skeleton skeleton-text" />
              <div className="skeleton skeleton-text-sm" />
            </div>
            <div className="match-card-percentage">
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ── State 2a: Not searched yet (null) ──
  if (!results) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <div className="empty-state-title">Upload a file to search</div>
        <div className="empty-state-text">
          We'll check for exact SHA-256 matches and visually similar content in the registry.
        </div>
      </div>
    )
  }

  // ── State 2b: Searched but no matches ──
  if (results.length === 0) {
    return (
      <div className="empty-state animate-fade-in">
        <div className="empty-state-icon" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <div className="empty-state-title">No matches found</div>
        <div className="empty-state-text">
          This content hasn't been registered yet. You can be the first to register it!
        </div>
      </div>
    )
  }

  // ── State 3: Render match cards ──
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {results.map((result, index) => (
          <MatchCard
            key={index}
            result={result}
            localPreviewUrl={localPreviewUrl}
            onSelect={() => setComparisonMatch(result)}
          />
        ))}
      </div>

      {/* ── Side-by-Side Comparison Modal ── */}
      {comparisonMatch && (
        <div className="modal-overlay" onClick={() => setComparisonMatch(null)} style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem 1.5rem',
          overflowY: 'auto',
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal-card card animate-scale-in" onClick={(e) => e.stopPropagation()} style={{
            width: '100%',
            maxWidth: (resolvedOriginalUrl && resolvedMediaType === 'image') ? '1200px' : '900px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            margin: '2rem 0'
          }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => { setComparisonMatch(null); setHeatmapBase64(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem' }}
                >
                  ← Back
                </button>
                <h2 className="card-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0 }}>
                  <span>🔍</span> Authenticity Check — {comparisonMatch.similarity?.toFixed(1)}% Match
                </h2>
              </div>
              <button
                className="btn btn-sm btn-outline"
                onClick={() => { setComparisonMatch(null); setHeatmapBase64(null); }}
                style={{ padding: '0.25rem 0.5rem' }}
              >
                ✕ Close
              </button>
            </div>

            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* SIDE-BY-SIDE PANELS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: (resolvedOriginalUrl && resolvedMediaType === 'image') ? '1fr 1fr 1fr' : '1fr 1fr',
                gap: '1rem',
                minHeight: '420px'
              }}>
                {/* LEFT SIDE: UPLOADED FILE FOR VERIFICATION */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Uploaded Target (To Verify)
                  </div>
                  <div style={{
                    width: '100%',
                    flex: 1,
                    background: '#0d0d0d',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    height: '400px'
                  }}>
                    {uploadedFile && uploadedFile.type?.startsWith('video/') ? (
                      <video
                        src={localPreviewUrl}
                        controls
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : localPreviewUrl ? (
                      <img
                        src={localPreviewUrl}
                        alt="Uploaded Verification File"
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    ) : (
                      <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No image loaded</div>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE: MATCHING REGISTERED ORIGINAL */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Matched Original (On-Chain)
                  </div>
                  <div
                    style={{
                      width: '100%',
                      flex: 1,
                      background: '#0d0d0d',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      height: '400px'
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    {loadingOriginal ? (
                      <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <div className="spinner" style={{ borderTopColor: 'white' }} />
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Resolving registry media...</div>
                      </div>
                    ) : resolvedOriginalUrl ? (
                      <>
                        {resolvedMediaType === 'video' ? (
                          <video
                            src={resolvedOriginalUrl}
                            controls
                            controlsList="nodownload"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }}
                          />
                        ) : (
                          <img
                            src={resolvedOriginalUrl}
                            alt="Matched Registry Asset"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }}
                          />
                        )}

                        {/* Stealing Watermark Overlay */}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          pointerEvents: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.02) 15px, rgba(0, 0, 0, 0.1) 15px, rgba(0, 0, 0, 0.1) 30px)'
                        }}>
                          <div style={{
                            transform: 'rotate(-25deg)',
                            fontSize: '0.875rem',
                            fontWeight: '900',
                            color: 'rgba(255, 255, 255, 0.18)',
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            letterSpacing: '0.125em',
                            userSelect: 'none'
                          }}>
                            VERITRACE REGISTERED
                          </div>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔒</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>Original Media Not Archived</div>
                        <div style={{ fontSize: '0.6875rem', marginTop: '0.25rem', lineHeight: '1.3', maxWidth: '240px' }}>
                          This registration was created using a legacy version that did not store the media file online.
                        </div>
                        {comparisonMatch.similarity === 100 && (
                          <button
                            onClick={handleArchiveLegacy}
                            disabled={uploadingLegacy}
                            className="btn btn-sm btn-primary"
                            style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.375rem 0.75rem', width: 'auto' }}
                          >
                            {uploadingLegacy ? 'Archiving to S3...' : 'Archive File to S3 & IPFS ☁️'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* THIRD COLUMN: PIXEL DIFF HEATMAP (Only for image matches) */}
                {resolvedOriginalUrl && resolvedMediaType === 'image' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--color-danger)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Pixel Diff Heatmap
                    </div>
                    <div style={{
                      width: '100%',
                      flex: 1,
                      background: '#0d0d0d',
                      borderRadius: 'var(--radius-md)',
                      border: '1px dashed rgba(222, 68, 55, 0.4)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      height: '400px'
                    }}>
                      {heatmapLoading ? (
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                          <div className="spinner" style={{ borderTopColor: 'var(--color-danger)' }} />
                          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Analyzing pixel diffs...</div>
                        </div>
                      ) : heatmapBase64 ? (
                        <img
                          src={heatmapBase64}
                          alt="Alteration Heatmap"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔍</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white' }}>Heatmap Not Loaded</div>
                          <div style={{ fontSize: '0.6875rem', marginTop: '0.25rem', lineHeight: '1.3', maxWidth: '200px' }}>
                            Make sure the Hash Engine service is running.
                          </div>
                          <button
                            onClick={handleViewAlterations}
                            className="btn btn-sm btn-outline"
                            style={{ marginTop: '0.75rem', fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}
                          >
                            Retry Analysis
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Match Comparison Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', fontSize: '0.8125rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.875rem' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>Asset Identification</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>SHA-256 Hash Slice: <span className="hash-tag">{comparisonMatch.assetId}</span></div>
                  <div style={{ color: 'var(--color-text-muted)' }}>Attribution AI Model: {comparisonMatch.aiTool || 'None (Authentic Content)'}</div>
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>On-Chain Record</div>
                  <div style={{ color: 'var(--color-text-muted)' }}>Owner: <span className="address-tag">{comparisonMatch.creator ? `${comparisonMatch.creator.slice(0, 8)}...${comparisonMatch.creator.slice(-6)}` : 'Unknown'}</span></div>
                  <div style={{ color: 'var(--color-text-muted)' }}>Registration Date: {comparisonMatch.registeredAt}</div>
                </div>
              </div>
            </div>

            <div className="card-footer" style={{ background: 'var(--color-bg)', display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={() => { setComparisonMatch(null); setHeatmapBase64(null); }}
                style={{ minWidth: '200px' }}
              >
                ← Back to Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * MatchCard — Individual match result card
 */
function MatchCard({ result, localPreviewUrl, onSelect }) {
  const isExact = result.matchType === 'exact'
  const isDeepfake = result.matchType === 'deepfake' || result.isDeepfake
  const percentage = result.similarity || 0

  return (
    <div className="match-card animate-fade-in" onClick={onSelect} style={{ cursor: 'pointer' }}>
      {/* ── Left color indicator ── */}
      <div className={`match-card-indicator ${isExact ? 'exact' : isDeepfake ? 'error' : 'similar'}`} style={isDeepfake ? { backgroundColor: 'var(--color-error)' } : {}} />

      {/* ── Card body with match details ── */}
      <div className="match-card-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className={`badge ${isExact ? 'badge-success' : isDeepfake ? 'badge-error' : 'badge-warning'}`} style={isDeepfake ? { backgroundColor: '#dc2626', color: '#fff' } : {}}>
            {isExact ? '✓ Exact Match' : isDeepfake ? '🚨 DEEPFAKE DETECTED' : '≈ Similar'}
          </span>
          <span className="text-cap">
            {result.mediaType || 'unknown'}
          </span>
        </div>

        {/* Asset ID from the hash engine */}
        {result.assetId && (
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Asset: </span>
            <span className="hash-tag">{result.assetId}</span>
          </div>
        )}

        {/* Creator address from the on-chain record */}
        {result.creator && (
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Creator: </span>
            <a
              href={`${ARBITRUM_SEPOLIA.explorer}/address/${result.creator}`}
              target="_blank"
              rel="noopener noreferrer"
              className="address-tag"
            >
              {result.creator.slice(0, 10)}...{result.creator.slice(-6)}
            </a>
          </div>
        )}

        {/* Registration timestamp */}
        {result.registeredAt && (
          <div className="file-info-meta" style={{ marginBottom: '0.5rem' }}>
            Registered: {result.registeredAt}
          </div>
        )}

        {/* ── Match Image Preview ── */}
        {(() => {
          // Resolve standard gateway URL for S3/IPFS
          const getGatewayUrl = (url) => {
            if (!url) return null;
            if (url.startsWith('ipfs://')) {
              return `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`;
            }
            return url;
          };

          let previewUrl = getGatewayUrl(result.mediaS3Url) || getGatewayUrl(result.mediaIpfsUrl);

          if (!previewUrl) {
            return (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{
                  width: '120px',
                  height: '90px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.625rem',
                  color: 'var(--color-text-muted)',
                  textAlign: 'center',
                  padding: '0.5rem',
                  lineHeight: '1.2'
                }}>
                  No preview available (Legacy register)
                </div>
              </div>
            );
          }

          return (
            <div style={{ marginTop: '0.5rem' }}>
              <img
                src={previewUrl}
                alt="Matched Asset Preview"
                style={{
                  width: '120px',
                  height: '90px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)',
                }}
                onError={(e) => {
                  // Fall back to backend upload folder if available
                  if (result.assetId && e.target.src !== `https://api.veritrace.dpkvtrading.online/uploads/${result.assetId}`) {
                    e.target.src = `https://api.veritrace.dpkvtrading.online/uploads/${result.assetId}`;
                  } else {
                    e.target.style.display = 'none';
                  }
                }}
              />
            </div>
          );
        })()}
      </div>

      {/* ── Similarity percentage circle ── */}
      <div className="match-card-percentage">
        <div style={{ textAlign: 'center' }}>
          <div className="match-percentage-value" style={{
            color: isExact
              ? 'var(--color-success)'
              : isDeepfake
                ? '#dc2626'
                : percentage >= 80
                  ? 'var(--color-warning)'
                  : 'var(--color-text-muted)'
          }}>
            {percentage.toFixed(1)}%
          </div>
          <div className="match-percentage-label">match</div>
        </div>
      </div>
    </div>
  )
}
