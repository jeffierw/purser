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
            <span className="sup-kicker kicker-danger">COMMAND SANCTION</span>
            <span className="sup-pill-status pill-danger">
              <i>●</i> Absolute Revocation
            </span>
          </div>
          <h2 className="sup-h2">Revocation of Authority</h2>
          <p className="sup-section-lede">
            Breaks the seal upon the strongbox. Instantly strikes every grant void across the entire ship.
          </p>
        </div>
      </div>

      <div className="sup-revoke-bento">
        <div className="revoke-bento-left">
          <h3 className="bento-revoke-title">One Stroke Nullification</h3>
          <p className="bento-revoke-desc">
            Unlike granular parameter tweaks, breaking the seal resets the active epoch across the entire smart contract. 
            All outstanding limits dissolve instantly. The operator is immobilized until a completely new warrant is drafted aboard.
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
