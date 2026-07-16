/**
 * RegisterPage.jsx — Content Registration Flow
 * 
 * This page orchestrates the full registration pipeline:
 * 
 * Step 1: UPLOAD  — User drops/selects a file
 * Step 2: HASH    — File is sent to the Hash Engine API (POST /api/v1/register)
 *                    which returns SHA-256 and hash count. The hash engine also
 *                    registers the file in its local BoltDB for future verification.
 * Step 3: SIGN    — User fills optional AI tool attribution, then signs a
 *                    blockchain transaction calling registerContent() on the
 *                    VeritraceRegistry Stylus contract on Arbitrum Sepolia.
 * Step 4: CONFIRM — Transaction is confirmed on-chain. The Go backend's EVM
 *                    listener automatically picks up the ContentRegistered event
 *                    and indexes it in PostgreSQL, Redis, and Qdrant.
 * 
 * Dependencies:
 *   - ethers.js v6 for contract interaction via MetaMask
 *   - Hash Engine API at api.hash.veritrace.dpkvtrading.online
 *   - VeritraceRegistry contract at 0x468edc5b2fe9d1c919f2377cbe0ccb16f32ead29
 */
import { useState } from 'react'
import FileUpload from '../components/FileUpload'
import HashDisplay from '../components/HashDisplay'
import { useUpload } from '../context/UploadContext'
import { ethers } from 'ethers'
import { useAccount, useWriteContract, useConfig, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt } from '@wagmi/core'
import { parseAbi } from 'viem'
import { downloadCertificate } from '../utils/generateCertificate'
import {
  HASH_ENGINE_API,
  CORE_BACKEND_API,
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ARBITRUM_SEPOLIA,
} from '../config'

// Alphabetically ordered AI models dropdown categories
const AI_MODELS = [
  'None (Authentic Content)',
  'Adobe Firefly',
  'Claude 3.5 Sonnet',
  'DALL-E 3',
  'FLUX.1',
  'Gemini 1.5 Pro',
  'GPT-4o',
  'Llama 3',
  'Midjourney v6',
  'Stable Diffusion 3',
  'Other (Custom Input)'
]

