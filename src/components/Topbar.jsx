/**
 * Topbar.jsx — Network status indicator + faucet marquee
 * 
 * Shows "Arbitrum Sepolia Testnet" badge with a green pulse dot,
 * and a scrolling banner linking to the Lampros DAO Faucet for
 * free testnet ETH (no mainnet ETH required).
 */
export default function Topbar() {
  return (
    <>
      {/* ── Dark topbar showing active network ── */}
      <section className="topbar">
        <div className="container">
          <div className="topbar-badge">
            <span className="dot"></span>
            Arbitrum Sepolia Testnet
          </div>
          <div className="topbar-right">
            <span>VeriTrace Content Registry</span>
          </div>
        </div>
      </section>

      {/* ── Scrolling faucet banner ──
          Uses repeated blocks in a flex layout to ensure it's wider than any screen width,
          enabling a 100% gapless continuous loop. Hovering pauses the scroll. */}
      <div className="marquee-banner">
        <div className="marquee-track">
          <div className="marquee-content">
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
          </div>
          <div className="marquee-content">
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
            <span>🚰 Need free testnet ETH? Get 0.01 Arbitrum Sepolia ETH from the&nbsp;<a href="https://faucet.lamprosdao.com/" target="_blank" rel="noopener noreferrer">Lampros DAO Faucet</a></span>
            <span className="marquee-separator">⚡</span>
          </div>
        </div>
      </div>
    </>
  )
}
