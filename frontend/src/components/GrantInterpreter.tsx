import React, { useState } from 'react';
import type { Budget, Token } from '../types';
import { interpretOrder, type SettlePlan } from '../contracts/order';

interface GrantInterpreterProps {
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

export const GrantInterpreter: React.FC<GrantInterpreterProps> = ({ warrants, currentEpoch, onSettle }) => {
  const [text, setText] = useState('swap 1 MON for USDC on Kuru');
  const [minReceive, setMinReceive] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [plan, setPlan] = useState<SettlePlan | null>(null);
  const [pending, setPending] = useState(false);

  const readOrder = () => {
    const reading = interpretOrder(text, warrants, currentEpoch);
    if (!reading.ok) {
      setPlan(null);
      setReason(reading.reason);
      return;
    }
    setPlan(reading.plan);
    setReason(null);
  };

  const sendPlan = async () => {
    if (!plan) return;
    const min = parseFloat(minReceive);
    if (!(min > 0)) {
      setReason('Name the least that must come back. Zero is refused on chain.');
      return;
    }
    setPending(true);
    setReason(null);
    try {
      const result = await onSettle({
        warrant: plan.warrant,
        tokenIn: plan.tokenIn,
        tokenOut: plan.tokenOut,
        amountIn: plan.amountIn,
        minAmountOut: minReceive,
      });
      if (!result.success) setReason(result.ruleError || 'The strongbox did not accept that order.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section>
      <div className="sup-section-band">
        <div className="sup-coordcell">
          <span className="sup-idx">AI</span>
        </div>
        <div className="sup-titlecell">
          <div className="sup-title-meta">
            <span className="sup-kicker">AGENT</span>
            <span className="sup-pill-status">
              <i>●</i> Grant check
            </span>
          </div>
          <h2 className="sup-h2">Order in words</h2>
          <p className="sup-section-lede">
            Write the swap in one line. This agent checks it against the live grant, then sends only that swap.
            It does not hold a key, and it cannot withdraw.
          </p>
        </div>
      </div>

      <div className="sup-execute-card">
        <div className="execute-card-header">
          <span className="sup-card-tier">PLAIN ORDER</span>
          <h3 className="execute-card-title">Read, then settle</h3>
        </div>
        <div className="execute-form">
          <div className="sup-form-group">
            <label className="sup-form-label" htmlFor="plain-order">
              ORDER
            </label>
            <input
              id="plain-order"
              className="sup-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="swap 1 MON for USDC on Kuru"
            />
          </div>
          <button type="button" className="sup-btn-highlight" onClick={readOrder} disabled={pending}>
            Read this order
          </button>

          {reason ? <p className="sup-section-lede">{reason}</p> : null}

          {plan ? (
            <div className="read-warrant-stats">
              <div className="stat-pair">
                <span className="pair-label">PLAN</span>
                <span className="pair-val font-mono">
                  {plan.amountIn} {plan.tokenIn.symbol} → {plan.tokenOut.symbol} on {plan.warrant.protocol}
                </span>
              </div>
              <div className="stat-pair">
                <span className="pair-label">GRANT LEFT</span>
                <span className="pair-val font-mono">
                  {plan.warrant.remaining} {plan.tokenIn.symbol}, cap {plan.warrant.perTxCap}
                </span>
              </div>
              <p className="sup-section-lede">
                Output must land back in the strongbox. Name the least {plan.tokenOut.symbol} you will accept.
                This testnet book does not invent a price.
              </p>
              <div className="sup-form-group">
                <label className="sup-form-label" htmlFor="plain-min">
                  MINIMUM BACK
                </label>
                <input
                  id="plain-min"
                  className="sup-input"
                  inputMode="decimal"
                  value={minReceive}
                  onChange={(event) => setMinReceive(event.target.value)}
                  placeholder={`Least ${plan.tokenOut.symbol}`}
                />
              </div>
              <button type="button" className="sup-btn-highlight" onClick={sendPlan} disabled={pending}>
                {pending ? 'Sending…' : 'Settle this order'}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};
