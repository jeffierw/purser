import React, { useState } from 'react';
import type { UserRole } from '../types';
import { Logo } from './Logo';

interface EntranceDoorProps {
  onSelectRole: (role: UserRole) => void;
}

export const EntranceDoor: React.FC<EntranceDoorProps> = ({ onSelectRole }) => {
  const [authenticatingRole, setAuthenticatingRole] = useState<UserRole | null>(null);

  const handlePasskeyAuth = (role: UserRole) => {
    setAuthenticatingRole(role);
    setTimeout(() => {
      setAuthenticatingRole(null);
      onSelectRole(role);
    }, 550);
  };

  return (
    <div className="sup-entrance-wrapper">
      {/* Background technical coordinate grid */}
      <div className="sup-grid-bg" aria-hidden="true" />

      {/* Header Bar */}
      <header className="sup-entrance-nav">
        <div className="sup-nav-inner">
          <Logo size={36} showWordmark={true} />
          <div className="sup-nav-status-pill">
            <span className="sup-pulse-dot" />
            <span className="sup-status-text">MONAD MAINNET PROTOCOL</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="sup-hero-container">
        <div className="sup-hero-badge">
          <span className="sup-badge-idx">00</span>
          <span className="sup-badge-label">POLICY-BOUND SELF-CUSTODY</span>
        </div>

        <h1 className="sup-hero-title">
          The Strongbox for<br />
          <span className="sup-title-em">Authorized Operators.</span>
        </h1>

        <p className="sup-hero-lead">
          Self-custody where operators spend inside written warrants.
          Proceeds always return aboard. The operator never receives the keys.
        </p>

        {/* The Two Doors: Bento Layout */}
        <div className="sup-doors-bento">
          {/* Captain Door */}
          <div className="sup-bento-card door-card-owner">
            <div className="sup-card-header">
              <div className="sup-card-meta">
                <span className="sup-card-tier">EXECUTIVE TIER</span>
                <span className="sup-coord-tag">PORT // 01</span>
              </div>
              <h2 className="sup-card-title">The Captain</h2>
              <span className="sup-bound-badge">
                <i className="badge-ico">●</i> Sole Custody Authority
              </span>
            </div>

            <p className="sup-card-desc">
              Holds the strongbox and the master keys. Writes written warrants with hard spending caps, approved venues, and expiry windows. May strike every grant void in one stroke.
            </p>

            <div className="sup-card-features">
              <div className="sup-feat-row">
                <span className="feat-check">✓</span>
                <span>Deposit & calm withdrawal directly ashore</span>
              </div>
              <div className="sup-feat-row">
                <span className="feat-check">✓</span>
                <span>Draft typed allowances with per-trade limits</span>
              </div>
              <div className="sup-feat-row">
                <span className="feat-check">✓</span>
                <span>Instant global revocation via seal break</span>
              </div>
            </div>

            <div className="sup-card-action">
              <button
                type="button"
                className="sup-btn-primary"
                onClick={() => handlePasskeyAuth('owner')}
                disabled={authenticatingRole !== null}
              >
                <span className="btn-glyph">✦</span>
                <span>
                  {authenticatingRole === 'owner' ? 'Asserting Hardware Key…' : 'Come aboard as owner'}
                </span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>

          {/* Purser Door */}
          <div className="sup-bento-card door-card-operator">
            <div className="sup-card-header">
              <div className="sup-card-meta">
                <span className="sup-card-tier">OPERATIONS TIER</span>
                <span className="sup-coord-tag">PORT // 02</span>
              </div>
              <h2 className="sup-card-title">The Purser</h2>
              <span className="sup-bound-badge badge-operator">
                <i className="badge-ico">●</i> Policy-Bound Execution
              </span>
            </div>

            <p className="sup-card-desc">
              Spends strictly inside the written bounds of the posted warrant. Proceeds from every settlement return automatically to the ship’s custody. Zero withdrawal privilege.
            </p>

            <div className="sup-card-features">
              <div className="sup-feat-row">
                <span className="feat-check">✓</span>
                <span>Read active warrant limits & allowed venue pairs</span>
              </div>
              <div className="sup-feat-row">
                <span className="feat-check">✓</span>
                <span>Settle swaps up to per-trade ceiling</span>
              </div>
              <div className="sup-feat-row">
                <span className="feat-check">✓</span>
                <span>Zero key exposure • Zero withdrawal vectors</span>
              </div>
            </div>

            <div className="sup-card-action">
              <button
                type="button"
                className="sup-btn-secondary"
                onClick={() => handlePasskeyAuth('operator')}
                disabled={authenticatingRole !== null}
              >
                <span className="btn-glyph">✦</span>
                <span>
                  {authenticatingRole === 'operator' ? 'Asserting Hardware Key…' : 'Come aboard as operator'}
                </span>
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Technical Spec strip */}
        <div className="sup-spec-strip">
          <div className="strip-item">
            <span className="strip-label">HARDWARE DISCIPLINE</span>
            <span className="strip-val">FIDO2 / WebAuthn Passkeys</span>
          </div>
          <div className="strip-div" />
          <div className="strip-item">
            <span className="strip-label">CUSTODY MODEL</span>
            <span className="strip-val">Typed Allowances & In-Contract Returns</span>
          </div>
          <div className="strip-div" />
          <div className="strip-item">
            <span className="strip-label">REVOCATION LATENCY</span>
            <span className="strip-val">1 Atomic Epoch Strike</span>
          </div>
        </div>
      </main>
    </div>
  );
};
