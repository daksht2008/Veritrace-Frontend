import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CircleCheck as CheckCircle2, Search, TriangleAlert as AlertTriangle, Lock, Cloud, ExternalLink, Flag } from 'lucide-react'
import { ARBITRUM_SEPOLIA, CORE_BACKEND_API, HASH_ENGINE_API } from '../config'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import { EmptyState } from './ui/empty-state'
import { Modal, ModalHeader } from './ui/modal'
import { toast } from 'sonner'
import { downloadCertificate } from '../utils/generateCertificate'

function buildLineageTree(records) {
  if (!records || records.length === 0) return null;
  
  const map = {};
  records.forEach(r => {
    const key = (r.sha256_hash || r.Sha256Hash || '').toLowerCase();
    map[key] = { ...r, children: [] };
  });
  
  let root = null;
  const sortedRecords = [...records].sort((a, b) => (a.timestamp || a.Timestamp || 0) - (b.timestamp || b.Timestamp || 0));
  
  if (sortedRecords.length > 0) {
    const oldestKey = (sortedRecords[0].sha256_hash || sortedRecords[0].Sha256Hash || '').toLowerCase();
    root = map[oldestKey];
  }
  
  records.forEach(r => {
    const childKey = (r.sha256_hash || r.Sha256Hash || '').toLowerCase();
    const parentKey = (r.parent_sha256 || r.ParentSha256 || '').toLowerCase();
    
    if (parentKey && map[parentKey] && childKey !== parentKey) {
      const exists = map[parentKey].children.some(c => (c.sha256_hash || c.Sha256Hash || '').toLowerCase() === childKey);
      if (!exists) {
        map[parentKey].children.push(map[childKey]);
      }
    }
  });

  return root || Object.values(map)[0];
}

