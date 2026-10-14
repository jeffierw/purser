import React from 'react';

interface OpenStrongboxProps {
  pending: boolean;
  onOpen: () => void;
}

export const OpenStrongbox: React.FC<OpenStrongboxProps> = ({ pending, onOpen }) => {
  return (
    <div className="sup-deck-view">
      <div className="sup-section-band">
        <div className="sup-coordcell">
          <span className="sup-idx">01</span>
        </div>
        <div className="sup-titlecell">
          <div className="sup-title-meta">
            <span className="sup-kicker">MONAD TESTNET</span>
          </div>
          <h2 className="sup-h2">Open your strongbox</h2>
          <p className="sup-section-lede">
            This address does not have a strongbox yet. Opening one makes you the owner and the agent.
            Kuru’s MON/USDC book and hookless Uniswap v4 are already pinned. You pay the gas, about half a testnet MON.
          </p>
        </div>
      </div>

      <div className="sup-empty-card">
        <div className="sup-empty-inner">
          <h3 className="empty-title">One box per wallet</h3>
          <p className="empty-text">
            The agent can only swap inside a grant you post afterwards. It cannot withdraw, and it cannot choose a
            contract. If this wallet has no MON, claim a drip at the testnet faucet first.
          </p>
          <p className="empty-text">
            <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
              faucet.monad.xyz
            </a>
          </p>
          <button type="button" className="sup-btn-highlight" onClick={onOpen} disabled={pending}>
            {pending ? 'Opening…' : 'Open strongbox'}
          </button>
        </div>
      </div>
    </div>
  );
};
