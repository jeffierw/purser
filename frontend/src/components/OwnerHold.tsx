import React, { useState } from 'react';
import { SUPPORTED_TOKENS, OWNER_ADDRESS } from '../mockContractState';
import type { Token } from '../types';

interface OwnerHoldProps {
  hold: Record<string, string>;
  onDeposit: (token: Token, amount: string) => void;
  onWithdraw: (token: Token, amount: string) => void;
}

export const OwnerHold: React.FC<OwnerHoldProps> = ({ hold, onDeposit, onWithdraw }) => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState<Token | null>(null);

  const [depositTokenAddress, setDepositTokenAddress] = useState<string>(SUPPORTED_TOKENS[0].address);
  const [depositAmount, setDepositAmount] = useState<string>('');

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');

  const nonZeroBalances = SUPPORTED_TOKENS.filter((t) => {
    const val = parseFloat(hold[t.address] || '0');
    return val > 0;
  });

  const isEmpty = nonZeroBalances.length === 0;

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = SUPPORTED_TOKENS.find((t) => t.address === depositTokenAddress);
    if (!token || !depositAmount || parseFloat(depositAmount) <= 0) return;
    onDeposit(token, depositAmount);
    setDepositAmount('');
    setShowDepositModal(false);
  };

  const handleWithdrawSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showWithdrawModal || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    onWithdraw(showWithdrawModal, withdrawAmount);
    setWithdrawAmount('');
    setShowWithdrawModal(null);
  };

  return (
    <section className="sup-section owner-hold-section">
      <div className="sup-section-band">
        <div className="sup-coordcell">
          <span className="sup-idx">01</span>
        </div>
        <div className="sup-titlecell">
          <div className="sup-title-meta">
            <span className="sup-kicker">CUSTODIAL RESERVE</span>
            <span className="sup-pill-status">
              <i>●</i> Strongbox Locked
            </span>
          </div>
          <h2 className="sup-h2">The Hold</h2>
          <p className="sup-section-lede">
            Cargo tokens presently locked aboard the strongbox under the Captain’s sole withdrawal power.
          </p>
        </div>
        <div className="sup-section-cta">
          <button
            type="button"
            className="sup-action-btn primary"
            onClick={() => setShowDepositModal(true)}
          >
            Put funds aboard
          </button>
        </div>
      </div>

      {isEmpty ? (
        <div className="sup-empty-card">
          <div className="sup-empty-inner">
            <span className="empty-ico">⚓︎</span>
            <h3 className="empty-title">Nothing aboard yet</h3>
            <p className="empty-text">
              The hold lies completely vacant. Transfer native MON or ERC20 cargo into the strongbox contract to fund warrant allowances.
            </p>
            <button
              type="button"
              className="sup-action-btn primary"
              onClick={() => setShowDepositModal(true)}
            >
              Put funds aboard
            </button>
          </div>
        </div>
      ) : (
        <div className="sup-hold-grid">
          {SUPPORTED_TOKENS.map((token) => {
            const amount = hold[token.address] || '0';
            const hasBalance = parseFloat(amount) > 0;

            return (
              <div
                key={token.address}
                className={`sup-asset-card ${hasBalance ? 'is-active' : 'is-zero'}`}
              >
                <div className="asset-card-top">
                  <div className="asset-identity">
                    <span className="asset-symbol">{token.symbol}</span>
                    <span className="asset-fullname">{token.name}</span>
                  </div>
                  <span className="asset-type-tag">
                    {token.isNative ? 'Native Monad' : 'ERC-20 Cargo'}
                  </span>
                </div>

                <div className="asset-card-balance">
                  <span className="balance-value">{amount}</span>
                  <span className="balance-unit">{token.symbol}</span>
                </div>

                <div className="asset-card-foot">
                  {hasBalance ? (
                    <button
                      type="button"
                      className="sup-link-btn"
                      onClick={() => {
                        setShowWithdrawModal(token);
                        setWithdrawAmount(amount);
                      }}
                    >
                      Take ashore <span>→</span>
                    </button>
                  ) : (
                    <span className="muted-dormant">Zero balance</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Put Funds Aboard Modal */}
      {showDepositModal && (
        <div className="sup-modal-overlay" onClick={() => setShowDepositModal(false)}>
          <div className="sup-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="sup-modal-head">
              <div className="head-text">
                <span className="modal-eyebrow">CAPTAIN DECK</span>
                <h3 className="modal-title">Put Funds Aboard</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowDepositModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleDepositSubmit} className="sup-modal-form">
              <p className="modal-description">
                Lock assets into the self-custodial strongbox. Once aboard, only the Captain holds the withdrawal keys.
              </p>

              <div className="sup-form-group">
                <label className="sup-form-label">CARGO TOKEN</label>
                <select
                  value={depositTokenAddress}
                  onChange={(e) => setDepositTokenAddress(e.target.value)}
                  className="sup-select"
                >
                  {SUPPORTED_TOKENS.map((t) => (
                    <option key={t.address} value={t.address}>
                      {t.symbol} — {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sup-form-group">
                <label className="sup-form-label">DEPOSIT AMOUNT</label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  required
                  placeholder="e.g. 500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="sup-input"
                />
              </div>

              <div className="sup-modal-actions">
                <button
                  type="button"
                  className="sup-btn-plain"
                  onClick={() => setShowDepositModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="sup-btn-highlight">
                  Commit Funds Aboard
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="sup-modal-overlay" onClick={() => setShowWithdrawModal(null)}>
          <div className="sup-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="sup-modal-head">
              <div className="head-text">
                <span className="modal-eyebrow">RESERVE RETRIEVAL</span>
                <h3 className="modal-title">Take Ashore</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowWithdrawModal(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleWithdrawSubmit} className="sup-modal-form">
              <p className="modal-description">
                Calm withdrawal directly to the Captain’s verified custody address (<code>{OWNER_ADDRESS.slice(0, 8)}…{OWNER_ADDRESS.slice(-6)}</code>).
              </p>

              <div className="sup-form-group">
                <label className="sup-form-label">
                  WITHDRAW {showWithdrawModal.symbol} (AVAILABLE: {hold[showWithdrawModal.address] || '0'})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  max={hold[showWithdrawModal.address] || '0'}
                  required
                  placeholder="e.g. 100"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="sup-input"
                />
              </div>

              <div className="sup-modal-actions">
                <button
                  type="button"
                  className="sup-btn-plain"
                  onClick={() => setShowWithdrawModal(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="sup-btn-highlight">
                  Take Ashore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
