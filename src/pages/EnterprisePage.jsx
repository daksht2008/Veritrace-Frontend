import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWriteContract, useConfig, useSwitchChain } from 'wagmi'
import { waitForTransactionReceipt, readContract } from '@wagmi/core'
import { parseAbi } from 'viem'
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert } from '../components/ui/alert'
import { Spinner } from '../components/ui/spinner'
import { Select } from '../components/ui/input'
import { toast } from 'sonner'
import { SpotlightCard } from '../components/aceternity/SpotlightCard'
import { ArbitrumLogo } from '../components/ArbitrumLogo'
import PageHero from '../components/PageHero'
import { Database, Shield, CheckCircle2, AlertTriangle, ExternalLink, Download, Globe, Building, Check, FileText, Copy } from 'lucide-react'
import { CORE_BACKEND_API, CONTRACT_ADDRESS, CONTRACT_ABI, ARBITRUM_SEPOLIA } from '../config'

// Mock USDC Address on Sepolia (usually provided by environment, hardcoded for demo)
const MOCK_USDC_ADDRESS = '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'

export default function EnterprisePage() {
  const { address, isConnected, chain } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const { switchChainAsync } = useSwitchChain()
  const config = useConfig()

  const [mediaType, setMediaType] = useState('image')
  const [quantity, setQuantity] = useState(100)
  const [searchQuery, setSearchQuery] = useState('')
  
  const [querying, setQuerying] = useState(false)
  const [datasetData, setDatasetData] = useState(null)
  
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [unlockedLinks, setUnlockedLinks] = useState([])
  const [error, setError] = useState(null)

  const [activeTab, setActiveTab] = useState('dataset')
  const [publisherDomain, setPublisherDomain] = useState('')
  const [publisherOrg, setPublisherOrg] = useState('')
  const [verifyingPublisher, setVerifyingPublisher] = useState(false)
  const [publishersList, setPublishersList] = useState([])
  const [fetchingPublishers, setFetchingPublishers] = useState(false)

  const fetchPublishers = async () => {
    setFetchingPublishers(true)
    try {
      const res = await fetch(`${CORE_BACKEND_API}/api/v1/publisher/list`)
      const data = await res.json()
      if (res.ok && data.publishers) {
        setPublishersList(data.publishers)
      }
    } catch (err) {
      console.error('Failed to fetch publishers:', err)
    } finally {
      setFetchingPublishers(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'publisher') {
      fetchPublishers()
    }
  }, [activeTab])

  const handleVerifyPublisher = async (e) => {
    e.preventDefault()
    if (!publisherDomain || !publisherOrg) {
      toast.error('Domain and Organization Name are required')
      return
    }
    const targetAddress = address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
    
    setVerifyingPublisher(true)
    try {
      const res = await fetch(`${CORE_BACKEND_API}/api/v1/publisher/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: publisherDomain,
          address: targetAddress
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      toast.success('Domain bound and verified successfully!')
      fetchPublishers()
      setPublisherDomain('')
      setPublisherOrg('')
    } catch (err) {
      toast.error(`Verification Failed: ${err.message}`)
    } finally {
      setVerifyingPublisher(false)
    }
  }

  const handleQuery = async () => {
    setQuerying(true)
    setError(null)
    setDatasetData(null)
    setPurchaseSuccess(false)
    try {
      let url = `${CORE_BACKEND_API}/api/v1/enterprise/dataset?type=${mediaType}&quantity=${quantity}`
      if (searchQuery) url += `&query=${encodeURIComponent(searchQuery)}`
      
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to query dataset')
      setDatasetData(data)
    } catch (err) {
      setError(err.message)
      toast.error(`Query Failed: ${err.message}`)
    } finally {
      setQuerying(false)
    }
  }

  const handlePurchase = async () => {
    setError(null)
    if (!isConnected) {
      setError('Wallet is not connected. Please connect your wallet in the navigation bar.')
      return
    }
    if (!datasetData) return

    try {
      setPurchasing(true)
      
      if (!chain || chain.id !== ARBITRUM_SEPOLIA.chainId) {
        try { await switchChainAsync({ chainId: ARBITRUM_SEPOLIA.chainId }) } 
        catch { throw new Error('Please switch to Arbitrum Sepolia network in your wallet.') }
      }

      const totalUsdc = BigInt(datasetData.total_usdc)

      // 1. Approve USDC if necessary
      const ERC20_ABI = parseAbi([
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)'
      ])

      const currentAllowance = await readContract(config, {
        chainId: ARBITRUM_SEPOLIA.chainId,
        address: MOCK_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, CONTRACT_ADDRESS],
      })

      let safeMaxFee, safePriorityFee
      try {
        const feeProvider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA.rpcUrl)
        const feeData = await feeProvider.getFeeData()
        const mult = 1000n // 10x buffer for extreme testnet volatility
        safeMaxFee = feeData.maxFeePerGas ? (feeData.maxFeePerGas * mult) / 100n : undefined
        safePriorityFee = feeData.maxPriorityFeePerGas ? (feeData.maxPriorityFeePerGas * mult) / 100n : undefined
      } catch {}

      if (currentAllowance < totalUsdc) {
        toast.info('Approving USDC for payment...')
        const approveHash = await writeContractAsync({
          chainId: ARBITRUM_SEPOLIA.chainId,
          address: MOCK_USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACT_ADDRESS, totalUsdc],
          ...(safeMaxFee || safePriorityFee ? { maxFeePerGas: safeMaxFee, maxPriorityFeePerGas: safePriorityFee } : {}),
        })
        await waitForTransactionReceipt(config, { hash: approveHash })
        toast.success('USDC Approved!')
      }
      
      // 2. Prepare args
      const creators = datasetData.creators
      const amounts = datasetData.amounts.map(a => BigInt(a))

      const hash = await writeContractAsync({
        chainId: ARBITRUM_SEPOLIA.chainId,
        address: CONTRACT_ADDRESS,
        abi: parseAbi(CONTRACT_ABI),
        functionName: 'purchaseDatasetAccess',
        args: [MOCK_USDC_ADDRESS, creators, amounts, totalUsdc],
        ...(safeMaxFee || safePriorityFee ? { maxFeePerGas: safeMaxFee, maxPriorityFeePerGas: safePriorityFee } : {}),
      })
      
      const receipt = await waitForTransactionReceipt(config, { hash })
      
      setTxHash(receipt.transactionHash)
      
      // 3. Unlock S3 URLs from backend
      toast.info('Transaction confirmed! Unlocking high-res S3 links...')
      const unlockRes = await fetch(`${CORE_BACKEND_API}/api/v1/enterprise/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: receipt.transactionHash,
          hashes: datasetData.hashes,
        })
      })
      const unlockData = await unlockRes.json()
      
      if (!unlockRes.ok) {
        throw new Error(unlockData.error || 'Failed to unlock S3 links')
      }
      
      setUnlockedLinks(unlockData.links || [])
      setPurchaseSuccess(true)
      toast.success('Successfully purchased and unlocked dataset!')
    } catch (err) {
      let message = err.message
      if (message.includes('user rejected') || message.includes('User rejected')) message = 'Transaction was rejected in your wallet.'
      else if (message.includes('insufficient allowance')) message = 'Insufficient USDC allowance. Please approve the contract to spend your USDC.'
      setError(message)
      toast.error(`Purchase failed: ${message}`)
    } finally {
      setPurchasing(false)
    }
  }

  return (
    <section>
      <PageHero 
        eyebrow="VERITRACE ENTERPRISE API" 
        title="Source clean, opted-in AI training data." 
        description="Query registered datasets on Arbitrum. Pay creators directly via smart contract splits to instantly unlock high-resolution media." 
        icon={Database} 
      />
      <div className="max-w-[1280px] mx-auto px-5 pt-7 pb-20">
        
        {isConnected && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-2xl border border-[var(--arb-border)] bg-[var(--arb-bg)]">
            <AlertTriangle size={15} className="text-[#12AAFF] flex-shrink-0" />
            <p className="text-xs text-[var(--text-2)] leading-relaxed">
              Purchasing requires Sepolia USDC. This is a testnet demo. Ensure you have approved the VeriTrace registry to spend your test tokens.
            </p>
          </div>
        )}

        <div className="flex border-b border-[var(--border)] mb-6 gap-2">
          <button
            onClick={() => setActiveTab('dataset')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'dataset'
                ? 'border-[#12AAFF] text-[#12AAFF] bg-[#12AAFF]/5 rounded-t-xl'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'
            }`}
          >
            📂 Dataset Licensing Market
          </button>
          <button
            onClick={() => setActiveTab('publisher')}
            className={`py-3 px-6 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'publisher'
                ? 'border-[#12AAFF] text-[#12AAFF] bg-[#12AAFF]/5 rounded-t-xl'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'
            }`}
          >
            🏢 Verified Publisher Network
          </button>
        </div>

        {activeTab === 'dataset' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* Query Form */}
          <div className="flex flex-col gap-5">
            <SpotlightCard>
              <Card className="card-hover-glow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Database size={16} className="text-[#12AAFF]" /> Query Dataset</CardTitle>
                </CardHeader>
                <CardBody className="flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-3)] block mb-1.5">Media Type</label>
                    <Select value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
                      <option value="image">Images</option>
                      <option value="video">Videos</option>
                      <option value="text">Text / Documents</option>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-3)] block mb-1.5">Target Quantity</label>
                    <input 
                      type="number" 
                      value={quantity} 
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[#12AAFF]"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text-3)] block mb-1.5">Semantic Search Prompt (Optional)</label>
                    <input 
                      type="text" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder='e.g. "cyberpunk cityscapes" or "rainy weather"'
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[#12AAFF]"
                    />
                    <p className="text-[10px] text-[var(--text-3)] mt-1.5 leading-relaxed">
                      Powered by AI vector search. Leave blank to fetch a random selection.
                    </p>
                  </div>
                  
                  <Button variant="primary" size="lg" className="w-full mt-2" onClick={handleQuery} disabled={querying}>
                    {querying ? <Spinner size="sm" /> : 'Search Available Content'}
                  </Button>

                  {error && <Alert variant="error">{error}</Alert>}
                </CardBody>
              </Card>
            </SpotlightCard>
          </div>

          {/* Results & Checkout */}
          <div className="flex flex-col gap-5">
            <SpotlightCard>
              <Card className="card-hover-glow card-border-animate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Shield size={16} className="text-[#12AAFF]" /> Dataset Checkout</CardTitle>
                </CardHeader>
                <CardBody>
                  <AnimatePresence mode="wait">
                    {!datasetData && !querying && !purchaseSuccess && (
                      <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <Alert variant="info">Query a dataset to see pricing and availability.</Alert>
                      </motion.div>
                    )}

                    {querying && (
                      <motion.div key="querying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center py-8">
                         <Spinner size="lg" />
                         <div className="mt-3 text-sm font-semibold">Scanning Content Registry...</div>
                      </motion.div>
                    )}

                    {datasetData && !purchaseSuccess && (
                      <motion.div key="results" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col gap-4">
                        <Alert variant="success">{datasetData.message}</Alert>

                        <div className="bg-[var(--bg-2)] rounded-xl p-4 border border-[var(--border)]">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)] mb-3 flex items-center gap-1.5">
                            <ArbitrumLogo size={12} /> Purchase Summary
                          </div>
                          
                          <div className="flex flex-col gap-2 text-sm mb-4 pb-4 border-b border-[var(--border)]">
                            <div className="flex justify-between">
                              <span className="text-[var(--text-3)]">Items Available</span>
                              <span className="font-bold">{datasetData.total_items}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-3)]">Unique Creators</span>
                              <span className="font-bold">{datasetData.creators.length}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-[var(--text-3)]">Platform Fee (5%)</span>
                              <span className="font-bold text-[#12AAFF]">${(datasetData.platform_fee / 1000000).toFixed(2)}</span>
                            </div>
                            
                            {datasetData.creators.length > 0 && (
                              <div className="mt-3 p-3 rounded-lg bg-[var(--surface-3)] border border-[var(--border-2)]">
                                <div className="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">Creator Payouts</div>
                                <div className="max-h-[100px] overflow-y-auto no-scrollbar flex flex-col gap-2">
                                  {datasetData.creators.map((c, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-xs">
                                      <span className="font-mono text-[var(--text-2)]">{c.slice(0, 8)}...{c.slice(-6)}</span>
                                      <span className="font-semibold text-[#00D395]">${(Number(datasetData.amounts[idx]) / 1000000).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex justify-between items-end mb-1">
                            <span className="text-[var(--text-3)] font-semibold">Total Cost</span>
                            <span className="text-2xl font-bold text-[#00D395]">${(datasetData.total_usdc / 1000000).toFixed(2)} USDC</span>
                          </div>
                        </div>

                        {datasetData.captions && Object.keys(datasetData.captions).length > 0 && (
                          <div className="mb-4 p-4 rounded-xl bg-[var(--surface-3)] border border-[var(--border-2)] max-h-64 overflow-y-auto">
                            <div className="text-[11px] font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">
                              Dataset Human Previews
                            </div>
                            <div className="flex flex-col gap-2">
                              {Object.entries(datasetData.captions).map(([hash, caption]) => (
                                <div key={hash} className="text-sm p-3 rounded-lg bg-[var(--bg-2)] border border-[var(--border)]">
                                  <span className="font-mono text-xs text-[#12AAFF] block mb-1">Hash: {hash.slice(0, 12)}...</span>
                                  <span className="text-[var(--text)] italic">"{caption}"</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {datasetData.semantic_embeddings && Object.keys(datasetData.semantic_embeddings).length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs text-[var(--text-3)] mb-2 leading-relaxed">
                              You can download the raw 512-dimensional CLIP semantic embeddings to test the reliability and relevance of this dataset locally before executing the purchase.
                            </p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full border-[#12AAFF]/30 hover:border-[#12AAFF] hover:bg-[#12AAFF]/10 text-[#12AAFF]" 
                              onClick={() => {
                                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(datasetData.semantic_embeddings, null, 2));
                                const downloadAnchorNode = document.createElement('a');
                                downloadAnchorNode.setAttribute("href", dataStr);
                                downloadAnchorNode.setAttribute("download", "semantic_previews.json");
                                document.body.appendChild(downloadAnchorNode);
                                downloadAnchorNode.click();
                                downloadAnchorNode.remove();
                              }}
                            >
                              <Download size={14} className="mr-2" /> Download Semantic Previews
                            </Button>
                          </div>
                        )}

                        <Button 
                          variant="success" 
                          size="lg" 
                          className="w-full" 
                          onClick={handlePurchase}
                          disabled={purchasing}
                        >
                          {purchasing ? <Spinner size="sm" /> : <span className="flex items-center gap-2"><Shield size={18} /> Execute Smart Contract Payment</span>}
                        </Button>
                      </motion.div>
                    )}

                    {purchaseSuccess && (
                      <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-4">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1, type: 'spring' }} className="w-14 h-14 rounded-full bg-[var(--success-bg)] text-[#00D395] flex items-center justify-center mx-auto mb-3">
                          <CheckCircle2 size={28} />
                        </motion.div>
                        <div className="font-bold text-lg mb-1 text-[var(--text)]">Dataset Unlocked!</div>
                        <div className="text-xs text-[var(--text-3)] mb-4">Payment distributed to {datasetData.creators.length} creators via Arbitrum Sepolia.</div>

                        <div className="bg-[var(--bg-2)] rounded-xl p-4 border border-[var(--border)] text-left text-xs mb-4">
                          <div className="flex justify-between mb-2">
                            <span className="text-[var(--text-3)]">Tx Hash</span>
                            <a href={`${ARBITRUM_SEPOLIA.explorer}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#12AAFF] hover:opacity-80 font-mono">
                              {txHash.slice(0, 10)}...{txHash.slice(-8)}
                            </a>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--text-3)]">Items Access</span>
                            <span className="font-bold text-[#00D395]">{datasetData.total_items} High-Res Files</span>
                          </div>
                        </div>

                        <Button 
                          variant="primary" 
                          size="lg" 
                          className="w-full mb-3"
                          onClick={() => {
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(unlockedLinks, null, 2));
                            const downloadAnchorNode = document.createElement('a');
                            downloadAnchorNode.setAttribute("href", dataStr);
                            downloadAnchorNode.setAttribute("download", "unlocked_dataset.json");
                            document.body.appendChild(downloadAnchorNode);
                            downloadAnchorNode.click();
                            downloadAnchorNode.remove();
                          }}
                        >
                          <Download size={18} className="mr-2" /> Download Unlocked S3 URLs ({unlockedLinks.length})
                        </Button>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => {
                          setPurchaseSuccess(false)
                          setDatasetData(null)
                          setUnlockedLinks([])
                        }}>
                          Query New Dataset
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardBody>
              </Card>
            </SpotlightCard>
          </div>

        </div>
        )}

        {activeTab === 'publisher' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="flex flex-col gap-6">
              {/* Domain Registration Form */}
              <SpotlightCard>
                <Card className="card-hover-glow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe size={18} className="text-[#12AAFF]" /> Organization Registration
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-4">
                    <form onSubmit={handleVerifyPublisher} className="flex flex-col gap-4">
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-3)] block mb-1.5">Organization Name</label>
                        <input
                          type="text"
                          value={publisherOrg}
                          onChange={(e) => setPublisherOrg(e.target.value)}
                          placeholder='e.g. "Associated Press"'
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[#12AAFF]"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-3)] block mb-1.5">Official Web Domain</label>
                        <input
                          type="text"
                          value={publisherDomain}
                          onChange={(e) => setPublisherDomain(e.target.value)}
                          placeholder='e.g. "apnews.com"'
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text)] outline-none focus:border-[#12AAFF]"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-3)] block mb-1.5">Publisher Wallet Address</label>
                        <input
                          type="text"
                          value={address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'}
                          disabled
                          className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-[var(--bg-2)] border border-[var(--border)] text-[var(--text-3)] font-mono outline-none cursor-not-allowed"
                        />
                      </div>
                      <Button variant="primary" size="lg" className="w-full mt-2" type="submit" disabled={verifyingPublisher}>
                        {verifyingPublisher ? <Spinner size="sm" /> : 'Request Domain Attestation'}
                      </Button>
                    </form>
                  </CardBody>
                </Card>
              </SpotlightCard>

              {/* JSON Template Card */}
              <SpotlightCard>
                <Card className="border-[#12AAFF]/20 bg-[#12AAFF]/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#12AAFF]">
                      <FileText size={14} /> HTTPS DID Requirement
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="text-xs text-[var(--text-2)] flex flex-col gap-3">
                    <p>
                      Before clicking verify, you must host a JSON metadata file on your domain at:
                    </p>
                    <div className="bg-[var(--bg-2)] p-2 rounded font-mono text-[10px] text-[#12AAFF] break-all border border-[var(--border)]">
                      https://{publisherDomain || "[your-domain]"}/.well-known/veritrace.json
                    </div>
                    <p>File content format:</p>
                    <pre className="bg-[var(--bg-2)] p-3 rounded-lg font-mono text-[10px] text-[var(--text)] overflow-x-auto border border-[var(--border)] relative group">
                      {JSON.stringify({
                        organization_name: publisherOrg || "Associated Press",
                        domain: publisherDomain || "apnews.com",
                        creator_address: address || "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                      }, null, 2)}
                    </pre>
                  </CardBody>
                </Card>
              </SpotlightCard>
            </div>

            <div className="flex flex-col gap-6">
              {/* Publishers List */}
              <SpotlightCard>
                <Card className="card-hover-glow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building size={18} className="text-[#12AAFF]" /> Verified Publisher Network
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="flex flex-col gap-4">
                    {fetchingPublishers ? (
                      <div className="text-center py-8 text-[var(--text-3)] text-sm flex flex-col items-center gap-2">
                        <Spinner /> Retrieving trusted directory...
                      </div>
                    ) : publishersList.length === 0 ? (
                      <div className="text-center py-8 text-[var(--text-3)] text-sm">
                        No verified publishers registered yet. Use the form to verify.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {publishersList.map((pub) => (
                          <div key={pub.creator_address} className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex flex-col gap-2 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-[4px] h-full bg-[#12AAFF]" />
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-[var(--text)] flex items-center gap-1.5">
                                🏢 {pub.organization_name}
                                <Badge variant="success" className="bg-[#12AAFF]/10 text-[#12AAFF] border-[#12AAFF]/20 text-[9px] py-0 px-1.5 flex items-center gap-0.5">
                                  ✓ DID Bound
                                </Badge>
                              </span>
                              <a href={`https://${pub.domain}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#12AAFF] hover:underline flex items-center gap-1">
                                {pub.domain} <ExternalLink size={10} />
                              </a>
                            </div>
                            <div className="text-[10px] text-[var(--text-3)] font-mono truncate">
                              Wallet: {pub.creator_address}
                            </div>
                            <div className="text-[9px] text-[var(--text-3)] flex items-center justify-between mt-1 border-t border-[var(--border)] pt-2">
                              <span>Verified: {new Date(pub.verified_at * 1000).toLocaleDateString()}</span>
                              <span className="text-[#00D395] font-bold">✓ On-Chain Registry</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </SpotlightCard>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
