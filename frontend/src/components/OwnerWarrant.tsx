import React, { useState } from 'react';
import { SUPPORTED_TOKENS } from '../mockContractState';
import type { Budget, Token } from '../types';
import { WaxSeal } from './WaxSeal';

interface OwnerWarrantProps {
  warrants: Record<string, Budget>;
  currentEpoch: number;
  operatorAddress: string;
  onUpdateOperator: (address: string) => void;
  onSaveWarrant: (warrant: Budget) => void;
}

export const OwnerWarrant: React.FC<OwnerWarrantProps> = ({
  warrants,
  currentEpoch,
  operatorAddress,
  onUpdateOperator,
  onSaveWarrant,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tokenInAddress, setTokenInAddress] = useState<string>(SUPPORTED_TOKENS[1].address);
  const [remainingBudget, setRemainingBudget] = useState<string>('1000');
  const [perTxCap, setPerTxCap] = useState<string>('250');
  const [expiryOption, setExpiryOption] = useState<'none' | 'date'>('none');
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [allowedDestinations, setAllowedDestinations] = useState<string[]>([
    SUPPORTED_TOKENS[0].address,
    SUPPORTED_TOKENS[2].address,
  ]);
  const [operatorInput, setOperatorInput] = useState<string>(operatorAddress);

  const warrantList = Object.values(warrants);

  const toggleDestination = (address: string) => {
    if (allowedDestinations.includes(address)) {
      setAllowedDestinations(allowedDestinations.filter((a) => a !== address));
    } else {
      setAllowedDestinations([...allowedDestinations, address]);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remainingBudget || !perTxCap || allowedDestinations.length === 0) return;

    if (operatorInput !== operatorAddress) {
      onUpdateOperator(operatorInput);
    }

    let validUntilTs: number | null = null;
    if (expiryOption === 'date' && expiryDate) {
      validUntilTs = new Date(expiryDate).getTime();
    }

    const newWarrant: Budget = {
      tokenAddress: tokenInAddress,
      remaining: remainingBudget,
      perTxCap: perTxCap,
      validUntil: validUntilTs,
      epoch: currentEpoch,
      active: true,
      allowedTokensOut: allowedDestinations,
      delegateAddress: operatorInput,
      createdAt: Date.now(),
    };

    onSaveWarrant(newWarrant);
    setIsEditing(false);
  };

  const getToken = (addr: string): Token | undefined => {
    return SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === addr.toLowerCase());
  };

  return (
    <section className="sup-section owner-warrant-section">
      <div className="sup-section-band">
        <div className="sup-coordcell">
          <span className="sup-idx">02</span>
        </div>
        <div className="sup-titlecell">
          <div className="sup-title-meta">
            <span className="sup-kicker">TYPED ALLOWANCES</span>
            <span className="sup-pill-status">
              <i>●</i> Policy Bound
            </span>
          </div>
          <h2 className="sup-h2">The Warrant</h2>
          <p className="sup-section-lede">
            A grant names token, remaining budget, per-trade cap, window, and permitted output pairs.
          </p>
        </div>
        <div className="sup-section-cta">
          {!isEditing && (
            <button
              type="button"
              className="sup-action-btn primary"
              onClick={() => setIsEditing(true)}
            >
              Draft new warrant
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <div className="sup-draft-bento">
          <div className="draft-bento-head">
            <div>
              <span className="sup-card-tier">WARRANT SPECIFICATION</span>
              <h3 className="draft-bento-title">Draft Commission of Expenditure</h3>
            </div>
            <span className="draft-seal-hint">Requires Captain’s Seal to Enforce</span>
          </div>

          <form onSubmit={handleFormSubmit} className="sup-draft-form">
            {/* Operator Address */}
            <div className="sup-form-group">
              <label className="sup-form-label">OPERATOR'S IDENTITY (PURSER ADDRESS)</label>
              <input
                type="text"
                required
                value={operatorInput}
                onChange={(e) => setOperatorInput(e.target.value)}
                placeholder="0x…"
                className="sup-input font-mono"
              />
              <span className="sup-form-hint">The Captain can replace this delegate address at any hour.</span>
            </div>

            <div className="sup-form-row">
              <div className="sup-form-group">
                <label className="sup-form-label">TOKEN TO SPEND</label>
                <select
                  value={tokenInAddress}
                  onChange={(e) => {
                    const addr = e.target.value;
                    setTokenInAddress(addr);
                    setAllowedDestinations(allowedDestinations.filter((a) => a !== addr));
                  }}
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
                <label className="sup-form-label">TOTAL AUTHORIZED BUDGET</label>
                <div className="sup-input-affix">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    required
                    value={remainingBudget}
                    onChange={(e) => setRemainingBudget(e.target.value)}
                    placeholder="e.g. 1000"
                    className="sup-input"
                  />
                  <span className="affix-tag">{getToken(tokenInAddress)?.symbol}</span>
                </div>
              </div>
            </div>

            <div className="sup-form-row">
              <div className="sup-form-group">
                <label className="sup-form-label">PER-TRADE CAP</label>
                <div className="sup-input-affix">
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max={remainingBudget}
                    required
                    value={perTxCap}
                    onChange={(e) => setPerTxCap(e.target.value)}
                    placeholder="e.g. 250"
                    className="sup-input"
                  />
                  <span className="affix-tag">{getToken(tokenInAddress)?.symbol}</span>
                </div>
                <span className="sup-form-hint">Maximum sum permissible in a single settlement action.</span>
              </div>

              <div className="sup-form-group">
                <label className="sup-form-label">TIME WINDOW</label>
                <div className="sup-radio-switch">
                  <label className={`switch-option ${expiryOption === 'none' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="expiryOption"
                      checked={expiryOption === 'none'}
                      onChange={() => setExpiryOption('none')}
                    />
                    <span>No expiry</span>
                  </label>
                  <label className={`switch-option ${expiryOption === 'date' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="expiryOption"
                      checked={expiryOption === 'date'}
                      onChange={() => setExpiryOption('date')}
                    />
                    <span>Until date</span>
                  </label>
                </div>
                {expiryOption === 'date' && (
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="sup-input mt-2"
                  />
                )}
              </div>
            </div>

            {/* Allowed destinations */}
            <div className="sup-form-group">
              <label className="sup-form-label">
                ALLOWED DESTINATIONS (Which output tokens this input may become)
              </label>
              <div className="sup-dest-grid">
                {SUPPORTED_TOKENS.filter((t) => t.address.toLowerCase() !== tokenInAddress.toLowerCase()).map((t) => {
                  const isChecked = allowedDestinations.includes(t.address);
                  return (
                    <div
                      key={t.address}
                      className={`sup-dest-pill ${isChecked ? 'is-checked' : ''}`}
                      onClick={() => toggleDestination(t.address)}
                    >
                      <span className="pill-checkbox">{isChecked ? '✓' : '+'}</span>
                      <div className="pill-info">
                        <span className="pill-sym">{t.symbol}</span>
                        <span className="pill-sub">{t.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <span className="sup-form-hint">Anything not listed is strictly refused by the strongbox logic.</span>
            </div>

            <div className="draft-actions-bar">
              <button
                type="button"
                className="sup-btn-plain"
                onClick={() => setIsEditing(false)}
              >
                Discard Draft
              </button>
              <button type="submit" className="sup-btn-highlight">
                Affix Seal & Post Warrant <span>→</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="sup-notices-container">
          {warrantList.length === 0 ? (
            <div className="sup-empty-card">
              <div className="sup-empty-inner">
                <span className="empty-ico">📜</span>
                <h3 className="empty-title">No warrant written</h3>
                <p className="empty-text">
                  Without an active commission, the purser has zero allowance to spend or settle any coin aboard.
                </p>
                <button
                  type="button"
                  className="sup-action-btn primary"
                  onClick={() => setIsEditing(true)}
                >
                  Write First Warrant
                </button>
              </div>
            </div>
          ) : (
            warrantList.map((warrant) => {
              const inToken = getToken(warrant.tokenAddress);
              const isSealIntact = warrant.epoch === currentEpoch && warrant.active;

              return (
                <article
                  key={warrant.tokenAddress}
                  className={`sup-warrant-notice-bento ${isSealIntact ? 'status-active' : 'status-revoked'}`}
                >
                  <div className="notice-bento-top">
                    <div>
                      <div className="notice-bento-meta">
                        <span className="meta-tag">MONAD HARBOR POSTED NOTICE</span>
                        <span className={`meta-status-pill ${isSealIntact ? 'pill-green' : 'pill-red'}`}>
                          <i>●</i> {isSealIntact ? 'IN FORCE' : 'SEAL BROKEN'}
                        </span>
                      </div>
                      <h3 className="notice-bento-heading">
                        Authorization for {inToken?.symbol}
                      </h3>
                      <p className="notice-delegate-row">
                        Assigned Purser:{' '}
                        <code className="font-mono">
                          {warrant.delegateAddress.slice(0, 8)}…{warrant.delegateAddress.slice(-6)}
                        </code>
                      </p>
                    </div>

                    <div className="notice-bento-seal">
                      <WaxSeal
                        status={isSealIntact ? 'intact' : 'broken'}
                        size="md"
                        label={isSealIntact ? 'IN FORCE' : 'SEAL BROKEN'}
                      />
                    </div>
                  </div>

                  {/* Numbers Grid */}
                  <div className="notice-metrics-bento">
                    <div className="metric-box">
                      <span className="metric-label">REMAINING BUDGET</span>
                      <div className="metric-val-wrap">
                        <span className="metric-number">{warrant.remaining}</span>
                        <span className="metric-unit">{inToken?.symbol}</span>
                      </div>
                    </div>

                    <div className="metric-box">
                      <span className="metric-label">PER-TRADE CEILING</span>
                      <div className="metric-val-wrap">
                        <span className="metric-number">{warrant.perTxCap}</span>
                        <span className="metric-unit">{inToken?.symbol}</span>
                      </div>
                    </div>

                    <div className="metric-box">
                      <span className="metric-label">TIME WINDOW</span>
                      <div className="metric-val-wrap">
                        <span className="metric-text">
                          {warrant.validUntil
                            ? `Expires ${new Date(warrant.validUntil).toLocaleDateString()}`
                            : 'No Expiry'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Allowed Conversions */}
                  <div className="notice-conversions-row">
                    <span className="row-label">ALLOWED PAIRS:</span>
                    <div className="conversions-pills-list">
                      {warrant.allowedTokensOut.map((outAddr) => {
                        const outToken = getToken(outAddr);
                        return (
                          <span key={outAddr} className="conv-pill">
                            {inToken?.symbol} <span className="arrow-sep">→</span> {outToken?.symbol || 'Unknown'}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Venues */}
                  <div className="notice-venues-row">
                    <span className="row-label">AUTHORIZED VENUES:</span>
                    <div className="venues-pipeline-chips">
                      <div className="venue-chip active-chip">
                        <span className="dot-live">●</span>
                        <span className="v-name">Swap</span>
                        <span className="v-detail">Kuru Flow Router</span>
                      </div>
                      <div className="venue-chip blank-chip">
                        <span className="blank-bar" />
                      </div>
                    </div>
                  </div>

                  {!isSealIntact && (
                    <div className="notice-invalid-bar">
                      <span className="invalid-ico">⚠</span>
                      <span>This warrant was nullified by order of the Captain. The seal is broken; no expenditures will settle.</span>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};
