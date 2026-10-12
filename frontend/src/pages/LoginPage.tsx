import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { OWNER_ADDRESS, DEFAULT_OPERATOR_ADDRESS } from '../mockContractState';

interface LoginPageProps {
  onLoginSuccess: (address: string, role: 'owner' | 'operator', walletName: string) => void;
  onClose: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onClose }) => {
  const [email, setEmail] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStepMessage, setAuthStepMessage] = useState('Checking your session…');

  const handleWalletSelect = (walletName: string, address: string, role: 'owner' | 'operator') => {
    setIsAuthenticating(true);
    setAuthStepMessage(`Connecting to ${walletName}…`);

    setTimeout(() => {
      setAuthStepMessage('Asserting signature & permissions…');
      setTimeout(() => {
        setIsAuthenticating(false);
        onLoginSuccess(address, role, walletName);
      }, 500);
    }, 600);
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsAuthenticating(true);
    setAuthStepMessage(`Authenticating ${email}…`);
    setTimeout(() => {
      setIsAuthenticating(false);
      onLoginSuccess(OWNER_ADDRESS, 'owner', 'Email Passkey');
    }, 800);
  };

  return (
    <div className="v5 lg-page-wrapper">
      {/* Left Aside: Brand Glass & Tagline */}
      <aside className="lg-aside">
        <span className="lg-glass" aria-hidden="true" />
        <div className="lg-aside-content">
          <div className="lg-aside-emblem">
            <Logo size={64} showWordmark={false} />
          </div>
          <p className="lg-tag">
            <span className="lg-tag-line">Your assets, Your agents, One strongbox,</span>
            <span className="lg-tag-line">
              just <span className="lg-em">“PURSER”</span>
            </span>
          </p>
          <span className="lg-subtext font-mono">MONAD MAINNET PROTOCOL</span>
        </div>
      </aside>

      {/* Right Main: Form and Auth Providers */}
      <main className="lg-main">
        <button
          type="button"
          className="lg-close"
          aria-label="Close and go back to the home page"
          onClick={onClose}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 5 14 14M19 5 5 19" />
          </svg>
        </button>

        <div className="lg-form">
          {isAuthenticating ? (
            <section className="lg-lead lg-loading-state" aria-live="polite">
              <div className="lg-spinner" />
              <h1 className="lg-h">{authStepMessage}</h1>
              <p className="lg-lede">Verifying hardware keys and self-custodial warrants aboard.</p>
            </section>
          ) : (
            <>
              <section className="lg-lead">
                <span className="lg-eyebrow">PORT OF MONAD // ACCESS</span>
                <h1 className="lg-h">Log in or Sign up</h1>
                <p className="lg-lede">
                  Connect your custody wallet or operator key to manage warrants, budgets, and atomic settlements.
                </p>
              </section>

              {/* Wallet Providers */}
              <div className="lg-providers">
                <button
                  type="button"
                  className="lg-btn lg-btn--wallet"
                  onClick={() => handleWalletSelect('Browser Wallet', OWNER_ADDRESS, 'owner')}
                >
                  <span className="lg-btn-icon">🦊</span>
                  <div className="lg-btn-text">
                    <span className="lg-btn-title">Browser Wallet</span>
                    <span className="lg-btn-subtitle">MetaMask, OKX, Rabby or Injected</span>
                  </div>
                  <span className="lg-btn-arrow">→</span>
                </button>

                <button
                  type="button"
                  className="lg-btn lg-btn--wallet"
                  onClick={() => handleWalletSelect('Passkey Hardware', OWNER_ADDRESS, 'owner')}
                >
                  <span className="lg-btn-icon">✦</span>
                  <div className="lg-btn-text">
                    <div className="btn-tag-row">
                      <span className="lg-btn-title">Passkey / Hardware Key</span>
                      <span className="sup-badge-passkey">FIDO2</span>
                    </div>
                    <span className="lg-btn-subtitle">Biometric Touch ID or YubiKey</span>
                  </div>
                  <span className="lg-btn-arrow">→</span>
                </button>

                <button
                  type="button"
                  className="lg-btn lg-btn--wallet"
                  onClick={() => handleWalletSelect('Operator Session Key', DEFAULT_OPERATOR_ADDRESS, 'operator')}
                >
                  <span className="lg-btn-icon">⚙</span>
                  <div className="lg-btn-text">
                    <div className="btn-tag-row">
                      <span className="lg-btn-title">Operator / Agent Key</span>
                      <span className="sup-badge-operator">Delegate</span>
                    </div>
                    <span className="lg-btn-subtitle">Pre-authorized spending identity</span>
                  </div>
                  <span className="lg-btn-arrow">→</span>
                </button>
              </div>

              {/* OR Divider */}
              <div className="lg-or">
                <span>OR EMAIL PASSKEY</span>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit} className="lg-email-form">
                <div className="lg-field">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address…"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="lg-btn lg-btn--primary">
                  <span>Continue</span>
                  <span>→</span>
                </button>
              </form>

              {/* Fine Legal Text */}
              <p className="lg-fine">
                By connecting, you agree to Purser’s <a href="#terms">Terms</a> and <a href="#privacy">Privacy</a>. Your keys stay on your device; strongbox limits are enforced on-chain.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
