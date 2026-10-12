import React from 'react';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletName: string, accountAddress: string, role: 'owner' | 'operator') => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, onConnect }) => {
  if (!isOpen) return null;

  const walletOptions = [
    {
      id: 'browser',
      name: 'Browser Wallet (Injected)',
      desc: 'MetaMask, Rabby, OKX or default provider',
      icon: '🦊',
      defaultAddress: '0x8b32A247c4b07Ccf8e5d36e298516c944Dfc108C',
      role: 'owner' as const,
    },
    {
      id: 'passkey',
      name: 'Passkey / Hardware Enclave',
      desc: 'FIDO2 WebAuthn biometric security',
      icon: '✦',
      defaultAddress: '0x8b32A247c4b07Ccf8e5d36e298516c944Dfc108C',
      role: 'owner' as const,
    },
    {
      id: 'operator_agent',
      name: 'Operator / Agent Session Key',
      desc: 'Pre-authorized delegate address',
      icon: '⚙',
      defaultAddress: '0x3F88cA37E84B5B49d863581775796f61F1E67C92',
      role: 'operator' as const,
    },
  ];

  return (
    <div className="sup-modal-overlay" onClick={onClose}>
      <div className="wallet-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="wallet-modal-header">
          <div>
            <h3 className="wallet-modal-title">Connect Wallet</h3>
            <p className="wallet-modal-sub">Choose a custody provider or operator key</p>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="wallet-list">
          {walletOptions.map((w) => (
            <button
              key={w.id}
              type="button"
              className="wallet-option-btn"
              onClick={() => {
                onConnect(w.name, w.defaultAddress, w.role);
                onClose();
              }}
            >
              <span className="wallet-opt-icon">{w.icon}</span>
              <div className="wallet-opt-text">
                <div className="opt-name-row">
                  <span className="opt-name">{w.name}</span>
                  <span className={`opt-tag ${w.role === 'owner' ? 'tag-owner' : 'tag-op'}`}>
                    {w.role === 'owner' ? 'Owner Account' : 'Operator Key'}
                  </span>
                </div>
                <span className="opt-desc">{w.desc}</span>
              </div>
              <span className="opt-arrow">→</span>
            </button>
          ))}
        </div>

        <div className="wallet-modal-footer">
          <span className="footer-safe-hint">
            🔒 Self-custodial connection. Purser never accesses your private keys.
          </span>
        </div>
      </div>
    </div>
  );
};
