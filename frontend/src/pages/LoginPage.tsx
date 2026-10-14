import React, { useState } from 'react';
import { Logo } from '../components/Logo';
import { connectInjectedWallet, walletErrorMessage } from '../contracts/wallet';
import {
  boardWithMeraKey,
  describeMeraFailure,
  disconnectMera,
  unlockMeraKeys,
  type AccessNotice,
  type MeraKey,
} from '../contracts/mera';
import { SocialLogin } from '../components/SocialLogin';
import { PRIVY_APP_ID } from '../privy';

interface LoginPageProps {
  onLoginSuccess: (address: string, role: 'owner' | 'operator', walletName: string, deployed?: boolean) => void;
  onClose: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onClose }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authStepMessage, setAuthStepMessage] = useState('Checking your session…');
  const [notice, setNotice] = useState<AccessNotice | null>(null);
  const [waitLede, setWaitLede] = useState('The strongbox is checking whether this account is allowed aboard.');
  const [meraKeys, setMeraKeys] = useState<MeraKey[] | null>(null);

  const showIssue = (message: string) => {
    const lower = message.toLowerCase();
    const closed =
      lower.includes('closed') ||
      lower.includes('dismiss') ||
      lower.includes('cancel') ||
      lower.includes('reject') ||
      lower.includes('exited');
    setNotice(
      closed
        ? { tone: 'calm', message: 'That window closed. Nothing changed. You can try again, or come aboard another way.' }
        : { tone: 'alert', message }
    );
  };

  const handlePasskey = async () => {
    setNotice(null);
    setIsAuthenticating(true);
    setAuthStepMessage('Confirm your passkey');
    setWaitLede('Your browser will ask once. Closing that window brings you back here.');
    try {
      const keys = await unlockMeraKeys();
      setMeraKeys(keys);
      setNotice({
        tone: 'calm',
        message: 'Two keys from this passkey. Each one can open its own strongbox.',
      });
      setIsAuthenticating(false);
    } catch (error) {
      setIsAuthenticating(false);
      setNotice(describeMeraFailure(error));
    }
  };

  const handleMeraKey = async (index: number) => {
    setNotice(null);
    setIsAuthenticating(true);
    setAuthStepMessage('Checking this key');
    setWaitLede('The strongbox is matching it to the owner or the operator.');
    try {
      const session = await boardWithMeraKey(index);
      setIsAuthenticating(false);
      onLoginSuccess(session.address, session.role, session.walletName, session.deployed);
    } catch (error) {
      setIsAuthenticating(false);
      setNotice(describeMeraFailure(error));
    }
  };

  const handleBrowserWallet = async () => {
    disconnectMera();
    setMeraKeys(null);
    setNotice(null);
    setIsAuthenticating(true);
    setAuthStepMessage('Opening your browser wallet');
    setWaitLede('Approve Monad Testnet if the wallet asks. Closing the window brings you back here.');
    try {
      const session = await connectInjectedWallet();
      setIsAuthenticating(false);
      onLoginSuccess(session.address, session.role, session.walletName, session.deployed);
    } catch (error) {
      setIsAuthenticating(false);
      showIssue(walletErrorMessage(error));
    }
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
          <span className="lg-subtext font-mono">MONAD TESTNET</span>
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
              <p className="lg-lede">{waitLede}</p>
            </section>
          ) : null}
          <div hidden={isAuthenticating}>
            <>
              <section className="lg-lead">
                <span className="lg-eyebrow">PORT OF MONAD // ACCESS</span>
                <h1 className="lg-h">Come aboard</h1>
                <p className="lg-lede">
                  A passkey opens two keys from one confirmation. Google, X, and Discord open an embedded wallet. A new address can open its own strongbox.
                </p>
              </section>

              {notice ? <p className={notice.tone === 'calm' ? 'lg-note' : 'lg-connect-error'}>{notice.message}</p> : null}

              <div className="lg-providers">
                <button type="button" className="lg-btn lg-btn--wallet" onClick={() => void handlePasskey()}>
                  <span className="lg-btn-icon">Pk</span>
                  <div className="lg-btn-text">
                    <span className="lg-btn-title">Passkey</span>
                    <span className="lg-btn-subtitle">One confirmation, then choose a key</span>
                  </div>
                  <span className="lg-btn-arrow">→</span>
                </button>
                {meraKeys ? (
                  <div className="lg-key-sheet">
                    <span className="lg-key-kicker">SAME PASSKEY</span>
                    <p className="lg-hint">Each key can open its own strongbox. Pick the one you want to use.</p>
                    {meraKeys.map((key) => (
                      <button
                        key={key.index}
                        type="button"
                        className="lg-btn lg-btn--wallet"
                        onClick={() => void handleMeraKey(key.index)}
                      >
                        <span className="lg-btn-icon">{key.index + 1}</span>
                        <div className="lg-btn-text">
                          <span className="lg-btn-title">Key {key.index + 1}</span>
                          <span className="lg-btn-subtitle font-mono">
                            {key.address.slice(0, 6)}…{key.address.slice(-4)}
                          </span>
                        </div>
                        <span className="lg-btn-arrow">→</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="lg-or">
                <span>OR</span>
              </div>

              {PRIVY_APP_ID ? (
                <SocialLogin
                  disabled={isAuthenticating}
                  onStart={(message) => {
                    setNotice(null);
                    setIsAuthenticating(true);
                    setAuthStepMessage(message);
                    setWaitLede('Finish signing in there. Closing the window brings you back here.');
                  }}
                  onSuccess={(address, role, walletName, deployed) => {
                    setIsAuthenticating(false);
                    onLoginSuccess(address, role, walletName, deployed);
                  }}
                  onError={(message) => {
                    setIsAuthenticating(false);
                    showIssue(message);
                  }}
                />
              ) : (
                <div className="lg-providers">
                  {[
                    ['G', 'Google'],
                    ['X', 'X'],
                    ['D', 'Discord'],
                  ].map(([mark, title]) => (
                    <button
                      key={title}
                      type="button"
                      className="lg-btn lg-btn--wallet"
                      onClick={() =>
                        setNotice({
                          tone: 'calm',
                          message: `${title} sign-in is not open on this voyage yet. A passkey or a browser wallet can come aboard now.`,
                        })
                      }
                    >
                      <span className="lg-btn-icon">{mark}</span>
                      <div className="lg-btn-text">
                        <span className="lg-btn-title">{title}</span>
                        <span className="lg-btn-subtitle">Opens an embedded wallet</span>
                      </div>
                      <span className="lg-btn-arrow">→</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="lg-or">
                <span>OR BROWSER WALLET</span>
              </div>

              <div className="lg-providers">
                <button
                  type="button"
                  className="lg-btn lg-btn--wallet"
                  onClick={() => void handleBrowserWallet()}
                >
                  <span className="lg-btn-icon lg-btn-icon--emoji">🦊</span>
                  <div className="lg-btn-text">
                    <span className="lg-btn-title">Browser Wallet</span>
                    <span className="lg-btn-subtitle">MetaMask, Rabby, or another injected wallet</span>
                  </div>
                  <span className="lg-btn-arrow">→</span>
                </button>
              </div>

              {/* Fine Legal Text */}
              <p className="lg-fine">
                By connecting, you agree to Purser’s <a href="#terms">Terms</a> and <a href="#privacy">Privacy</a>. A browser wallet keeps its key in the extension. Google, X, and Discord use an embedded wallet. If this address has no strongbox yet, you can open one after you come aboard.
              </p>
            </>
          </div>
        </div>
      </main>
    </div>
  );
};
