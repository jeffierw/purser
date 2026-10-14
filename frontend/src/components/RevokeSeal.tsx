import React, { useState } from 'react';
import { WaxSeal } from './WaxSeal';

interface RevokeSealProps {
  onRevokeAll: () => void;
  hasActiveWarrants: boolean;
}

export const RevokeSeal: React.FC<RevokeSealProps> = ({ onRevokeAll, hasActiveWarrants }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [justRevoked, setJustRevoked] = useState(false);

  const handleTriggerRevoke = () => {
    if (!hasActiveWarrants) return;
    setIsConfirming(true);
  };

  const handleConfirmRevoke = () => {
    onRevokeAll();
    setIsConfirming(false);
    setJustRevoked(true);
    setTimeout(() => {
      setJustRevoked(false);
    }, 4000);
  };

  return (
    <section className="sup-section revoke-section">
      <div className="sup-section-band">
        <div className="sup-coordcell">
          <span className="sup-idx">03</span>
        </div>
        <div className="sup-titlecell">
          <div className="sup-title-meta">
            <span className="sup-kicker kicker-danger">REVOKE</span>
            <span className="sup-pill-status pill-danger">
              <i>●</i> Every grant
            </span>
          </div>
          <h2 className="sup-h2">Pull every grant</h2>
          <p className="sup-section-lede">
            One tap stops every allowance. Funds stay in the wallet. The agent cannot co-sign, and the keys do not rotate.
          </p>
        </div>
      </div>

      <div className="sup-revoke-bento">
        <div className="revoke-bento-left">
          <h3 className="bento-revoke-title">Off in one tap</h3>
          <p className="bento-revoke-desc">
            Pulling every grant advances the epoch. Each allowance stops together. A single grant can still be pulled on its own card, and that leaves the rest running.
          </p>
          <div className="revoke-stats-row">
            <div className="revoke-stat">
              <span className="r-label">AFFECTED GRANTS</span>
              <span className="r-val">{hasActiveWarrants ? 'All Active Warrants' : 'None Aboard'}</span>
            </div>
            <div className="revoke-stat">
              <span className="r-label">SETTLEMENT EFFECT</span>
              <span className="r-val">Atomic Freeze</span>
            </div>
          </div>
        </div>

        <div className="revoke-bento-right">
          {isConfirming ? (
            <div className="confirm-seal-panel">
              <span className="confirm-warn-head">⚠ CONFIRM DESTRUCTION OF SEAL</span>
              <p className="confirm-warn-body">
                Breaking the seal immediately revokes every allowance. Old limits do not linger. Are you certain?
              </p>
              <div className="confirm-btn-group">
                <button
                  type="button"
                  className="sup-btn-plain"
                  onClick={() => setIsConfirming(false)}
                >
                  Spare the Seal
                </button>
                <button
                  type="button"
                  className="sup-btn-danger"
                  onClick={handleConfirmRevoke}
                >
                  Break the Seal
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`seal-interact-card ${hasActiveWarrants ? 'is-active' : 'is-spent'}`}
              onClick={handleTriggerRevoke}
              role="button"
              tabIndex={hasActiveWarrants ? 0 : -1}
            >
              <div className="seal-center">
                <WaxSeal
                  status={hasActiveWarrants ? 'intact' : 'broken'}
                  size="md"
                  interactive={hasActiveWarrants}
                />
              </div>
              <span className="seal-interact-caption">
                {hasActiveWarrants ? 'Revoke every grant' : 'All seals broken'}
              </span>
              <span className="seal-interact-sub">
                {hasActiveWarrants ? 'Click to trigger seal break' : 'Contract epoch incremented'}
              </span>
            </div>
          )}
        </div>
      </div>

      {justRevoked && (
        <div className="revoke-quiet-bar">
          <span className="bar-ico">✓</span>
          <span>The seal has been broken. Every warrant aboard is struck null and void.</span>
        </div>
      )}
    </section>
  );
};