function TreeNode({ node, targetHash, onSelectNode }) {
  if (!node) return null;
  const currentHash = (node.sha256_hash || node.Sha256Hash || '').toLowerCase();
  const isTarget = currentHash === targetHash.toLowerCase();
  
  const shortAddress = node.creator_address || node.CreatorAddress 
    ? `${(node.creator_address || node.CreatorAddress).slice(0, 6)}...${(node.creator_address || node.CreatorAddress).slice(-4)}`
    : 'Unknown';

  const getGatewayUrl = (url, cid) => {
    if (url) {
      if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`;
      return url;
    }
    if (cid) return `https://gateway.pinata.cloud/ipfs/${cid}`;
    return null;
  };

  const previewSrc = getGatewayUrl(node.media_s3_url || node.media_ipfs_url || node.MediaS3Url || node.MediaIpfsUrl, node.ipfs_cid || node.IpfsCid);

  return (
    <div className="flex flex-col items-center relative">
      <div 
        onClick={() => onSelectNode(node)}
        className={`z-10 cursor-pointer flex flex-col items-center p-2 bg-[var(--bg-3)] border rounded-xl shadow-lg transition-all duration-200 hover:scale-105 hover:border-[#12AAFF]/50 w-28 text-center ${
          isTarget ? 'border-[#12AAFF] ring-2 ring-[#12AAFF]/20 bg-[#12AAFF]/5' : 'border-[var(--border)]'
        }`}
      >
        {previewSrc ? (
          <img 
            src={previewSrc} 
            alt="Preview" 
            className="w-10 h-10 object-cover rounded-md mb-1 border border-[var(--border)]"
          />
        ) : (
          <div className="w-10 h-10 rounded-md bg-[var(--bg-2)] flex items-center justify-center text-[8px] text-[var(--text-3)] mb-1 border border-[var(--border)]">
            No Img
          </div>
        )}
        <div className="text-[9px] font-bold truncate w-full text-[var(--text-1)]">
          {node.organization_name || node.organizationName || (node.media_type === 'video' ? 'Video file' : 'Image')}
        </div>
        <div className="text-[7px] text-[var(--text-3)] truncate w-full font-mono mt-0.5">
          {shortAddress}
        </div>
        {isTarget && (
          <span className="mt-1 text-[7px] uppercase tracking-wider font-extrabold text-[#12AAFF] bg-[#12AAFF]/10 px-1.5 py-0.5 rounded">
            Target
          </span>
        )}
      </div>

      {node.children && node.children.length > 0 && (
        <div className="flex flex-col items-center w-full relative">
          <div className="w-0.5 h-4 bg-[var(--border)]"></div>
          <div className="flex justify-center relative w-full">
            {node.children.length > 1 && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--border)] w-[calc(100%-2rem)] mx-auto"></div>
            )}
            <div className="flex gap-4 pt-3">
              {node.children.map((child) => (
                <TreeNode 
                  key={child.sha256_hash || child.Sha256Hash || Math.random()} 
                  node={child} 
                  targetHash={targetHash} 
                  onSelectNode={onSelectNode}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchResults({ results, loading, uploadedFile }) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState(null)
  const [comparisonMatch, setComparisonMatch] = useState(null)
  const [heatmapBase64, setHeatmapBase64] = useState(null)
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [resolvedOriginalUrl, setResolvedOriginalUrl] = useState(null)
  const [resolvedMediaType, setResolvedMediaType] = useState('image')
  const [loadingOriginal, setLoadingOriginal] = useState(false)
  const [uploadingLegacy, setUploadingLegacy] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [syncResult, setSyncResult] = useState(null)

  const [showFlagForm, setShowFlagForm] = useState(false)
  const [flagReason, setFlagReason] = useState('Voice-Cloned/Audio Deepfake')
  const [submittingFlag, setSubmittingFlag] = useState(false)

  const [lineageData, setLineageData] = useState(null)
  const [lineageLoading, setLineageLoading] = useState(false)

  const fetchLineage = async (hash) => {
    setLineageLoading(true)
    try {
      const res = await fetch(`${CORE_BACKEND_API}/api/v1/content/${hash}/lineage`)
      if (res.ok) {
        const data = await res.json()
        if (data.lineage) {
          setLineageData(buildLineageTree(data.lineage))
        }
      }
    } catch (e) {
      console.error("Failed to fetch lineage", e)
    } finally {
      setLineageLoading(false)
    }
  }

  // Reset flag form when comparison target changes
  useEffect(() => {
    setShowFlagForm(false)
    setFlagReason('Voice-Cloned/Audio Deepfake')
    setLineageData(null)
    if (comparisonMatch) {
      const hash = comparisonMatch.sha256Hash || comparisonMatch.sha256_hash || comparisonMatch.sha256
      if (hash) {
        fetchLineage(hash)
      }
    }
  }, [comparisonMatch])

  const handleDownloadCert = async () => {
    if (!comparisonMatch) return
    const txObj = {
      sha256: comparisonMatch.sha256Hash || comparisonMatch.sha256_hash || comparisonMatch.sha256,
      hash: comparisonMatch.onChainTxHash || comparisonMatch.on_chain_tx_hash || comparisonMatch.txHash,
      mediaS3Url: comparisonMatch.mediaS3Url,
      mediaIpfsUrl: comparisonMatch.mediaIpfsUrl
    }
    toast.loading('Generating cryptographic authenticity certificate...', { id: 'cert' })
    try {
      await downloadCertificate(txObj, comparisonMatch.creator || comparisonMatch.creatorAddress || comparisonMatch.creator_address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', CORE_BACKEND_API)
      toast.success('Certificate downloaded successfully!', { id: 'cert' })
    } catch (e) {
      toast.error('Failed to generate certificate: ' + e.message, { id: 'cert' })
    }
  }

  const submitDispute = async () => {
    if (!comparisonMatch) return
    setSubmittingFlag(true)
    try {
      const sha256 = comparisonMatch.sha256
      const res = await fetch(`${CORE_BACKEND_API}/api/v1/verify/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha256: sha256,
          reporter: '0x3d434220b22a0100d395000000000000000002ba', // simulated connected wallet
          reason: flagReason,
        }),
      })
      if (res.ok) {
        toast.success('Dispute filed successfully!')
        setShowFlagForm(false)
        comparisonMatch.flagCount = (comparisonMatch.flagCount || 0) + 1
        comparisonMatch.flag_count = (comparisonMatch.flag_count || 0) + 1
      } else {
        const data = await res.json()
        toast.error(`Failed to file dispute: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      toast.error(`Error filing dispute: ${err.message}`)
    } finally {
      setSubmittingFlag(false)
    }
  }

  useEffect(() => {
    if (!uploadedFile || (!uploadedFile.type?.startsWith('image/') && !uploadedFile.type?.startsWith('video/'))) { setLocalPreviewUrl(null); return }
    const url = URL.createObjectURL(uploadedFile)
    setLocalPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [uploadedFile])

  const getGatewayUrl = (url) => { if (!url) return null; if (url.startsWith('ipfs://')) return `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`; return url }

  useEffect(() => {
    if (!comparisonMatch) { setResolvedOriginalUrl(null); setResolvedMediaType('image'); setLoadingOriginal(false); return }
    const { mediaS3Url, mediaIpfsUrl, ipfsCid, mediaType, sha256, assetId } = comparisonMatch
    const hashKey = (sha256 || assetId || '').toLowerCase()
    const cachedMediaStr = localStorage.getItem(`vt_media_${hashKey}`)
    if (cachedMediaStr) { try { const cached = JSON.parse(cachedMediaStr); if (cached.media_ipfs_url || cached.media_s3_url) { setResolvedOriginalUrl(getGatewayUrl(cached.media_s3_url || cached.media_ipfs_url)); setResolvedMediaType(cached.media_type || mediaType || 'image'); return } } catch {} }
    const cachedUrl = localStorage.getItem(`vt_legacy_${hashKey}`)
    if (cachedUrl) { setResolvedOriginalUrl(getGatewayUrl(cachedUrl)); setResolvedMediaType(mediaType || 'image'); return }
    const initialUrl = getGatewayUrl(mediaS3Url) || getGatewayUrl(mediaIpfsUrl)
    if (initialUrl) { setResolvedOriginalUrl(initialUrl); setResolvedMediaType(mediaType || 'image'); return }
    if (ipfsCid && ipfsCid !== '' && !ipfsCid.startsWith('QmYourMetadataCid')) {
      setLoadingOriginal(true)
      const fetchMetadata = async () => {
        try { const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 4000); const res = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsCid}`, { signal: controller.signal }); clearTimeout(timeoutId); if (res.ok) { const meta = await res.json(); setResolvedOriginalUrl(getGatewayUrl(meta.media_s3_url || meta.media_ipfs_url)); setResolvedMediaType(meta.media_type || mediaType || 'image') } } catch {} finally { setLoadingOriginal(false) }
      }
      fetchMetadata()
    } else { setResolvedOriginalUrl(null); setResolvedMediaType(mediaType || 'image'); setLoadingOriginal(false) }
  }, [comparisonMatch])

  const handleViewAlterations = useCallback(async () => {
    if (!uploadedFile || !resolvedOriginalUrl) return
    setHeatmapLoading(true)
    try {
      const res = await fetch(resolvedOriginalUrl); const blob = await res.blob(); const fd = new FormData()
      fd.append('file1', blob, 'original.jpg'); fd.append('file2', uploadedFile)
      const compareRes = await fetch(`https://api.hash.veritrace.dpkvtrading.online/api/v1/compare`, { method: 'POST', body: fd })
      if (compareRes.ok) { const data = await compareRes.json(); setHeatmapBase64(data.heatmap_base64) }
    } catch {} finally { setHeatmapLoading(false) }
  }, [uploadedFile, resolvedOriginalUrl])

  useEffect(() => {
    if (resolvedOriginalUrl && uploadedFile && resolvedMediaType === 'image') handleViewAlterations()
    else setHeatmapBase64(null)
  }, [resolvedOriginalUrl, uploadedFile, resolvedMediaType, handleViewAlterations])

  const handleArchiveLegacy = async () => {
    if (!uploadedFile || !comparisonMatch) return
    setUploadingLegacy(true)
    try {
      const formData = new FormData(); formData.append('file', uploadedFile)
      const res = await fetch(`${CORE_BACKEND_API}/api/v1/pin-file`, { method: 'POST', body: formData })
      if (res.ok) { const data = await res.json(); const mediaUrl = data.media_s3_url || data.media_ipfs_url; if (mediaUrl) { const hashKey = (comparisonMatch.sha256 || comparisonMatch.assetId || '').toLowerCase(); localStorage.setItem(`vt_media_${hashKey}`, JSON.stringify({ sha256: hashKey, media_ipfs_url: data.media_ipfs_url, media_s3_url: data.media_s3_url, media_type: comparisonMatch.mediaType || 'image' })); localStorage.setItem(`vt_legacy_${hashKey}`, mediaUrl); setResolvedOriginalUrl(getGatewayUrl(mediaUrl)) } }
    } catch {} finally { setUploadingLegacy(false) }
  }

  const handleAnalyzeSync = async () => {
    if (!uploadedFile) return
    setSyncLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadedFile)
      const res = await fetch(`${HASH_ENGINE_API}/api/v1/analyze_sync`, { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        setSyncResult(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSyncLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-stretch rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="w-1 bg-[var(--bg-3)]" />
            <div className="flex-1 p-3.5"><div className="skeleton h-3.5 rounded w-70% mb-2" /><div className="skeleton h-2.5 rounded w-50%" /></div>
            <div className="p-3.5"><div className="skeleton w-10 h-10 rounded-full" /></div>
          </div>
        ))}
      </div>
    )
  }

  if (!results) return <EmptyState icon={<Search size={28} />} title="Upload a file to search" description="We'll check for exact SHA-256 matches and visually similar content in the registry." />
  if (results.length === 0) return <EmptyState icon={<CheckCircle2 size={28} />} title="No matches found" description="This content hasn't been registered yet. You can be the first to register it!" />

  // Identify the earliest registered match
  let earliestMatchHash = null
  if (results && results.length > 0) {
    let earliestTime = Infinity
    for (const r of results) {
      if (r.registeredAt) {
        const t = new Date(r.registeredAt).getTime()
        if (!isNaN(t) && t < earliestTime) {
          earliestTime = t
          earliestMatchHash = r.sha256
        }
      }
    }
  }

  // Check if matches belong to different creators (provenance dispute)
  const uniqueCreators = new Set(results.map(r => r.creator?.toLowerCase()).filter(Boolean))
  const isDisputed = uniqueCreators.size > 1

  return (
    <>
      {isDisputed && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-start gap-2.5 font-medium">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <strong className="text-red-400">Provenance Dispute Alert:</strong> Visually similar content has been registered by multiple different owner wallets. Check the timeline and registry dates below to identify the true original.
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {results.map((result, index) => (
          <MatchCard 
            key={index} 
            result={result} 
            isEarliest={result.sha256 === earliestMatchHash}
            onSelect={() => setComparisonMatch(result)} 
          />
        ))}
      </div>

      <Modal open={!!comparisonMatch} onClose={() => { setComparisonMatch(null); setHeatmapBase64(null); setSyncResult(null) }} maxWidth={resolvedOriginalUrl && resolvedMediaType === 'image' ? 'max-w-7xl' : 'max-w-5xl'}>
        {comparisonMatch && (
          <>
            <ModalHeader title={`Authenticity Check — ${comparisonMatch.similarity?.toFixed(1)}% Match`} onClose={() => { setComparisonMatch(null); setHeatmapBase64(null); setSyncResult(null) }} icon={<Search size={18} className="text-[#12AAFF]" />} />
            <div className="p-5 flex flex-col gap-4">
              <div className="grid gap-3" style={{ gridTemplateColumns: resolvedOriginalUrl && resolvedMediaType === 'image' ? '1fr 1fr 1fr' : '1fr 1fr' }}>
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)]">Uploaded Target (To Verify)</div>
                  <div className="flex-1 bg-[var(--bg-2)] rounded-xl border border-[var(--border)] overflow-hidden flex items-center justify-center min-h-[300px] relative">
                    {uploadedFile?.type?.startsWith('video/') ? <video src={localPreviewUrl} controls className="max-w-full max-h-full object-contain" /> : localPreviewUrl ? <img src={localPreviewUrl} alt="Uploaded" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-[var(--text-3)]">No image loaded</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)]">Matched Original (On-Chain)</div>
                  <div className="flex-1 bg-[var(--bg-2)] rounded-xl border border-[var(--border)] overflow-hidden flex items-center justify-center min-h-[300px] relative" onContextMenu={(e) => e.preventDefault()}>
                    {loadingOriginal ? <div className="text-center"><Spinner /><div className="text-xs text-[var(--text-3)] mt-2">Resolving media...</div></div> : resolvedOriginalUrl ? (
                        resolvedMediaType === 'video' ? <video src={resolvedOriginalUrl} controls controlsList="nodownload" className="max-w-full max-h-full object-contain" /> : <img src={resolvedOriginalUrl} alt="Matched" className="max-w-full max-h-full object-contain pointer-events-none select-none" />
                    ) : (
                      <div className="text-center p-4 flex flex-col items-center">
                        <Lock size={24} className="text-[var(--text-3)] mb-1" />
                        <div className="text-xs font-semibold text-[var(--text)]">Original Media Not Archived</div>
                        <div className="text-[10px] text-[var(--text-3)] mt-1 max-w-[240px]">This registration was created using a legacy version that did not store the media file online.</div>
                        {comparisonMatch.similarity === 100 && <Button variant="primary" size="sm" className="mt-3" onClick={handleArchiveLegacy} disabled={uploadingLegacy}><Cloud size={14} /> {uploadingLegacy ? 'Archiving...' : 'Archive to S3 & IPFS'}</Button>}
                      </div>
                    )}
                  </div>
                </div>
                {resolvedOriginalUrl && resolvedMediaType === 'image' && (
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF4D4D]">Pixel Diff Heatmap</div>
                    <div className="flex-1 bg-[var(--bg-2)] rounded-xl border border-dashed border-[#FF4D4D]/30 overflow-hidden flex items-center justify-center min-h-[300px]">
                      {heatmapLoading ? <div className="text-center"><Spinner className="!border-t-[#FF4D4D]" /><div className="text-xs text-[var(--text-3)] mt-2">Analyzing pixel diffs...</div></div> : heatmapBase64 ? <img src={heatmapBase64} alt="Heatmap" className="max-w-full max-h-full object-contain" /> : <div className="text-center p-4 flex flex-col items-center"><AlertTriangle size={24} className="text-[var(--text-3)] mb-1" /><div className="text-xs font-semibold text-[var(--text)]">Heatmap Not Loaded</div><Button variant="outline" size="sm" className="mt-3" onClick={handleViewAlterations}>Retry Analysis</Button></div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs border-t border-[var(--border)] pt-3">
                <div>
                  <div className="font-semibold text-[var(--text-2)] mb-1">Asset Identification</div>
                  <div className="text-[var(--text-3)]">SHA-256 Slice: <span className="font-mono text-[#12AAFF]">{comparisonMatch.assetId}</span></div>
                  <div className="text-[var(--text-3)]">AI Model: {comparisonMatch.aiTool || 'None (Authentic Content)'}</div>
                  {comparisonMatch.confidenceTier && (
                    <div className="text-[var(--text-3)]">Confidence Score: <span className="font-semibold text-[#00D395]">{comparisonMatch.confidenceScore?.toFixed(0)}% ({comparisonMatch.confidenceTier})</span></div>
                  )}
                </div>
                <div>
                  <div className="font-semibold text-[var(--text-2)] mb-1 font-bold">On-Chain Record</div>
                  <div className="text-[var(--text-3)]">Owner: <span className="font-mono">{comparisonMatch.creator ? `${comparisonMatch.creator.slice(0, 8)}...${comparisonMatch.creator.slice(-6)}` : 'Unknown'}</span></div>
                  <div className="text-[var(--text-3)]">Registered: {comparisonMatch.registeredAt}</div>
                  
                  {(comparisonMatch.isPublisherVerified || comparisonMatch.is_publisher_verified) && (
                    <div className="text-blue-400 font-bold flex items-center gap-1.5 mt-1 text-[11px]">
                      ✓ Verified Source: {comparisonMatch.publisherName || comparisonMatch.publisher_name}
                    </div>
                  )}
                  
                  {(comparisonMatch.publisherFlagCount || comparisonMatch.publisher_flag_count) > 0 && (
                    <div className="text-red-500 font-extrabold flex items-center gap-1.5 mt-1 text-[11px] bg-red-500/10 px-2 py-1 rounded border border-red-500/25">
                      ⚠️ Verified Editorial Alert: Disputed by Official Publisher
                    </div>
                  )}
                  
                  {(comparisonMatch.flagCount || comparisonMatch.flag_count) > 0 && !(comparisonMatch.publisherFlagCount || comparisonMatch.publisher_flag_count) && (
                    <div className="text-red-400 font-semibold flex items-center gap-1.5 mt-1 text-[11px]">
                      <Flag size={12} className="text-red-400" /> Disputed ({(comparisonMatch.flagCount || comparisonMatch.flag_count)} {(comparisonMatch.flagCount || comparisonMatch.flag_count) === 1 ? 'report' : 'reports'})
                    </div>
                  )}
                  {(comparisonMatch.consensusCount || comparisonMatch.consensus_count) > 1 && (
                    <div className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-1 text-[11px]">
                      🤝 Consensus: {(comparisonMatch.consensusCount || comparisonMatch.consensus_count)} independent creators verified
                    </div>
                  )}
                </div>
              </div>

              {/* Flag / Dispute Section */}
              <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3 mt-1">
                <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1"><Flag size={12} /> Dispute Registry Entry</div>
                      <div className="text-[10px] text-[var(--text-3)] mt-0.5">Flag this registry match if you believe it is a manipulated variant or plagiarized copy.</div>
                    </div>
                    {!showFlagForm && (
                      <Button variant="outline" size="sm" className="border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/30 text-xs py-1 transition-colors" onClick={() => setShowFlagForm(true)}>
                        File Dispute
                      </Button>
                    )}
                  </div>

                  {showFlagForm && (
                    <div className="flex flex-col gap-2 border-t border-red-500/10 pt-2.5">
                      <div className="text-[10px] font-semibold text-[var(--text-2)]">Flagger wallet: <span className="font-mono text-[var(--text-3)]">0x3d434220b22a0100d395000000000000000002ba</span> (Connected)</div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase font-bold text-[var(--text-3)]">Reason for Dispute</label>
                        <select className="w-full p-2 bg-[var(--bg-2)] border border-[var(--border)] rounded-lg text-xs focus:border-[#12AAFF] focus:outline-none" value={flagReason} onChange={(e) => setFlagReason(e.target.value)}>
                          <option value="Voice-Cloned/Audio Deepfake">Voice-Cloned/Audio Deepfake</option>
                          <option value="Cropped or Resized Derivative">Cropped or Resized Derivative</option>
                          <option value="Manipulated/Altered Pixels">Manipulated/Altered Pixels</option>
                          <option value="Plagiarized Copy">Plagiarized Copy</option>
                          <option value="Other / Metadata Override">Other / Metadata Override</option>
                        </select>
                      </div>
                      <div className="flex gap-2 justify-end mt-1">
                        <Button variant="outline" size="sm" className="text-xs py-1" onClick={() => setShowFlagForm(false)}>Cancel</Button>
                        <Button variant="primary" size="sm" className="bg-red-500 hover:bg-red-600 border-none text-xs py-1 text-white" onClick={submitDispute} disabled={submittingFlag}>
                          {submittingFlag ? 'Submitting...' : 'Submit Dispute'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Heritage Tree (Lineage DAG) */}
              <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-2)]">Asset Heritage Tree (Lineage DAG)</div>
                <div className="text-[11px] text-[var(--text-3)] mb-1">Trace original ancestors, sibling crops, and downstream derivatives. Click any node to inspect details.</div>
                
                {lineageLoading ? (
                  <div className="flex justify-center p-6"><Spinner /></div>
                ) : lineageData ? (
                  <div className="w-full overflow-x-auto py-6 bg-[var(--bg-2)] border border-[var(--border)] rounded-xl flex justify-center min-h-[180px]">
                    <div className="flex justify-center items-start min-w-max px-6">
                      <TreeNode 
                        node={lineageData} 
                        targetHash={comparisonMatch.sha256Hash || comparisonMatch.sha256_hash || comparisonMatch.sha256}
                        onSelectNode={(selectedNode) => {
                          setComparisonMatch({
                            sha256: selectedNode.sha256_hash || selectedNode.Sha256Hash,
                            creator: selectedNode.creator_address || selectedNode.CreatorAddress,
                            timestamp: selectedNode.timestamp || selectedNode.Timestamp,
                            phash: selectedNode.phash || selectedNode.PHash,
                            ipfsCid: selectedNode.ipfs_cid || selectedNode.IpfsCid,
                            aiTool: selectedNode.ai_tool || selectedNode.AiTool,
                            mediaIpfsUrl: selectedNode.media_ipfs_url || selectedNode.MediaIpfsUrl,
                            mediaS3Url: selectedNode.media_s3_url || selectedNode.MediaS3Url,
                            allowAiTraining: selectedNode.allow_ai_training || selectedNode.AllowAiTraining,
                            mediaType: selectedNode.media_type || selectedNode.MediaType
                          })
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 text-xs text-[var(--text-3)] bg-[var(--bg-2)] border border-[var(--border)] rounded-xl">No lineage tracking available.</div>
                )}
              </div>

              {/* Temporal Integrity & Deepfake Sync */}
              {(comparisonMatch.temporalIntegrity !== undefined || comparisonMatch.mediaType === 'video') && (
                <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                  {comparisonMatch.temporalIntegrity !== undefined && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 bg-[var(--bg-2)] border border-[var(--border)] rounded-xl">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)] mb-1">Temporal Sequence Integrity (DTW)</div>
                        <div className="flex items-center gap-2">
                          <Badge variant={comparisonMatch.temporalIntegrity > 90 ? 'success' : 'danger'}>{comparisonMatch.temporalIntegrity.toFixed(1)}%</Badge>
                          <span className="text-xs text-[var(--text-3)]">{comparisonMatch.temporalIntegrity > 90 ? 'Video sequence matches original temporally.' : 'Video may be chopped, reversed, or sped-up!'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {comparisonMatch.mediaType === 'video' && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 p-3 bg-[var(--bg-2)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)] mb-1">Deepfake Audio-Visual Sync</div>
                          <div className="text-xs text-[var(--text-3)]">Analyze lip movements and audio to detect AI voice-swaps.</div>
                        </div>
                        {syncResult ? (
                          <div className="text-right">
                            <Badge variant={syncResult.is_deepfake ? 'danger' : 'success'}>
                              {syncResult.is_deepfake ? 'DEEPFAKE DETECTED' : 'Sync Normal'}
                            </Badge>
                            <div className="text-[10px] text-[var(--text-3)] mt-1">Score: {syncResult.sync_score?.toFixed(2)}</div>
                          </div>
                        ) : (
                          <Button size="sm" onClick={handleAnalyzeSync} disabled={syncLoading}>
                            {syncLoading ? <Spinner /> : 'Run AI Analysis'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
            <div className="px-5 py-3 border-t border-[var(--border)] bg-[var(--bg-2)] flex justify-center gap-3">
              <Button variant="outline" className="border-[#12AAFF]/30 text-[#12AAFF] hover:bg-[#12AAFF]/10 hover:border-[#12AAFF]" onClick={handleDownloadCert}>
                📥 Download Certificate
              </Button>
              <Button variant="primary" onClick={() => { setComparisonMatch(null); setHeatmapBase64(null); setSyncResult(null) }}>
                Back to Results
              </Button>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}

function MatchCard({ result, onSelect, isEarliest }) {
  const isExact = result.matchType === 'exact'
  const isDeepfake = result.matchType === 'deepfake' || result.isDeepfake
  const isAudioDeepfake = result.isAudioDeepfake
  const percentage = result.similarity || 0
  const getGatewayUrl = (url) => url?.startsWith('ipfs://') ? `https://gateway.pinata.cloud/ipfs/${url.slice(7)}` : url
  const isLegacy = !result.ipfsCid || result.ipfsCid === '' || result.ipfsCid.startsWith('QmYourMetadataCid')
  const previewUrl = getGatewayUrl(result.mediaS3Url) || getGatewayUrl(result.mediaIpfsUrl)

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} onClick={onSelect} className="flex items-stretch rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden cursor-pointer hover:border-[var(--border-2)] hover:shadow-md transition-all group">
      <div className="w-1 flex-shrink-0" style={{ background: isExact ? '#00D395' : isDeepfake ? '#FF4D4D' : '#FF9B00' }} />
      <div className="flex items-center justify-center p-3 flex-shrink-0">
        {!previewUrl ? <div className="w-[140px] h-[95px] rounded-lg border border-[var(--border)] bg-[var(--bg-2)] flex items-center justify-center text-[10px] text-[var(--text-3)] text-center p-2 leading-tight">{isLegacy ? 'No preview (Legacy)' : 'Click to compare'}</div> : <img src={previewUrl} alt="Match" className="w-[140px] h-[95px] object-cover rounded-lg border border-[var(--border)] bg-[var(--bg-2)]" onError={(e) => { if (result.assetId && e.target.src !== `https://s3.veritrace.dpkvtrading.online/veritrace/${result.assetId}`) { e.target.src = `https://s3.veritrace.dpkvtrading.online/veritrace/${result.assetId}` } else { e.target.style.display = 'none' } }} />}
      </div>
      <div className="flex-1 p-3.5 flex flex-col justify-center gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={isExact ? 'success' : isDeepfake ? 'danger' : 'warning'}>{isExact ? <><CheckCircle2 size={10} /> Exact Match</> : isDeepfake ? 'DEEPFAKE DETECTED' : '≈ Similar'}</Badge>
          {isAudioDeepfake && <Badge variant="danger" className="ml-1">AUDIO DEEPFAKE</Badge>}
          {isEarliest && <Badge variant="success" className="ml-1 bg-[#12AAFF] hover:bg-[#12AAFF] text-white border-none">Earliest Registry</Badge>}
          {result.confidenceTier && (
            <Badge variant={result.confidenceTier === 'High' ? 'success' : result.confidenceTier === 'Medium' ? 'warning' : 'danger'} className="ml-1">
              Confidence: {result.confidenceTier} ({result.confidenceScore?.toFixed(0)}%)
            </Badge>
          )}
          {(result.isPublisherVerified || result.is_publisher_verified) && (
            <Badge variant="success" className="ml-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20 flex items-center gap-1 font-bold">
              ✓ Verified Source: {result.publisherName || result.publisher_name || 'Official Outlet'}
            </Badge>
          )}
          {(result.publisherFlagCount || result.publisher_flag_count) > 0 && (
            <Badge variant="danger" className="ml-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 flex items-center gap-1 font-bold">
              ⚠️ Verified Dispute Alert
            </Badge>
          )}
          {(result.flagCount || result.flag_count) > 0 && !(result.publisherFlagCount || result.publisher_flag_count) && (
            <Badge variant="danger" className="ml-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 flex items-center gap-1">
              <Flag size={10} className="text-red-400" /> {(result.flagCount || result.flag_count)} {(result.flagCount || result.flag_count) === 1 ? 'Dispute' : 'Disputes'}
            </Badge>
          )}
          {(result.consensusCount || result.consensus_count) > 1 && (
            <Badge variant="success" className="ml-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 flex items-center gap-1">
              🤝 Consensus: {(result.consensusCount || result.consensus_count)} Creators
            </Badge>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">{result.mediaType || 'unknown'}</span>
        </div>
        {result.assetId && <div className="text-xs"><span className="text-[var(--text-3)]">Asset: </span><span className="font-mono text-[#12AAFF]">{result.assetId}</span></div>}
        {result.creator && <div className="text-xs"><span className="text-[var(--text-3)]">Creator: </span><a href={`${ARBITRUM_SEPOLIA.explorer}/address/${result.creator}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[#12AAFF] hover:opacity-80" onClick={(e) => e.stopPropagation()}>{result.creator.slice(0, 10)}...{result.creator.slice(-6)}</a></div>}
        {result.registeredAt && <div className="text-xs text-[var(--text-3)]">Registered: {result.registeredAt}</div>}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {result.mediaS3Url && <a href={getGatewayUrl(result.mediaS3Url)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00D395]/10 hover:bg-[#00D395]/20 text-[#00D395] rounded-md text-[11px] font-bold border border-[#00D395]/20 transition-colors" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> S3 Media</a>}
          {result.mediaIpfsUrl && <a href={getGatewayUrl(result.mediaIpfsUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12AAFF]/10 hover:bg-[#12AAFF]/20 text-[#12AAFF] rounded-md text-[11px] font-bold border border-[#12AAFF]/20 transition-colors" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> IPFS Media</a>}
          {result.ipfsCid && <a href={`https://gateway.pinata.cloud/ipfs/${result.ipfsCid}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-3)] hover:bg-[var(--border)] text-[var(--text-2)] rounded-md text-[11px] font-bold border border-[var(--border)] transition-colors" onClick={(e) => e.stopPropagation()}><ExternalLink size={12} /> IPFS JSON</a>}
        </div>
      </div>
      <div className="flex items-center justify-center px-5 flex-shrink-0">
        <div className="text-center">
          <div className="text-xl font-extrabold" style={{ color: isExact ? '#00D395' : isDeepfake ? '#FF4D4D' : percentage >= 80 ? '#FF9B00' : 'var(--text-4)' }}>{percentage.toFixed(1)}%</div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">match</div>
        </div>
      </div>
    </motion.div>
  )
}