export default function RegisterPage() {
  // ── Access persisted global state from UploadContext ──
  const {
    regFile: file, setRegFile: setFile,
    regStep: step, setRegStep: setStep,
    regProcessing: processing, setRegProcessing: setProcessing,
    regUploadProgress: uploadProgress, setRegUploadProgress: setUploadProgress,
    regSigning: signing, setRegSigning: setSigning,
    regAiCategory: aiCategory, setRegAiCategory: setAiCategory,
    regAiTool: aiTool, setRegAiTool: setAiTool,
    regHashes: hashes, setRegHashes: setHashes,
    regTxResult: txResult, setRegTxResult: setTxResult,
    regError: error, setRegError: setError,
  } = useUpload()

  const { address, isConnected, chain } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const config = useConfig()

  const [allowAiTraining, setAllowAiTraining] = useState(true)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [showAllKeyframes, setShowAllKeyframes] = useState(false)

  // Compute maximum AI confidence score across the asset and all video keyframes
  let maxConf = hashes.aiConfidenceScore || 0;
  if (hashes.keyframes) {
    hashes.keyframes.forEach(kf => {
      if (kf.ai_confidence_score > maxConf) maxConf = kf.ai_confidence_score;
    });
  }
  const showAiRequirement = aiCategory === 'None (Authentic Content)' && maxConf > 0.75;

  /**
   * handleFileSelected — Called when user picks a file.
   * Sends the file to the Hash Engine API for SHA-256 computation.
   * 
   * Uses XMLHttpRequest instead of fetch to track upload progress.
   * API: POST /api/v1/register
   * Body: multipart/form-data with fields "file" and "filename"
   * Response: { status, asset_id, media_type, sha256, hash_count }
   */
  const handleFileSelected = async (f) => {
    setFile(f)
    setError(null)
    setTxResult(null)
    setUploadProgress(0)

    if (!f) {
      setStep(1)
      setHashes({ sha256: null, hashCount: null, assetId: null, mediaType: null })
      return
    }

    try {
      setProcessing(true)

      // ── Use XMLHttpRequest to track live upload progress ──
      const data = await new Promise((resolve, reject) => {
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

        xhr.addEventListener('error', () => reject(new Error('Upload failed due to network error')))
        
        xhr.open('POST', `${HASH_ENGINE_API}/api/v1/hash`)
        xhr.send(formData)
      })

      /**
       * Handle the response:
       * - sha256: hex string of the file's SHA-256 hash
       * - phash: decimal string of the perceptual hash
       * - media_type: type of media parsed
       */
      if (!data.sha256) {
        throw new Error('Server response was missing SHA-256 hash')
      }

      setHashes({
        sha256: data.sha256,
        phash: data.phash,
        hashCount: data.keyframes ? data.keyframes.length : 0,
        assetId: `asset-${Date.now()}`,
        mediaType: data.media_type,
        aiConfidenceScore: data.ai_confidence_score,
        semanticHash: data.semantic_hash || [],
        faceHashes: data.face_hashes || [],
        audioHashes: data.audio_hashes || [],
        keyframes: data.keyframes || [],
      })
      setStep(2)
    } catch (err) {
      console.error('Hash engine error:', err)
      setError(`Failed to compute hashes: ${err.message}`)
    } finally {
      setProcessing(false)
    }
  }

  /**
   * handleRegister — Signs and sends the blockchain transaction.
   * 
   * Calls: registerContent(bytes32 sha256hash, uint64 phash, string ipfs_cid, string ai_tool)
   * 
   * The sha256 from the hash engine is a hex string (e.g. "a7ffc6f8...").
   * We prefix it with "0x" to create a valid bytes32 for the contract.
   * 
   * phash is set to 0 for now (the hash engine doesn't expose it directly;
   * the Go backend's EVM listener extracts it from the event data).
   * 
   * ipfs_cid is set to "" for MVP (IPFS upload not implemented yet).
   */
  const handleRegister = async () => {
    setError(null)

    // ── Check Wallet is connected ──
    if (!isConnected) {
      setError('Wallet is not connected. Please connect your wallet in the navigation bar.')
      return
    }

    try {
      setSigning(true)
      
      if (showAiRequirement) {
        setError(`Registration Blocked ❌\n\nOur AI analyzer detected a high probability (${Math.round(maxConf * 100)}%) that this media is AI-generated. You cannot register this as "None (Authentic Content)".\n\nPlease select the correct AI model from the dropdown to proceed.`);
        setSigning(false);
        return;
      }

      setStep(3)

      // ── Verify we're on Arbitrum Sepolia ──
      if (!chain || chain.id !== ARBITRUM_SEPOLIA.chainId) {
        try {
          if (switchChainAsync) {
            await switchChainAsync({ chainId: ARBITRUM_SEPOLIA.chainId })
          } else {
            throw new Error('Network switching is not supported by your wallet.')
          }
        } catch (switchErr) {
          throw new Error('Please switch to Arbitrum Sepolia network in your wallet.')
        }
      }

      /**
       * Prepare the sha256 hash as bytes32:
       * The hash engine returns a plain hex string like "a7ffc6f8bf1ed766..."
       * We need to prefix it with "0x" to parse it as bytes32.
       */
       const cleanHash = hashes.sha256.startsWith('0x') ? hashes.sha256.slice(2) : hashes.sha256
       const sha256Bytes32 = '0x' + cleanHash
 
       // ─────────────────────────────────────────────────────────────
       // PRE-FLIGHT CHECK: Verify if the hash is already registered
       // ─────────────────────────────────────────────────────────────
       try {
         const checkProvider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA.rpcUrl)
         const checkContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, checkProvider)
         
         // Calls verifyContent(bytes32). If it succeeds without reverting, it is already registered.
         const existingRecord = await checkContract.verifyContent(sha256Bytes32)
         if (existingRecord && Number(existingRecord[1]) !== 0) {
           throw new Error('This file has already been registered in the smart contract registry.')
         }
       } catch (checkErr) {
         // If it's our custom error, propagate it to block registration
         if (checkErr.message.includes('already been registered')) {
           throw checkErr
         }
         // Otherwise, the contract reverted (e.g. ContentNotFound), meaning it's unregistered and safe to proceed!
       }
 
       // ─────────────────────────────────────────────────────────────
       // STEP 1: Pin Raw Media to S3 / IPFS
       // ─────────────────────────────────────────────────────────────
      const fileFormData = new FormData()
      fileFormData.append('file', file) // file is the state variable holding the selected file

      const pinFileRes = await fetch(`${CORE_BACKEND_API}/api/v1/pin-file`, {
        method: 'POST',
        body: fileFormData,
      })

      if (!pinFileRes.ok) {
        const errText = await pinFileRes.text()
        throw new Error(`Failed to pin media file to storage: ${errText || pinFileRes.statusText}`)
      }

      const pinFileData = await pinFileRes.json()
      const mediaIpfsUrl = pinFileData.media_ipfs_url
      const mediaS3Url = pinFileData.media_s3_url

      // ─────────────────────────────────────────────────────────────
      // STEP 2: Pin Metadata to IPFS
      // ─────────────────────────────────────────────────────────────
      const metadataPayload = {
        sha256: sha256Bytes32,
        representative_phash: hashes.phash ? Number(hashes.phash) : 0,
        media_ipfs_url: mediaIpfsUrl,
        media_s3_url: mediaS3Url,
        allow_ai_training: allowAiTraining,
        webhook_url: webhookUrl,
        parent_sha256: '',
        media_type: hashes.mediaType || 'image',
        semantic_hash: hashes.semanticHash || [],
        face_hashes: hashes.faceHashes || [],
        audio_hashes: hashes.audioHashes || [],
        keyframes: hashes.keyframes || [],
      }

      const pinMetaRes = await fetch(`${CORE_BACKEND_API}/api/v1/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadataPayload),
      })

      if (!pinMetaRes.ok) {
        const errText = await pinMetaRes.text()
        throw new Error(`Failed to pin registration metadata: ${errText || pinMetaRes.statusText}`)
      }

      const pinMetaData = await pinMetaRes.json()
      const ipfsCid = pinMetaData.ipfs_cid

      // ─────────────────────────────────────────────────────────────
      // STEP 3: Blockchain Transaction (Smart Contract)
      // ─────────────────────────────────────────────────────────────
      
      // Fetch latest network fee details directly from Arbitrum RPC to bypass gas price spikes
      let safeMaxFee, safePriorityFee
      try {
        const feeProvider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA.rpcUrl)
        const feeData = await feeProvider.getFeeData()
        const multiplier = 200n // Apply a 2.0x safety buffer to base fees to guarantee inclusion
        
        safeMaxFee = feeData.maxFeePerGas 
          ? (feeData.maxFeePerGas * multiplier) / 100n 
          : undefined
          
        safePriorityFee = feeData.maxPriorityFeePerGas 
          ? (feeData.maxPriorityFeePerGas * multiplier) / 100n 
          : undefined
      } catch (feeErr) {
        console.warn('Failed to estimate custom gas overrides:', feeErr)
      }
      const txHash = await writeContractAsync({
        chainId: ARBITRUM_SEPOLIA.chainId,
        address: CONTRACT_ADDRESS,
        abi: parseAbi(CONTRACT_ABI),
        functionName: 'registerContent',
        args: [
          sha256Bytes32,
          hashes.phash ? BigInt(hashes.phash) : 0n,
          ipfsCid || '',
          aiTool || '',
        ],
        ...(safeMaxFee || safePriorityFee ? {
          maxFeePerGas: safeMaxFee,
          maxPriorityFeePerGas: safePriorityFee,
        } : {}),
      })

      // ── Wait for transaction confirmation ──
      const receipt = await waitForTransactionReceipt(config, {
        hash: txHash,
      })

      // Cache media urls in localStorage to avoid IPFS Gateway fallback/latency issues (prevent legacy registration display)
      try {
        const cacheKey = `vt_media_${sha256Bytes32.toLowerCase()}`
        const cacheData = {
          sha256: sha256Bytes32,
          media_ipfs_url: mediaIpfsUrl,
          media_s3_url: mediaS3Url,
          media_type: hashes.mediaType || 'image',
          ipfsCid: ipfsCid,
          keyframes: hashes.keyframes || []
        }
        localStorage.setItem(cacheKey, JSON.stringify(cacheData))
      } catch (e) {
        console.warn("Failed to write media cache to localStorage:", e)
      }

      setTxResult({
        hash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        mediaIpfsUrl: mediaIpfsUrl,
        mediaS3Url: mediaS3Url,
        ipfsCid: ipfsCid,
        sha256: sha256Bytes32,
      })
      setStep(4)
    } catch (err) {
      console.error('Registration error:', err)

      // ── Parse common error messages for user-friendly display ──
      let message = err.message
      if (message.includes('ContentAlreadyRegistered')) {
        message = 'This content hash is already registered on the blockchain.'
      } else if (message.includes('user rejected') || message.includes('User rejected')) {
        message = 'Transaction was rejected in your wallet.'
      } else if (message.includes('insufficient funds')) {
        message = 'Insufficient ETH for gas. Get free testnet ETH from the Lampros DAO Faucet.'
      }
      setError(message)
      setStep(2) // Go back to the signing step
    } finally {
      setSigning(false)
    }
  }

  /**
   * resetFlow — Clears all state and returns to Step 1.
   */
  const resetFlow = () => {
    setFile(null)
    setStep(1)
    setHashes({ sha256: null, hashCount: null, assetId: null, mediaType: null })
    setTxResult(null)
    setError(null)
    setAiTool('')
  }

  return (
    <section className="container" style={{ paddingTop: '1.5rem' }}>
      {/* ── Page header ── */}
      <div className="page-title">
        <h1>Register Content</h1>
        <div className="page-title-sub">
          Upload a file to fingerprint and register its authenticity on-chain
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
       * Progress Steps Indicator
       * ════════════════════════════════════════════════════════════ */}
      <div className="steps">
        <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <span className="step-number">{step > 1 ? '✓' : '1'}</span> Upload File
        </div>
        <div className={`step-connector ${step > 1 ? 'completed' : ''}`} />
        <div className={`step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <span className="step-number">{step > 2 ? '✓' : '2'}</span> Generate Hashes
        </div>
        <div className={`step-connector ${step > 2 ? 'completed' : ''}`} />
        <div className={`step ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          <span className="step-number">{step > 3 ? '✓' : '3'}</span> Sign & Register
        </div>
        <div className={`step-connector ${step > 3 ? 'completed' : ''}`} />
        <div className={`step ${step >= 4 ? 'active' : ''}`}>
          <span className="step-number">4</span> Confirmed
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
       * Two-column layout: Left = Upload + Hashes, Right = Register Action
       * ════════════════════════════════════════════════════════════ */}
      <div className="grid-2">
        {/* ── LEFT COLUMN: File Upload + Hash Results ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Upload card */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                File Upload
              </h2>
            </div>
            <div className="card-body">
              <FileUpload onFileSelected={handleFileSelected} />
            </div>
          </div>

          {/* Hash results card — shown after processing or while computing */}
          {(processing || hashes.sha256) && (
            <div className="card animate-slide-up">
              <div className="card-header">
                <h2 className="card-header-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Content Fingerprints
                </h2>
                {processing && <span className="badge badge-info">Computing...</span>}
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {processing ? (
                  /* Skeleton loading while hash engine processes the file */
                  <>
                    <div className="hash-display">
                      <div className="hash-label">SHA-256 CRYPTOGRAPHIC HASH</div>
                      <div className="skeleton skeleton-text" style={{ width: '100%', height: 38 }} />
                    </div>
                  </>
                ) : (
                  /* Show computed hashes */
                  <>
                    <HashDisplay
                      label="SHA-256 Cryptographic Hash"
                      hash={hashes.sha256 ? (hashes.sha256.startsWith('0x') ? hashes.sha256 : `0x${hashes.sha256}`) : null}
                      icon="C"
                      variant="crypto"
                    />
                    
                    {hashes.phash && (
                      <HashDisplay
                        label="Visual Perceptual Hash (phash)"
                        hash={hashes.phash}
                        icon="P"
                        variant="perceptual"
                      />
                    )}

                    {/* Additional metadata from hash engine */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8125rem' }}>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Asset ID: </span>
                        <span className="hash-tag">{hashes.assetId}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Type: </span>
                        <span>{hashes.mediaType}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)' }}>Hash Units: </span>
                        <span>{hashes.hashCount}</span>
                      </div>
                      {hashes.aiConfidenceScore !== undefined && hashes.aiConfidenceScore !== null && (
                        <div>
                          <span style={{ color: 'var(--color-text-muted)' }}>AI Score: </span>
                          <span style={{ fontWeight: 700, color: maxConf > 0.75 ? '#ef4444' : maxConf > 0.3 ? '#f59e0b' : '#22c55e' }}>
                            {Math.round(maxConf * 100)}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* ── Semantic Hash Vector ── */}
                    {hashes.semanticHash && Array.isArray(hashes.semanticHash) && hashes.semanticHash.length > 0 && (
                      <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', borderRadius: '4px', padding: '0.1rem 0.35rem', fontWeight: 700, fontSize: '0.7rem' }}>SEM</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Semantic Embedding Vector</span>
                          </div>
                          <span className="badge badge-info" style={{ fontSize: '0.6875rem' }}>{hashes.semanticHash.length}-dim</span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                          [{hashes.semanticHash.slice(0, 6).map(v => typeof v === 'number' ? v.toFixed(4) : v).join(', ')}{hashes.semanticHash.length > 6 ? ', …' : ''}]
                        </div>
                      </div>
                    )}

                    {/* ── Face Hash Embeddings ── */}
                    {hashes.faceHashes && Array.isArray(hashes.faceHashes) && hashes.faceHashes.length > 0 && (
                      <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', color: 'white', borderRadius: '4px', padding: '0.1rem 0.35rem', fontWeight: 700, fontSize: '0.7rem' }}>FACE</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>ArcFace Biometric Embeddings</span>
                          </div>
                          <span className="badge badge-success" style={{ fontSize: '0.6875rem' }}>
                            {Array.isArray(hashes.faceHashes[0]) ? hashes.faceHashes.length : 1} face{ (Array.isArray(hashes.faceHashes[0]) ? hashes.faceHashes.length : 1) > 1 ? 's' : ''} detected
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                          {Array.isArray(hashes.faceHashes[0]) ? (
                            hashes.faceHashes.map((fh, i) => (
                              <div key={i}>Face {i + 1}: [{fh.slice(0, 4).map(v => typeof v === 'number' ? v.toFixed(4) : v).join(', ')}, …] ({fh.length}-dim)</div>
                            ))
                          ) : (
                            <div>Face 1: [{hashes.faceHashes.slice(0, 6).map(v => typeof v === 'number' ? v.toFixed(4) : v).join(', ')}{hashes.faceHashes.length > 6 ? ', …' : ''}] ({hashes.faceHashes.length}-dim)</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Audio Hash Embeddings ── */}
                    {hashes.audioHashes && Array.isArray(hashes.audioHashes) && hashes.audioHashes.length > 0 && (
                      <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.75rem', border: '1px solid var(--color-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ background: 'linear-gradient(135deg, #dc2626, #ea580c)', color: 'white', borderRadius: '4px', padding: '0.1rem 0.35rem', fontWeight: 700, fontSize: '0.7rem' }}>AUD</span>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>wav2vec2 Voice Biometric</span>
                          </div>
                          <span className="badge" style={{ fontSize: '0.6875rem', background: 'rgba(234,88,12,0.15)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.3)' }}>
                            {Array.isArray(hashes.audioHashes[0]) ? `${hashes.audioHashes[0].length}-dim` : `${hashes.audioHashes.length}-dim`} vector
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                          {Array.isArray(hashes.audioHashes[0]) ? (
                            hashes.audioHashes.map((ah, i) => (
                              <div key={i}>Track {i + 1}: [{ah.slice(0, 4).map(v => typeof v === 'number' ? v.toFixed(4) : v).join(', ')}, …] ({ah.length}-dim)</div>
                            ))
                          ) : (
                            <div>Track 1: [{hashes.audioHashes.slice(0, 6).map(v => typeof v === 'number' ? v.toFixed(4) : v).join(', ')}{hashes.audioHashes.length > 6 ? ', …' : ''}] ({hashes.audioHashes.length}-dim)</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── Collapsible Keyframes Signatures List ── */}
                    {hashes.keyframes && hashes.keyframes.length > 0 && (
                      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '0.375rem', fontSize: '0.8125rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Extracted Video Keyframes ({hashes.keyframes.length})</span>
                          <button 
                            type="button"
                            className="btn btn-sm btn-secondary" 
                            style={{ padding: '0.125rem 0.5rem', fontSize: '0.6875rem', height: 'auto', minHeight: 'unset' }}
                            onClick={() => setShowAllKeyframes(!showAllKeyframes)}
                          >
                            {showAllKeyframes ? 'Show Less 🔼' : 'Show All 🔽'}
                          </button>
                        </div>
                        <div style={{ 
                          maxHeight: showAllKeyframes ? '220px' : '65px', 
                          overflowY: 'auto', 
                          background: 'var(--color-bg)', 
                          padding: '0.5rem', 
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--color-border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.725rem',
                          transition: 'max-height 0.25s ease-in-out'
                        }}>
                          {(showAllKeyframes ? hashes.keyframes : hashes.keyframes.slice(0, 2)).map((kf, i) => {
                            const offset = kf.offset !== undefined ? kf.offset : kf.Offset;
                            const phash = kf.phash !== undefined ? kf.phash : kf.PHash;
                            return (
                              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', paddingBottom: '0.25rem', borderBottom: '1px solid var(--color-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text)' }}>
                                  <span>⏱️ Offset: {offset}ms</span>
                                  <span style={{ color: 'var(--color-accent)' }}>🔑 pHash: {phash}</span>
                                </div>
                                {kf.semantic_hash && Array.isArray(kf.semantic_hash) && kf.semantic_hash.length > 0 && (
                                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.675rem' }}>🧠 sem: [{kf.semantic_hash.slice(0,3).map(v=>typeof v === 'number' ? v.toFixed(3) : v).join(', ')}, …]</span>
                                )}
                                {kf.face_hashes && Array.isArray(kf.face_hashes) && kf.face_hashes.length > 0 && (
                                  <span style={{ color: '#059669', fontSize: '0.675rem' }}>
                                    👤 {Array.isArray(kf.face_hashes[0]) ? kf.face_hashes.length : 1} face embedding{(Array.isArray(kf.face_hashes[0]) ? kf.face_hashes.length : 1) > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Blockchain Registration Action ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}>
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                Blockchain Registration
              </h2>
            </div>
            <div className="card-body">

              {/* ── STEP 1: Waiting for upload ── */}
              {step < 2 && !processing && (
                <div className="alert-box info">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <div>
                    Upload a file first. We'll compute its SHA-256 fingerprint via the hash engine, then you can register it on Arbitrum Sepolia.
                  </div>
                </div>
              )}

              {/* ── STEP 1b: Uploading & Computing hashes ── */}
              {processing && (
                <div style={{ padding: '1rem 0' }}>
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
                      <div style={{ fontWeight: 600, marginTop: '1rem' }}>Extracting & Hashing...</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        Upload complete! Extracting keyframes and generating signatures. This may take up to a minute for larger video files.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 2: Ready to sign ── */}
              {step === 2 && !processing && (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="alert-box success">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <div>
                      Fingerprints computed. Click below to sign a transaction and register on-chain.
                    </div>
                  </div>

                  {/* AI Tool Dropdown Attribution */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.375rem' }}>
                      AI Generator Attribution
                    </label>
                    <select
                      value={aiCategory}
                      onChange={(e) => {
                        const val = e.target.value
                        setAiCategory(val)
                        if (val === 'None (Authentic Content)') {
                          setAiTool('')
                        } else if (val !== 'Other (Custom Input)') {
                          setAiTool(val)
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-sans)',
                        backgroundColor: 'var(--color-surface)',
                        outline: 'none',
                        marginBottom: aiCategory === 'Other (Custom Input)' ? '0.75rem' : '0'
                      }}
                    >
                      {AI_MODELS.map(model => (
                        <option key={model} value={model}>{model}</option>
                      ))}
                    </select>
                    {showAiRequirement && (
                      <div style={{ color: 'var(--color-error)', fontSize: '0.75rem', marginTop: '0.375rem', fontWeight: 500 }}>
                        ⚠️ Our AI analyzer detected a high probability ({Math.round(maxConf * 100)}%) that this media is AI-generated. You must declare the correct AI model to proceed.
                      </div>
                    )}

                    {/* Secondary text input shown only when "Other (Custom Input)" is selected */}
                    {aiCategory === 'Other (Custom Input)' && (
                      <input
                        type="text"
                        value={aiTool}
                        onChange={(e) => setAiTool(e.target.value)}
                        placeholder="Enter custom AI model name (e.g. Ideogram, Sora)"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.8125rem',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontFamily: 'var(--font-sans)',
                          outline: 'none',
                        }}
                      />
                    )}
                  </div>

                  {/* AI Training Opt-in */}
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--color-text-secondary)' }}>
                      <input 
                        type="checkbox" 
                        checked={allowAiTraining} 
                        onChange={(e) => setAllowAiTraining(e.target.checked)}
                      />
                      Allow AI models to use this content for training
                    </label>
                  </div>

                  {/* Webhook URL Input */}
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.375rem' }}>
                      Webhook URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="e.g. Discord, Slack"
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.8125rem',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'var(--font-sans)',
                        backgroundColor: 'var(--color-surface)',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Transaction preview */}
                  <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
                    <div className="text-cap" style={{ marginBottom: '0.75rem' }}>Transaction Preview</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
                      <TxRow label="Contract" value="VeriTraceRegistry" accent />
                      <TxRow label="Method" value="registerContent(bytes32, uint64, string, string)" />
                      <TxRow label="SHA-256" value={`0x${hashes.sha256?.slice(0, 12)}...`} />
                      <TxRow label="Network" value="Arbitrum Sepolia" />
                      <TxRow label="AI Tool" value={aiTool || '(none)'} />
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary btn-lg w-full" 
                    onClick={handleRegister}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Register on Blockchain
                  </button>
                </div>
              )}

              {/* ── STEP 3: Waiting for MetaMask confirmation ── */}
              {step === 3 && signing && (
                <div className="animate-fade-in" style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div className="spinner" />
                  <div style={{ fontWeight: 600, marginTop: '1rem' }}>Waiting for confirmation...</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    Please confirm the transaction in MetaMask and wait for it to be mined
                  </div>
                </div>
              )}

              {/* ── STEP 4: Success ── */}
              {step === 4 && txResult && (
                <div className="animate-scale-in" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  {/* Success checkmark circle */}
                  <div style={{
                    width: 56, height: 56, margin: '0 auto 1rem',
                    background: 'var(--color-success-bg)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-success)',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: '0.375rem' }}>
                    Successfully Registered!
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                    Your content has been anchored on Arbitrum Sepolia
                  </div>

                  {/* Transaction details */}
                  <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '1rem', textAlign: 'left', fontSize: '0.8125rem' }}>
                    <TxRow label="Tx Hash">
                      <a
                        href={`${ARBITRUM_SEPOLIA.explorer}/tx/${txResult.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hash-tag"
                      >
                        {txResult.hash.slice(0, 16)}...{txResult.hash.slice(-8)}
                      </a>
                    </TxRow>
                    <TxRow label="Block" value={txResult.blockNumber?.toString()} />
                    <TxRow label="Status">
                      <span className="badge badge-success">Confirmed</span>
                    </TxRow>
                    {txResult.ipfsCid && (
                      <TxRow label="Metadata (IPFS)">
                        <a
                          href={`https://gateway.pinata.cloud/ipfs/${txResult.ipfsCid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hash-tag"
                          style={{ textDecoration: 'underline' }}
                        >
                          View on Pinata ↗
                        </a>
                      </TxRow>
                    )}
                    {txResult.mediaIpfsUrl && (
                      <TxRow label="Media (IPFS)">
                        <a
                          href={txResult.mediaIpfsUrl.replace('ipfs://', 'https://gateway.pinata.cloud/ipfs/')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hash-tag"
                          style={{ textDecoration: 'underline' }}
                        >
                          View on Pinata ↗
                        </a>
                      </TxRow>
                    )}
                    {txResult.mediaS3Url && (
                      <TxRow label="Media (S3)">
                        <a
                          href={txResult.mediaS3Url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hash-tag"
                          style={{ textDecoration: 'underline' }}
                        >
                          View on AWS S3 ↗
                        </a>
                      </TxRow>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexDirection: 'column' }}>
                    <button 
                      className="btn btn-primary btn-sm w-full" 
                      onClick={() => downloadCertificate(txResult, address, CORE_BACKEND_API)}
                    >
                      📄 Download PDF Certificate
                    </button>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <a
                        href={`${ARBITRUM_SEPOLIA.explorer}/tx/${txResult.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-sm"
                        style={{ flex: 1, textDecoration: 'none' }}
                      >
                        View on Arbiscan ↗
                      </a>
                      <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={resetFlow}>
                        Register Another
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Error display ── */}
              {error && (
                <div className="alert-box danger" style={{ marginTop: '1rem' }}>
                  <span>⚠️</span>
                  <div style={{ wordBreak: 'break-word' }}>{error}</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Info card: What gets stored ── */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-header-title">What gets stored?</h2>
            </div>
            <div className="card-body" style={{ fontSize: '0.8125rem', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <InfoRow label="On-Chain" color="var(--color-accent)"
                  items={['SHA-256 hash (bytes32)', 'Wallet address (msg.sender)', 'Block timestamp', 'AI tool attribution']} />
                <InfoRow label="Hash Engine (BoltDB)" color="var(--color-info)"
                  items={['SHA-256 hash', 'Perceptual hash units', 'File content (for verification)', 'Asset metadata']} />
                <InfoRow label="Backend (Postgres/Qdrant)" color="var(--color-success)"
                  items={['Event-sourced metadata', 'pHash vectors (64-dim)', 'Redis exact-match cache']} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Transaction preview row — key/value pair */
function TxRow({ label, value, accent, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      {children || (
        <span style={{ color: accent ? 'var(--color-accent)' : 'inherit' }}>{value}</span>
      )}
    </div>
  )
}

/** Info row with colored bullet and items list */
function InfoRow({ label, items, color }) {
  return (
    <div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.75rem',
        textTransform: 'uppercase', letterSpacing: '0.05em', color,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: 0.6 }} />
        {label}
      </div>
      <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
        {items.map((item, i) => (
          <li key={i} style={{ color: 'var(--color-text-secondary)' }}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
