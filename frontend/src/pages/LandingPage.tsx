import React from 'react';
import { Logo } from '../components/Logo';

interface LandingPageProps {
  onLaunchApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp }) => {
  return (
    <div className="sup-landing-root">
      <div className="sup-grid-bg" aria-hidden="true" />

      {/* Top Navbar */}
      <header className="sup-landing-nav">
        <div className="nav-container">
          <div className="nav-brand-area">
            <Logo size={36} showWordmark={true} />
          </div>

          <nav className="nav-center-links">
            <a href="#custody" className="nav-link">Custody Model</a>
            <a href="#warrants" className="nav-link">Typed Warrants</a>
            <a href="#pipeline" className="nav-link">Policy Pipeline</a>
          </nav>

          <div className="nav-action-area">
            <button
              type="button"
              className="sup-launch-btn-primary"
              onClick={onLaunchApp}
            >
              <span>Launch app</span>
              <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="hero-content">
          <div className="hero-badge">
            <span className="badge-idx">00</span>
            <span className="badge-txt">TYPED ALLOWANCES ON MONAD</span>
          </div>

          <h1 className="hero-headline">
            One Strongbox for<br />
            <span className="hero-em">Authorized Operators.</span>
          </h1>

          <p className="hero-lede">
            A self-custodial strongbox where delegates and AI agents trade strictly inside typed limits you set.
            Proceeds always return aboard. The operator never receives the keys.
          </p>

          <div className="hero-cta-group">
            <button
              type="button"
              className="hero-btn-launch"
              onClick={onLaunchApp}
            >
              <span>Launch app</span>
              <span className="arrow">→</span>
            </button>

            <a href="#architecture" className="hero-btn-docs">
              <span>View Protocol Specs</span>
            </a>
          </div>
        </div>
      </section>

      {/* Bento Grid Highlights (Sup Wallet style) */}
      <section id="custody" className="landing-bento-section">
        <div className="section-band">
          <div className="band-coord">
            <span>01</span>
          </div>
          <div className="band-title">
            <span className="band-kicker">POLICY ENFORCEMENT</span>
            <h2 className="band-h2">Exactly what's allowed. Whole, or not at all.</h2>
          </div>
        </div>

        <div className="landing-bento-grid">
          <div className="bento-highlight-card">
            <span className="card-kicker">A WARRANT NAMES FOUR THINGS</span>
            <h3 className="card-title">Strict Typed Allowances</h3>
            <p className="card-desc">
              Token to spend, total authorized budget, per-trade ceiling, and valid window. Anything beyond these bounds is refused by smart contract law.
            </p>
            <div className="card-visual-pill font-mono">
              <code>Budget: 1,000 USDC // Cap: 250 USDC // Window: Active</code>
            </div>
          </div>

          <div className="bento-highlight-card">
            <span className="card-kicker">ATOMIC PROCEEDS RETURN</span>
            <h3 className="card-title">Came Aboard Guarantee</h3>
            <p className="card-desc">
              All swap and settlement yields return exclusively to the strongbox contract address. The operator possesses zero withdrawal permissions.
            </p>
            <div className="card-visual-pill font-mono">
              <code>Receiver = Address(This) // Withdraw Vectors = 0</code>
            </div>
          </div>

          <div className="bento-highlight-card">
            <span className="card-kicker">ONE ACTION TERMINATION</span>
            <h3 className="card-title">Instant Global Seal Break</h3>
            <p className="card-desc">
              The owner breaks the seal with one single transaction. Every active grant across the entire ship is struck null instantly.
            </p>
            <div className="card-visual-pill font-mono">
              <code>Epoch += 1 // Invalidation Latency = 1 Block</code>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-wrap">
          <div className="footer-brand">
            <Logo size={28} showWordmark={true} />
            <span className="footer-meta">Self-custodial strongbox for Monad Harbor.</span>
          </div>
          <button type="button" className="footer-launch-link" onClick={onLaunchApp}>
            Launch app →
          </button>
        </div>
      </footer>
    </div>
  );
};
