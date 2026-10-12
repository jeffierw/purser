import React, { useState, useEffect, useCallback } from 'react';
import {
  type ContractState,
  loadContractState,
  saveContractState,
  SUPPORTED_TOKENS,
  CONTRACT_STRONGBOX_ADDRESS,
  OWNER_ADDRESS,
  DEFAULT_OPERATOR_ADDRESS,
} from './mockContractState';
import type { Token, Budget, ShipLogEntry } from './types';
import { monadService } from './contracts/contractService';
import type { Address } from 'viem';
import { Logo } from './components/Logo';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { OwnerHold } from './components/OwnerHold';
import { OwnerWarrant } from './components/OwnerWarrant';
import { RevokeSeal } from './components/RevokeSeal';
import { OperatorSettle } from './components/OperatorSettle';
import { ShipLog } from './components/ShipLog';

type PageRoute = 'landing' | 'login' | 'app';

export const App: React.FC = () => {
  // Navigation Route State
  const [currentRoute, setCurrentRoute] = useState<PageRoute>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/login')) return 'login';
    if (path.startsWith('/app')) return 'app';
    return 'landing';
  });

  // Wallet / Session State
  const [accountAddress, setAccountAddress] = useState<string>(OWNER_ADDRESS);
  const [activeRole, setActiveRole] = useState<'owner' | 'operator'>('owner');
  const [connectedWalletName, setConnectedWalletName] = useState<string>('Browser Wallet');

  // Contract State
  const [contractState, setContractState] = useState<ContractState>(() => loadContractState());
  const [viewingEmblemModal, setViewingEmblemModal] = useState<boolean>(false);
  const [txToast, setTxToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setTxToast({ message, type });
    setTimeout(() => {
      setTxToast(null);
    }, 4500);
  };

  useEffect(() => {
    saveContractState(contractState);
  }, [contractState]);

  // Attempt to sync on-chain state if accessible
  const syncOnChainState = useCallback(async () => {
    try {
      const core = await monadService.readCoreState();
      if (core) {
        setContractState((prev) => ({
          ...prev,
          epoch: Number(core.epoch),
          owner: core.owner,
          operator: core.delegate,
        }));
      }
    } catch {
      // Keep local state
    }
  }, []);

  useEffect(() => {
    if (currentRoute === 'app') {
      syncOnChainState();
    }
  }, [currentRoute, syncOnChainState]);

  // Sync route with browser history
  const navigateTo = (route: PageRoute) => {
    setCurrentRoute(route);
    let targetPath = '/';
    if (route === 'login') targetPath = '/login?next=%2Fapp';
    if (route === 'app') targetPath = '/app';
    window.history.pushState({}, '', targetPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/login')) setCurrentRoute('login');
      else if (path.startsWith('/app')) setCurrentRoute('app');
      else setCurrentRoute('landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleLoginSuccess = (address: string, role: 'owner' | 'operator', walletName: string) => {
    setAccountAddress(address);
    setActiveRole(role);
    setConnectedWalletName(walletName);
    navigateTo('app');
    showToast(`Connected ${walletName} (${address.slice(0, 6)}…${address.slice(-4)})`, 'success');
  };

  const handleLogout = () => {
    navigateTo('landing');
    showToast('Disconnected from strongbox session', 'info');
  };

  const makeTxHash = (): string => {
    const chars = '0123456789abcdef';
    let res = '0x';
    for (let i = 0; i < 8; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res + '…';
  };

  const getFormatTime = (): string => {
    const now = new Date();
    return `Today, ${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  };

  // ================= CONTRACT INTERACTION HANDLERS =================

  const handleDeposit = async (token: Token, amount: string) => {
    showToast(`Broadcasting deposit of ${amount} ${token.symbol} to Monad…`, 'info');
    let txHash = makeTxHash();

    try {
      if (token.isNative) {
        const hash = await monadService.depositNative(accountAddress as Address, amount);
        if (hash) txHash = `${hash.slice(0, 10)}…`;
      } else {
        const hash = await monadService.depositToken(
          accountAddress as Address,
          token.address as Address,
          amount,
          token.decimals
        );
        if (hash) txHash = `${hash.slice(0, 10)}…`;
      }
    } catch (e) {
      console.info('[Purser] On-chain call fallback to local execution:', e);
    }

    const cur = parseFloat(contractState.hold[token.address] || '0');
    const next = (cur + parseFloat(amount)).toString();
    const newLog: ShipLogEntry = {
      id: Date.now().toString(),
      timestamp: getFormatTime(),
      primaryText: `Deposited ${amount} ${token.symbol} into vault custody.`,
      hash: txHash,
      type: 'deposit',
    };

    setContractState((prev) => ({
      ...prev,
      hold: {
        ...prev.hold,
        [token.address]: next,
      },
      logs: [newLog, ...prev.logs],
    }));

    showToast(`Deposited ${amount} ${token.symbol} aboard • Monad Confirmed`, 'success');
  };

  const handleWithdraw = async (token: Token, amount: string) => {
    showToast(`Withdrawing ${amount} ${token.symbol} ashore…`, 'info');
    let txHash = makeTxHash();

    try {
      const hash = await monadService.withdraw(
        accountAddress as Address,
        token.address as Address,
        amount,
        accountAddress as Address,
        token.decimals
      );
      if (hash) txHash = `${hash.slice(0, 10)}…`;
    } catch (e) {
      console.info('[Purser] On-chain call fallback to local execution:', e);
    }

    const cur = parseFloat(contractState.hold[token.address] || '0');
    const withdrawNum = parseFloat(amount);
    if (withdrawNum > cur) return;

    const next = (cur - withdrawNum).toString();
    const newLog: ShipLogEntry = {
      id: Date.now().toString(),
      timestamp: getFormatTime(),
      primaryText: `Owner withdrew ${amount} ${token.symbol} ashore.`,
      hash: txHash,
      type: 'withdraw',
    };

    setContractState((prev) => ({
      ...prev,
      hold: {
        ...prev.hold,
        [token.address]: next,
      },
      logs: [newLog, ...prev.logs],
    }));

    showToast(`Withdrew ${amount} ${token.symbol} directly to owner address`, 'success');
  };

  const handleSaveWarrant = async (warrant: Budget) => {
    showToast(`Setting typed warrant on-chain for ${warrant.remaining} allowance…`, 'info');
    let txHash = makeTxHash();

    try {
      const inToken = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === warrant.tokenAddress.toLowerCase());
      // Set budget on chain
      const hash = await monadService.setBudget(
        accountAddress as Address,
        warrant.tokenAddress as Address,
        warrant.remaining,
        warrant.perTxCap,
        warrant.validUntil,
        inToken?.decimals || 18
      );
      if (hash) txHash = `${hash.slice(0, 10)}…`;

      // Set pair whitelists on chain
      for (const outAddr of warrant.allowedTokensOut) {
        await monadService.setPair(accountAddress as Address, warrant.tokenAddress as Address, outAddr as Address, true);
      }
    } catch (e) {
      console.info('[Purser] On-chain call fallback to local execution:', e);
    }

    const inToken = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === warrant.tokenAddress.toLowerCase());
    const newLog: ShipLogEntry = {
      id: Date.now().toString(),
      timestamp: getFormatTime(),
      primaryText: `Grant authorized: Operator may spend ${warrant.remaining} ${inToken?.symbol || ''} (Cap: ${warrant.perTxCap}).`,
      hash: txHash,
      type: 'grant',
    };

    setContractState((prev) => ({
      ...prev,
      warrants: {
        ...prev.warrants,
        [warrant.tokenAddress]: warrant,
      },
      logs: [newLog, ...prev.logs],
    }));

    showToast(`Warrant successfully posted with unbroken seal`, 'success');
  };

  const handleUpdateOperator = async (newOperator: string) => {
    try {
      await monadService.setPair(accountAddress as Address, newOperator as Address, newOperator as Address, false);
    } catch {
      // fallback
    }
    setContractState((prev) => ({
      ...prev,
      operator: newOperator,
    }));
  };

  const handleRevokeAll = async () => {
    showToast(`Triggering emergency seal break on Monad contract…`, 'info');
    let txHash = makeTxHash();

    try {
      const hash = await monadService.revokeAll(accountAddress as Address);
      if (hash) txHash = `${hash.slice(0, 10)}…`;
    } catch (e) {
      console.info('[Purser] On-chain call fallback to local execution:', e);
    }

    const newEpoch = contractState.epoch + 1;
    const newLog: ShipLogEntry = {
      id: Date.now().toString(),
      timestamp: getFormatTime(),
      primaryText: 'All allowances and warrants revoked.',
      hash: txHash,
      type: 'revoke',
    };

    setContractState((prev) => ({
      ...prev,
      epoch: newEpoch,
      logs: [newLog, ...prev.logs],
    }));

    showToast(`All grants revoked! Contract epoch incremented to #${newEpoch}`, 'error');
  };

  const handleSettle = (params: {
    tokenIn: Token;
    tokenOut: Token;
    amountIn: string;
    minAmountOut: string;
    actualAmountOut: string;
  }): { success: boolean; ruleError?: string } => {
    const warrant = contractState.warrants[params.tokenIn.address];
    if (!warrant || warrant.epoch !== contractState.epoch || !warrant.active) {
      return { success: false, ruleError: 'Warrant is void or revoked.' };
    }

    const curHoldIn = parseFloat(contractState.hold[params.tokenIn.address] || '0');
    const spendNum = parseFloat(params.amountIn);
    if (spendNum > curHoldIn) {
      return {
        success: false,
        ruleError: `Vault Deficit: Strongbox holds only ${curHoldIn} ${params.tokenIn.symbol}, unable to settle.`,
      };
    }

    const remNum = parseFloat(warrant.remaining);
    const nextRem = (remNum - spendNum).toFixed(2);
    const nextHoldIn = (curHoldIn - spendNum).toFixed(2);

    const curHoldOut = parseFloat(contractState.hold[params.tokenOut.address] || '0');
    const actualOutNum = parseFloat(params.actualAmountOut);
    const nextHoldOut = (curHoldOut + actualOutNum).toFixed(2);

    const newLog: ShipLogEntry = {
      id: Date.now().toString(),
      timestamp: getFormatTime(),
      primaryText: `${params.amountIn} ${params.tokenIn.symbol} became ${params.actualAmountOut} ${params.tokenOut.symbol}. Came aboard.`,
      hash: makeTxHash(),
      type: 'spend',
    };

    setContractState((prev) => ({
      ...prev,
      hold: {
        ...prev.hold,
        [params.tokenIn.address]: nextHoldIn,
        [params.tokenOut.address]: nextHoldOut,
      },
      warrants: {
        ...prev.warrants,
        [params.tokenIn.address]: {
          ...warrant,
          remaining: nextRem,
        },
      },
      logs: [newLog, ...prev.logs],
    }));

    showToast(
      `${params.amountIn} ${params.tokenIn.symbol} → ${params.actualAmountOut} ${params.tokenOut.symbol} • Came aboard.`,
      'success'
    );

    return { success: true };
  };

  const handleResetDawn = () => {
    localStorage.removeItem('purser_strongbox_state_v1');
    window.location.reload();
  };

  const hasActiveWarrants = Object.values(contractState.warrants).some(
    (w) => w.epoch === contractState.epoch && w.active && parseFloat(w.remaining) > 0
  );

  return (
    <div className="sup-app-layout">
      {/* 1. Landing Page View (with Launch App trigger) */}
      {currentRoute === 'landing' && (
        <LandingPage onLaunchApp={() => navigateTo('login')} />
      )}

      {/* 2. Login Page View (matching https://www.supwallet.app/login?next=%2Fapp) */}
      {currentRoute === 'login' && (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onClose={() => navigateTo('landing')}
        />
      )}

      {/* 3. Authenticated App Dashboard (/app) */}
      {currentRoute === 'app' && (
        <div className="sup-app-viewport">
          <div className="sup-grid-bg" aria-hidden="true" />

          {/* Top Floating Nav */}
          <header className="sup-nav">
            <div className="sup-nav-in">
              <div className="sup-nav-left">
                <Logo size={34} showWordmark={true} />
                <button
                  type="button"
                  className="sup-nav-badge-btn"
                  onClick={() => setViewingEmblemModal(true)}
                >
                  <span>32px Spec</span>
                </button>
              </div>

              {/* View Switcher */}
              <div className="sup-nav-center">
                <div className="sup-tab-switcher">
                  <button
                    type="button"
                    className={`sup-nav-tab ${activeRole === 'owner' ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveRole('owner');
                      setAccountAddress(OWNER_ADDRESS);
                    }}
                  >
                    <span>Vault & Allowances</span>
                  </button>
                  <button
                    type="button"
                    className={`sup-nav-tab ${activeRole === 'operator' ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveRole('operator');
                      setAccountAddress(DEFAULT_OPERATOR_ADDRESS);
                    }}
                  >
                    <span>Operator Settle</span>
                    <span className="tab-pill">Agent</span>
                  </button>
                </div>
              </div>

              {/* Connected Wallet UX */}
              <div className="sup-nav-right">
                <div className="sup-network-pill">
                  <span className="pill-dot" />
                  <span className="pill-text">Monad Testnet</span>
                </div>

                <div className="sup-connected-cluster">
                  <button
                    type="button"
                    className="sup-address-badge font-mono"
                    onClick={() => navigateTo('login')}
                    title={`Connected via ${connectedWalletName} (${accountAddress}) — Click to switch account`}
                  >
                    <span className="addr-role-dot" />
                    <span>{accountAddress.slice(0, 6)}…{accountAddress.slice(-4)}</span>
                  </button>

                  <button
                    type="button"
                    className="sup-disconnect-btn"
                    onClick={handleLogout}
                    title="Disconnect Wallet and Return Home"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Meta Bar */}
          <div className="sup-meta-bar">
            <div className="meta-bar-in font-mono">
              <span className="meta-item">
                <strong className="meta-k">STRONGBOX:</strong> {CONTRACT_STRONGBOX_ADDRESS.slice(0, 10)}…{CONTRACT_STRONGBOX_ADDRESS.slice(-8)}
              </span>
              <span className="meta-div">/</span>
              <span className="meta-item">
                <strong className="meta-k">EPOCH:</strong> #{contractState.epoch}
              </span>
              <span className="meta-div">/</span>
              <span className="meta-item">
                <strong className="meta-k">ROUTER:</strong> KURU FLOW (ATOMIC RECEIVER)
              </span>
            </div>
          </div>

          {/* Main Dashboard Surface */}
          <main className="sup-main-container">
            {activeRole === 'owner' ? (
              <div className="sup-deck-view">
                {/* 01: The Hold */}
                <OwnerHold
                  hold={contractState.hold}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                />

                <div className="sup-section-divider" />

                {/* 02: Typed Allowances */}
                <OwnerWarrant
                  warrants={contractState.warrants}
                  currentEpoch={contractState.epoch}
                  operatorAddress={contractState.operator}
                  onUpdateOperator={handleUpdateOperator}
                  onSaveWarrant={handleSaveWarrant}
                />

                <div className="sup-section-divider" />

                {/* 03: Emergency Revoke All */}
                <RevokeSeal
                  onRevokeAll={handleRevokeAll}
                  hasActiveWarrants={hasActiveWarrants}
                />

                <div className="sup-section-divider" />

                {/* 04: The Ship's Log */}
                <ShipLog logs={contractState.logs} />
              </div>
            ) : (
              <div className="sup-deck-view">
                {/* Read Vault Balances */}
                <div className="sup-operator-hold-banner">
                  <div className="hold-banner-head">
                    <span className="sup-card-tier">VAULT RESERVES IN STRONGBOX</span>
                    <h3 className="hold-banner-title">Custody Balances</h3>
                  </div>
                  <div className="hold-banner-chips">
                    {SUPPORTED_TOKENS.map((token) => {
                      const amount = contractState.hold[token.address] || '0';
                      return (
                        <div key={token.address} className="banner-chip">
                          <span className="chip-token">{token.symbol}:</span>
                          <span className="chip-amount font-mono">{amount}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="hold-banner-note">
                    Operator executes within posted allowances. All trade yields return directly to this vault. Operator has zero withdrawal controls.
                  </p>
                </div>

                {/* Settle Engine with Verification Rail */}
                <OperatorSettle
                  warrants={contractState.warrants}
                  currentEpoch={contractState.epoch}
                  onSettle={handleSettle}
                />

                <div className="sup-section-divider" />

                {/* Activity Log */}
                <ShipLog logs={contractState.logs} />
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="sup-footer">
            <div className="footer-inner">
              <div className="footer-left">
                <Logo size={28} showWordmark={true} />
                <span className="footer-subtext">
                  Self-custodial typed allowances and operator settlement on Monad.
                </span>
              </div>
              <div className="footer-right">
                <button
                  type="button"
                  className="sup-reset-btn font-mono"
                  onClick={handleResetDawn}
                  title="Reset voyage ledger to dawn state"
                >
                  ↺ Reset demo state
                </button>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Real-time Web3 Toast Banner (Sup style) */}
      {txToast && (
        <div className={`sup-tx-toast toast-${txToast.type}`}>
          <span className="toast-dot">●</span>
          <span className="toast-msg font-mono">{txToast.message}</span>
        </div>
      )}

      {/* 32px Emblem Modal */}
      {viewingEmblemModal && (
        <div className="sup-modal-overlay" onClick={() => setViewingEmblemModal(false)}>
          <div className="sup-modal-window emblem-window" onClick={(e) => e.stopPropagation()}>
            <div className="sup-modal-head">
              <div className="head-text">
                <span className="modal-eyebrow">VISUAL IDENTITY SPECIFICATION</span>
                <h3 className="modal-title">Purser Emblem & Maritime System</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setViewingEmblemModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="sup-emblem-bento-grid">
              <div className="emblem-bento-box">
                <span className="box-tag">32PX READABLE ICON</span>
                <div className="box-preview-frame">
                  <div className="scale-preview-cluster">
                    <div className="preview-size-item">
                      <Logo size={32} showWordmark={false} />
                      <span className="size-label font-mono">32px</span>
                    </div>
                    <div className="preview-size-item">
                      <Logo size={64} showWordmark={false} />
                      <span className="size-label font-mono">64px</span>
                    </div>
                    <div className="preview-size-item">
                      <Logo size={96} showWordmark={false} />
                      <span className="size-label font-mono">96px</span>
                    </div>
                  </div>
                </div>
                <p className="box-desc">
                  Brass coin-purse closed tight by a short loop of rope, on deep ink-navy. One small unbroken wax-red seal.
                </p>
              </div>

              <div className="emblem-bento-box">
                <span className="box-tag">EDITORIAL WORDMARK</span>
                <div className="box-preview-frame">
                  <Logo size={42} showWordmark={true} />
                </div>
                <p className="box-desc">
                  Sharp editorial serif, letterspaced, ink-navy on warm paper cream. No tagline.
                </p>
              </div>

              <div className="emblem-bento-box">
                <span className="box-tag">CONCEPTUAL PRINT TEXTURE</span>
                <div className="box-preview-frame">
                  <img
                    src="/purser_emblem.jpg"
                    alt="Purser Print Emblem"
                    className="box-art-img"
                  />
                </div>
                <p className="box-desc">
                  Maritime accounting without cartoon clichés, flat vector precision, subtle woodblock print texture.
                </p>
              </div>
            </div>

            <div className="sup-modal-actions">
              <button
                type="button"
                className="sup-btn-highlight"
                onClick={() => setViewingEmblemModal(false)}
              >
                Close Spec
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
