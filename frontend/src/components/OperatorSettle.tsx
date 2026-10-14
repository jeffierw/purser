import React, { useState } from 'react';
import { SUPPORTED_TOKENS } from '../mockContractState';
import type { Budget, Token } from '../types';
import { grantKey } from '../contracts/venues';
import { CargoSelect } from './CargoSelect';
import { WaxSeal } from './WaxSeal';

interface OperatorSettleProps {
  warrants: Record<string, Budget>;
  currentEpoch: number;
  onSettle: (params: {
    warrant: Budget;
    tokenIn: Token;
    tokenOut: Token;
    amountIn: string;
    minAmountOut: string;
  }) => Promise<{ success: boolean; ruleError?: string }>;
}

export const OperatorSettle: React.FC<OperatorSettleProps> = ({
  warrants,
  currentEpoch,
  onSettle,
}) => {
  const liveWarrants = Object.values(warrants).filter((w) => {
    if (w.epoch !== currentEpoch || !w.active) return false;
    if (w.validUntil && Date.now() > w.validUntil) return false;
    if (!w.actionId || !w.protocol) return false;
    if (parseFloat(w.remaining) <= 0) return false;
    return true;
  });

  const hasLiveWarrant = liveWarrants.length > 0;
  const [selectedKey, setSelectedKey] = useState<string>('');
  const activeWarrant =
    liveWarrants.find((warrant) => grantKey(warrant.actionId, warrant.tokenAddress) === selectedKey) ??
    liveWarrants[0];

  const inToken = activeWarrant
    ? SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === activeWarrant.tokenAddress.toLowerCase())
    : null;

  const [selectedOutAddress, setSelectedOutAddress] = useState<string>('');
  const [spendAmount, setSpendAmount] = useState<string>('');
  const [minReceiveAmount, setMinReceiveAmount] = useState<string>('');
  const [pending, setPending] = useState(false);
  const [ruleRefusalReason, setRuleRefusalReason] = useState<string | null>(null);
  const [lastSuccessNotice, setLastSuccessNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (!activeWarrant) return;
    const key = grantKey(activeWarrant.actionId, activeWarrant.tokenAddress);
    if (selectedKey !== key && !liveWarrants.some((warrant) => grantKey(warrant.actionId, warrant.tokenAddress) === selectedKey)) {
      setSelectedKey(key);
    }
    if (activeWarrant.allowedTokensOut.length > 0 && !activeWarrant.allowedTokensOut.some((addr) => addr.toLowerCase() === selectedOutAddress.toLowerCase())) {
      setSelectedOutAddress(activeWarrant.allowedTokensOut[0]);
    }
  }, [activeWarrant, liveWarrants, selectedKey, selectedOutAddress]);

  const outToken = SUPPORTED_TOKENS.find(
    (t) => t.address.toLowerCase() === selectedOutAddress.toLowerCase()
  );

  const spendNum = parseFloat(spendAmount) || 0;
  const capNum = activeWarrant ? parseFloat(activeWarrant.perTxCap) : 0;
  const remNum = activeWarrant ? parseFloat(activeWarrant.remaining) : 0;
  const isUnderCap = spendNum > 0 && spendNum <= capNum;
  const isUnderRem = spendNum > 0 && spendNum <= remNum;
  const isPairAllowed =
    !!activeWarrant &&
    !!outToken &&
    activeWarrant.allowedTokensOut.some((a) => a.toLowerCase() === outToken.address.toLowerCase());

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRuleRefusalReason(null);
    setLastSuccessNotice(null);

    if (!activeWarrant || !inToken || !outToken) {
      setRuleRefusalReason('No active warrant in force aboard.');
      return;
    }

    const amountInNum = parseFloat(spendAmount);
    const minOutNum = parseFloat(minReceiveAmount);

    if (isNaN(amountInNum) || amountInNum <= 0) {
      setRuleRefusalReason('Settlement sum must be greater than zero.');
      return;
    }

    if (isNaN(minOutNum) || minOutNum <= 0) {
      setRuleRefusalReason('Name the minimum amount that must come back. A blank minimum is refused.');
      return;
    }

    if (amountInNum > capNum) {
      setRuleRefusalReason(
        `Warrant Cap Refusal: Amount (${spendAmount} ${inToken.symbol}) exceeds the posted per-trade cap of ${activeWarrant.perTxCap} ${inToken.symbol}.`
      );
      return;
    }

    if (amountInNum > remNum) {
      setRuleRefusalReason(
        `Budget Exhausted Refusal: Amount exceeds remaining authorized budget of ${activeWarrant.remaining} ${inToken.symbol}.`
      );
      return;
    }

    if (!isPairAllowed) {
      setRuleRefusalReason(
        `Unauthorized Pair Refusal: Destination ${outToken.symbol} is not included in the posted warrant destination list.`
      );
      return;
    }

    setPending(true);
    const result = await onSettle({
      warrant: activeWarrant,
      tokenIn: inToken,
      tokenOut: outToken,
      amountIn: spendAmount,
      minAmountOut: minReceiveAmount,
    });
    setPending(false);

    if (result.success) {
      setLastSuccessNotice(`${spendAmount} ${inToken.symbol} settled on ${activeWarrant.protocol}. Output stayed aboard.`);
      setSpendAmount('');
      setMinReceiveAmount('');
    } else if (result.ruleError) {
      setRuleRefusalReason(result.ruleError);
    }
  };

  return (
    <section className="sup-section operator-settle-section">
      <div className="sup-section-band">
        <div className="sup-coordcell">
          <span className="sup-idx">01</span>
        </div>
        <div className="sup-titlecell">
          <div className="sup-title-meta">
            <span className="sup-kicker">AGENT</span>
            <span className="sup-pill-status">
              <i>●</i> Inside the grant
            </span>
          </div>
          <h2 className="sup-h2">Settle</h2>
          <p className="sup-section-lede">
            The agent swaps only what the grant names. Output returns to the strongbox. This key cannot withdraw.
          </p>
        </div>
      </div>

      {!hasLiveWarrant ? (
        <div className="sup-empty-card">
          <div className="sup-empty-inner">
            <span className="empty-ico">🔒</span>
            <h3 className="empty-title">No grant in force</h3>
            <p className="empty-text">
              There is no live allowance for this agent. A swap outside a grant cannot be expressed.
            </p>
          </div>
        </div>
      ) : (
        <div className="sup-operator-layout">
          {/* Sup Wallet Pipeline Rail Component (Step 04 Inspection) */}
          <div className="sup-pipeline-bento">
            <div className="pipeline-bento-head">
              <span className="sup-card-tier">VERIFICATION PIPELINE</span>
              <h3 className="pipeline-title">Pre-Execution Policy Gate</h3>
              <p className="pipeline-sub">
                Every trade is checked against smart contract constraints before execution settles.
              </p>
            </div>

            <div className="sup-stages-rail">
              <div className="stage-step is-passed">
                <span className="stage-num">01</span>
                <span className="stage-name">Identity</span>
                <span className="stage-desc font-mono">Purser Key Bound</span>
              </div>
              <div className="stage-connector" />

              <div className={`stage-step ${spendNum === 0 ? 'is-waiting' : isUnderCap ? 'is-passed' : 'is-failed'}`}>
                <span className="stage-num">02</span>
                <span className="stage-name">Per-Tx Cap</span>
                <span className="stage-desc">
                  {spendNum === 0 ? `Max ${capNum}` : isUnderCap ? 'Within Cap' : 'Exceeds Cap'}
                </span>
              </div>
              <div className="stage-connector" />

              <div className={`stage-step ${spendNum === 0 ? 'is-waiting' : isUnderRem ? 'is-passed' : 'is-failed'}`}>
                <span className="stage-num">03</span>
                <span className="stage-name">Budget Remainder</span>
                <span className="stage-desc">
                  {spendNum === 0 ? `${remNum} Left` : isUnderRem ? 'Authorized' : 'Exhausted'}
                </span>
              </div>
              <div className="stage-connector" />

              <div className={`stage-step ${isPairAllowed ? 'is-passed' : 'is-failed'}`}>
                <span className="stage-num">04</span>
                <span className="stage-name">Venue Whitelist</span>
                <span className="stage-desc">{outToken ? outToken.symbol : 'Checking'}</span>
              </div>
              <div className="stage-connector" />

              <div className="stage-step is-passed">
                <span className="stage-num">05</span>
                <span className="stage-name">Strongbox Return</span>
                <span className="stage-desc">100% In Custody</span>
              </div>
            </div>
          </div>

          <div className="sup-settle-split-grid">
            {/* Left Column: Read Warrant Bento */}
            <div className="sup-read-warrant-card">
              <div className="card-top-tag">
                <span className="sup-card-tier">ACTIVE COMMISSION</span>
                <div className="warrant-mini-seal">
                  <WaxSeal status="intact" size="sm" />
                </div>
              </div>

              <h3 className="read-warrant-heading">
                {activeWarrant.protocol} · {inToken?.symbol}
              </h3>

              <div className="read-warrant-stats">
                <div className="stat-pair">
                  <span className="pair-label">REMAINING ALLOWANCE</span>
                  <span className="pair-val font-mono">
                    {activeWarrant.remaining} {inToken?.symbol}
                  </span>
                </div>
                <div className="stat-pair">
                  <span className="pair-label">PER-TRADE CEILING</span>
                  <span className="pair-val font-mono">
                    {activeWarrant.perTxCap} {inToken?.symbol}
                  </span>
                </div>
                <div className="stat-pair">
                  <span className="pair-label">WINDOW</span>
                  <span className="pair-val">
                    {activeWarrant.validUntil
                      ? `Until ${new Date(activeWarrant.validUntil).toLocaleDateString()}`
                      : 'No Expiry'}
                  </span>
                </div>
              </div>

              <div className="read-pairs-block">
                <span className="block-label">AUTHORIZED DESTINATIONS:</span>
                <div className="dest-chips-row">
                  {activeWarrant.allowedTokensOut.map((outAddr) => {
                    const out = SUPPORTED_TOKENS.find(
                      (t) => t.address.toLowerCase() === outAddr.toLowerCase()
                    );
                    return (
                      <span key={outAddr} className="dest-chip">
                        {inToken?.symbol} → {out?.symbol}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="read-venues-block">
                <span className="block-label">VENUES:</span>
                <div className="venue-line live-venue">
                  <span className="venue-dot">●</span>
                  <span className="venue-name">{activeWarrant.action}</span>
                  <span className="venue-status">{activeWarrant.protocol}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Execution Form */}
            <div className="sup-execute-card">
              <div className="execute-card-header">
                <span className="sup-card-tier">SWAP SETTLEMENT</span>
                <h3 className="execute-card-title">Settle Under Warrant</h3>
              </div>

              <form onSubmit={handleSettleSubmit} className="execute-form">
                <div className="sup-form-group">
                  <label className="sup-form-label">GRANT</label>
                  <CargoSelect
                    ariaLabel="Grant"
                    value={grantKey(activeWarrant.actionId, activeWarrant.tokenAddress)}
                    onChange={(key) => {
                      setSelectedKey(key);
                      setSelectedOutAddress('');
                      setRuleRefusalReason(null);
                    }}
                    options={liveWarrants.map((warrant) => {
                      const token = SUPPORTED_TOKENS.find(
                        (item) => item.address.toLowerCase() === warrant.tokenAddress.toLowerCase(),
                      );
                      return {
                        value: grantKey(warrant.actionId, warrant.tokenAddress),
                        symbol: `${warrant.protocol} · ${token?.symbol ?? 'Asset'}`,
                        name: warrant.action,
                      };
                    })}
                  />
                </div>

                <div className="sup-form-group">
                  <label className="sup-form-label">CONVERSION PAIR</label>
                  <CargoSelect
                    ariaLabel="Conversion pair"
                    value={selectedOutAddress}
                    onChange={setSelectedOutAddress}
                    options={activeWarrant.allowedTokensOut.map((outAddr) => {
                      const out = SUPPORTED_TOKENS.find(
                        (token) => token.address.toLowerCase() === outAddr.toLowerCase()
                      );
                      return {
                        value: outAddr,
                        symbol: `${inToken?.symbol ?? 'Token'} → ${out?.symbol ?? 'Token'}`,
                        name: out?.name ?? 'Unknown cargo',
                      };
                    })}
                  />
                </div>

                <div className="sup-form-group">
                  <label className="sup-form-label">
                    AMOUNT TO SPEND (CAP: {activeWarrant.perTxCap} {inToken?.symbol})
                  </label>
                  <div className="sup-input-affix">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      required
                      placeholder="e.g. 100"
                      value={spendAmount}
                      onChange={(e) => setSpendAmount(e.target.value)}
                      className="sup-input"
                    />
                    <span className="affix-tag">{inToken?.symbol}</span>
                  </div>
                </div>

                <div className="sup-form-group">
                  <label className="sup-form-label">MINIMUM AMOUNT TO RECEIVE (SLIPPAGE BOUND)</label>
                  <div className="sup-input-affix">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="e.g. 50"
                      value={minReceiveAmount}
                      onChange={(e) => setMinReceiveAmount(e.target.value)}
                      className="sup-input"
                    />
                    <span className="affix-tag">{outToken?.symbol}</span>
                  </div>
                  <span className="sup-form-hint">
                    If actual market yield falls below this minimum, trade reverts atomically and zero coin departs.
                  </span>
                </div>

                {/* Rule Refusal Error Display */}
                {ruleRefusalReason && (
                  <div className="sup-refusal-banner">
                    <span className="banner-ico">✕</span>
                    <div className="banner-content">
                      <span className="banner-title">Refused by Warrant Policy</span>
                      <p className="banner-desc">{ruleRefusalReason}</p>
                      <span className="banner-note">Budget remains 100% untouched.</span>
                    </div>
                  </div>
                )}

                {/* Came Aboard Success Banner */}
                {lastSuccessNotice && (
                  <div className="sup-came-aboard-banner">
                    <span className="banner-dot">●</span>
                    <div className="banner-content">
                      <span className="banner-title">{lastSuccessNotice}</span>
                      <span className="banner-sub">Proceeds credited directly to ship’s strongbox custody.</span>
                    </div>
                  </div>
                )}

                <div className="execute-form-actions">
                  <button type="submit" className="sup-btn-highlight full-width" disabled={pending}>
                    {pending ? 'Sending…' : 'Settle Under Warrant'} <span>→</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
