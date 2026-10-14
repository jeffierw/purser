import React, { useState } from 'react';
import { formatCargoAmount, SUPPORTED_TOKENS } from '../mockContractState';
import type { Token } from '../types';
import { CargoSelect } from './CargoSelect';

interface OwnerHoldProps {
  hold: Record<string, string>;
  walletBalances: Record<string, string>;
  ownerAddress: string;
  onDeposit: (token: Token, amount: string) => void;
  onWithdraw: (token: Token, amount: string) => void;
}

export const OwnerHold: React.FC<OwnerHoldProps> = ({
  hold,
  walletBalances,
  ownerAddress,
  onDeposit,
  onWithdraw,
}) => {
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
            <span className="sup-kicker">SELF-CUSTODY</span>
            <span className="sup-pill-status">
              <i>●</i> Keys stay here
            </span>
          </div>
          <h2 className="sup-h2">Wallet</h2>
          <p className="sup-section-lede">
            {isEmpty
              ? 'This wallet’s coins on Monad Testnet. Nothing is locked in the strongbox yet. Only you can withdraw.'
              : 'Coins locked in the strongbox, beside what this wallet still holds. Only you can withdraw.'}
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

      <div className="sup-hold-grid">
        {SUPPORTED_TOKENS.map((token) => {
          const amount = hold[token.address] || '0';
          const walletAmount = walletBalances[token.address] || '0';
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
                <span className="balance-value">{formatCargoAmount(amount)}</span>
                <span className="balance-unit">{token.symbol} aboard</span>
              </div>
              <p className="mt-1 font-[family-name:var(--font-mono)] text-xs tracking-wide text-[#94A3B8]">
                In this wallet · {formatCargoAmount(walletAmount)} {token.symbol}
              </p>

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
                  <span className="muted-dormant">Nothing aboard</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
                <CargoSelect
                  ariaLabel="Cargo token"
                  value={depositTokenAddress}
                  onChange={setDepositTokenAddress}
                  options={SUPPORTED_TOKENS.map((token) => ({
                    value: token.address,
                    symbol: token.symbol,
                    name: token.name,
                  }))}
                />
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
                Calm withdrawal directly to the connected owner (<code>{ownerAddress.slice(0, 8)}…{ownerAddress.slice(-6)}</code>).
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
