import React, { useState } from 'react';
import { connectInjectedWallet, walletErrorMessage } from '../contracts/wallet';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletName: string, accountAddress: string, role: 'owner' | 'operator') => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!isOpen) return null;

  const connect = async () => {
    setError('');
    setPending(true);
    try {
      const session = await connectInjectedWallet();
      onConnect(session.walletName, session.address, session.role);
      onClose();
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="sup-modal-overlay" onClick={onClose}>
      <div className="wallet-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-modal-header">
          <div>
            <h3 className="wallet-modal-title">Connect Wallet</h3>
            <p className="wallet-modal-sub">Monad Testnet. The strongbox assigns owner or operator.</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="wallet-list">
          <button type="button" className="wallet-option-btn" disabled={pending} onClick={() => void connect()}>
            <span className="wallet-opt-icon">🦊</span>
            <div className="wallet-opt-text">
              <div className="opt-name-row">
                <span className="opt-name">Browser Wallet</span>
              </div>
              <span className="opt-desc">MetaMask, Rabby, or another injected wallet</span>
            </div>
            <span className="opt-arrow">→</span>
          </button>
        </div>

        {error ? <p className="lg-connect-error">{error}</p> : null}

        <div className="wallet-modal-footer">
          <span className="footer-safe-hint">
            Self-custodial connection. Purser never receives the private key.
          </span>
        </div>
      </div>
    </div>
  );
};
