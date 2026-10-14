import React, { useState, useEffect, useCallback } from 'react';
import {
  type ContractState,
  clearBook,
  emptyBook,
  emptyHold,
  formatCargoAmount,
  openBookForSession,
  saveBook,
  SUPPORTED_TOKENS,
} from './mockContractState';
import type { Token, Budget, ShipLogEntry } from './types';
import { monadService, publicClient } from './contracts/contractService';
import { grantKey, routeForGrant } from './contracts/venues';
import { disconnectMera } from './contracts/mera';
import { FundEmbeddedWallet } from './components/FundEmbeddedWallet';
import { PRIVY_APP_ID } from './privy';
import type { Address, Hex } from 'viem';
import { formatUnits } from 'viem';
import { Logo } from './components/Logo';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { OwnerHold } from './components/OwnerHold';
import { OwnerWarrant } from './components/OwnerWarrant';
import { RevokeSeal } from './components/RevokeSeal';
import { OperatorSettle } from './components/OperatorSettle';
import { GrantInterpreter } from './components/GrantInterpreter';
import { OpenStrongbox } from './components/OpenStrongbox';
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
  const [accountAddress, setAccountAddress] = useState<string>('');
  const [activeRole, setActiveRole] = useState<'owner' | 'operator'>('owner');
  const [connectedWalletName, setConnectedWalletName] = useState<string>('Browser Wallet');
  const [boxReady, setBoxReady] = useState(false);
  const [strongboxAddress, setStrongboxAddress] = useState('');
  const [openingBox, setOpeningBox] = useState(false);

  // Contract State — empty until a wallet opens its own book
  const [contractState, setContractState] = useState<ContractState>(() => emptyBook());
  const [walletBalances, setWalletBalances] = useState<Record<string, string>>(() => emptyHold());
  const [viewingEmblemModal, setViewingEmblemModal] = useState<boolean>(false);
  const [txToast, setTxToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setTxToast({ message, type });
    setTimeout(() => {
      setTxToast(null);
    }, 4500);
  };

  useEffect(() => {
    saveBook(contractState);
  }, [contractState]);

  const refreshWalletBalances = useCallback(async (address: string) => {
    const balances = await monadService.readHolderBalances(address as Address, SUPPORTED_TOKENS);
    setWalletBalances(balances);
  }, []);

  // Chain data replaces the book only when the strongbox is actually deployed.
  const syncOnChainState = useCallback(async () => {
    if (!accountAddress) return;
    try {
      await refreshWalletBalances(accountAddress);
      const presence = await monadService.readStrongboxPresence();
      if (presence !== 'ready') return;
      const box = monadService.strongboxAddress();
      const [core, vault] = await Promise.all([
        monadService.readCoreState(),
        monadService.readHolderBalances(box, SUPPORTED_TOKENS),
      ]);
      setContractState((prev) => ({
        ...prev,
        hold: vault,
        ...(core
          ? {
              epoch: Number(core.epoch),
              owner: core.owner,
              operator: core.delegate,
            }
          : {}),
      }));
    } catch {
      // Keep this wallet's book
    }
  }, [accountAddress, refreshWalletBalances]);

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

  const handleLoginSuccess = (
    address: string,
    role: 'owner' | 'operator',
    walletName: string,
    deployed = true
  ) => {
    setAccountAddress(address);
    setActiveRole(role);
    setConnectedWalletName(walletName);
    setBoxReady(deployed);
    setStrongboxAddress(deployed ? monadService.strongboxAddress() : '');
    setContractState(openBookForSession(address, role));
    setWalletBalances(emptyHold());
    void refreshWalletBalances(address);
    navigateTo('app');
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    if (!deployed) {
      showToast(`${short} has no strongbox yet. Open one on Monad Testnet. You pay the gas.`, 'info');
      return;
    }
    showToast(`Connected ${walletName} (${short})`, 'success');
  };

  const handleLogout = () => {
    disconnectMera();
    monadService.useStrongbox(null);
    setAccountAddress('');
    setBoxReady(false);
    setStrongboxAddress('');
    navigateTo('landing');
    showToast('Disconnected from strongbox session', 'info');
  };

  const handleOpenStrongbox = async () => {
    setOpeningBox(true);
    showToast('Opening your strongbox on Monad Testnet…', 'info');
    try {
      const box = await monadService.openStrongbox(accountAddress as Address);
      setStrongboxAddress(box);
      setBoxReady(true);
      setContractState((prev) => ({
        ...prev,
        owner: accountAddress,
        operator: accountAddress,
      }));
      showToast('Strongbox opened. You are the owner and the agent.', 'success');
      void syncOnChainState();
    } catch (error) {
      showToast(chainFailureMessage(error, 'The strongbox was not opened.'), 'error');
    } finally {
      setOpeningBox(false);
    }
  };

  const chainFailureMessage = (error: unknown, fallback: string): string => {
    const message = error instanceof Error ? error.message : fallback;
    if (/does not have any code|returned no data/i.test(message)) {
      return 'This strongbox could not be read on Monad Testnet. Try again in a moment.';
    }
    if (/execution reverted|user rejected|user denied/i.test(message)) {
      return 'The strongbox refused that transaction, or the wallet window closed. Nothing else was changed.';
    }
    return message.length > 180 ? fallback : message;
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

    let txHash: string;
    try {
      const hash = token.isNative
        ? await monadService.depositNative(accountAddress as Address, amount)
        : await monadService.depositToken(
            accountAddress as Address,
            token.address as Address,
            amount,
            token.decimals
          );
      if (!hash) {
        showToast('The strongbox did not accept that deposit.', 'error');
        return;
      }
      txHash = `${hash.slice(0, 10)}…`;
    } catch (e) {
      showToast(chainFailureMessage(e, 'The deposit was not accepted.'), 'error');
      return;
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
    void refreshWalletBalances(accountAddress);

    showToast(`Deposited ${amount} ${token.symbol} aboard`, 'success');
  };

  const handleWithdraw = async (token: Token, amount: string) => {
    showToast(`Withdrawing ${amount} ${token.symbol} ashore…`, 'info');

    let txHash: string;
    try {
      const hash = await monadService.withdraw(
        accountAddress as Address,
        token.address as Address,
        amount,
        accountAddress as Address,
        token.decimals
      );
      if (!hash) {
        showToast('The strongbox did not accept that withdrawal.', 'error');
        return;
      }
      txHash = `${hash.slice(0, 10)}…`;
    } catch (e) {
      showToast(chainFailureMessage(e, 'The withdrawal was not accepted.'), 'error');
      return;
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

    void refreshWalletBalances(accountAddress);
    showToast(`Withdrew ${amount} ${token.symbol} directly to owner address`, 'success');
  };

  const handleSaveWarrant = async (warrant: Budget) => {
    showToast(`Setting typed warrant on-chain for ${warrant.remaining} allowance…`, 'info');
    let txHash = makeTxHash();

    try {
      const inToken = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === warrant.tokenAddress.toLowerCase());
      const tokenIn = warrant.tokenAddress as Address;
      const hash = await monadService.setBudget(
        accountAddress as Address,
        warrant.actionId as Hex,
        tokenIn,
        warrant.remaining,
        warrant.perTxCap,
        warrant.validUntil,
        inToken?.decimals || 18
      );
      if (!hash) {
        showToast('The strongbox did not post that grant.', 'error');
        return;
      }
      txHash = `${hash.slice(0, 10)}…`;

      for (const token of SUPPORTED_TOKENS) {
        if (token.address.toLowerCase() === tokenIn.toLowerCase()) continue;
        const shouldAllow = warrant.allowedTokensOut.some(
          (outAddr) => outAddr.toLowerCase() === token.address.toLowerCase()
        );
        const allowedNow = await monadService.readPairAllowed(
          warrant.actionId as Hex,
          tokenIn,
          token.address as Address,
        );
        if (allowedNow === shouldAllow) continue;
        await monadService.setPair(
          accountAddress as Address,
          warrant.actionId as Hex,
          tokenIn,
          token.address as Address,
          shouldAllow,
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'The warrant was not posted.';
      showToast(message, 'error');
      return;
    }

    const inToken = SUPPORTED_TOKENS.find((t) => t.address.toLowerCase() === warrant.tokenAddress.toLowerCase());
    const newLog: ShipLogEntry = {
      id: Date.now().toString(),
      timestamp: getFormatTime(),
      primaryText: `Grant authorized: ${warrant.protocol} may spend ${warrant.remaining} ${inToken?.symbol || ''} (Cap: ${warrant.perTxCap}).`,
      hash: txHash,
      type: 'grant',
    };

    setContractState((prev) => ({
      ...prev,
      warrants: {
        ...prev.warrants,
        [grantKey(warrant.actionId, warrant.tokenAddress)]: warrant,
      },
      logs: [newLog, ...prev.logs],
    }));

    showToast(`Warrant successfully posted with unbroken seal`, 'success');
  };

  const handleUpdateOperator = async (newOperator: string) => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(newOperator)) {
      showToast('The operator must be a wallet address.', 'error');
      return;
    }
    let hash: Hex | null;
    try {
      hash = await monadService.setDelegate(accountAddress as Address, newOperator as Address);
      if (!hash) {
        showToast('The operator was not changed.', 'error');
        return;
      }
      await publicClient.waitForTransactionReceipt({ hash });
    } catch (e) {
      showToast(chainFailureMessage(e, 'The operator was not changed.'), 'error');
      return;
    }
    setContractState((prev) => ({
      ...prev,
      operator: newOperator,
    }));
    try {
      await monadService.linkDelegate(accountAddress as Address);
    } catch {
      showToast('The agent is set on the box. Their login link did not update. Save the agent once more.', 'error');
      return;
    }
    showToast('Operator updated on the strongbox.', 'success');
  };

  const handleRevokeGrant = async (actionId: string, tokenAddress: string) => {
    const token = SUPPORTED_TOKENS.find((item) => item.address.toLowerCase() === tokenAddress.toLowerCase());
    const key = grantKey(actionId, tokenAddress);
    showToast(`Pulling the ${token?.symbol ?? 'asset'} grant…`, 'info');
    try {
      const hash = await monadService.revokeBudget(
        accountAddress as Address,
        actionId as Hex,
        tokenAddress as Address,
      );
      if (!hash) {
        showToast('The strongbox did not pull that grant.', 'error');
        return;
      }
    } catch (e) {
      showToast(chainFailureMessage(e, 'That grant was not pulled.'), 'error');
      return;
    }

    setContractState((prev) => ({
      ...prev,
      warrants: {
        ...prev.warrants,
        [key]: {
          ...prev.warrants[key],
          active: false,
        },
      },
      logs: [
        {
          id: Date.now().toString(),
          timestamp: getFormatTime(),
          primaryText: `Pulled the ${token?.symbol ?? 'asset'} grant. Other grants stay in force.`,
          hash: 'on-chain',
          type: 'revoke',
        },
        ...prev.logs,
      ],
    }));
    showToast(`The ${token?.symbol ?? 'asset'} grant is pulled. The others still run.`, 'success');
  };

  const handleRevokeAll = async () => {
    showToast(`Triggering emergency seal break on Monad contract…`, 'info');

    let txHash: string;
    try {
      const hash = await monadService.revokeAll(accountAddress as Address);
      if (!hash) {
        showToast('The strongbox did not revoke the warrants.', 'error');
        return;
      }
      txHash = `${hash.slice(0, 10)}…`;
    } catch (e) {
      showToast(chainFailureMessage(e, 'The warrants were not revoked.'), 'error');
      return;
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

  const handleSettle = async (params: {
    warrant: Budget;
    tokenIn: Token;
    tokenOut: Token;
    amountIn: string;
    minAmountOut: string;
  }): Promise<{ success: boolean; ruleError?: string }> => {
    const key = grantKey(params.warrant.actionId, params.tokenIn.address);
    const warrant = contractState.warrants[key];
    if (!warrant || warrant.epoch !== contractState.epoch || !warrant.active) {
      return { success: false, ruleError: 'Warrant is void or revoked.' };
    }

    let route: Hex;
    try {
      route = routeForGrant(
        warrant.actionId,
        params.tokenIn.address,
        params.tokenOut.address,
        warrant.fee,
        warrant.tickSpacing,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'This pair is not on the pinned venue.';
      return { success: false, ruleError: message };
    }

    showToast(`Sending ${params.amountIn} ${params.tokenIn.symbol} through ${warrant.protocol}…`, 'info');
    try {
      const hash = await monadService.execute(
        accountAddress as Address,
        warrant.actionId as Hex,
        params.tokenIn.address as Address,
        params.tokenOut.address as Address,
        params.amountIn,
        params.minAmountOut,
        route,
        params.tokenIn.decimals,
        params.tokenOut.decimals,
      );
      if (!hash) return { success: false, ruleError: 'The strongbox did not accept the swap.' };
      await publicClient.waitForTransactionReceipt({ hash });
      const [vault, budget] = await Promise.all([
        monadService.readHolderBalances(monadService.strongboxAddress(), SUPPORTED_TOKENS),
        monadService.readBudget(warrant.actionId as Hex, params.tokenIn.address as Address),
      ]);
      const remaining = budget ? formatUnits(budget.remaining, params.tokenIn.decimals) : warrant.remaining;
      const newLog: ShipLogEntry = {
        id: Date.now().toString(),
        timestamp: getFormatTime(),
        primaryText: `${params.amountIn} ${params.tokenIn.symbol} settled on ${warrant.protocol}. Output stayed aboard.`,
        hash: `${hash.slice(0, 10)}…`,
        type: 'spend',
      };
      setContractState((prev) => ({
        ...prev,
        hold: vault,
        warrants: {
          ...prev.warrants,
          [key]: {
            ...warrant,
            remaining,
            active: budget ? budget.active : warrant.active,
          },
        },
        logs: [newLog, ...prev.logs],
      }));
      showToast(`${params.tokenIn.symbol} settled on ${warrant.protocol}. Output is in the strongbox.`, 'success');
      return { success: true };
    } catch (error) {
      return { success: false, ruleError: chainFailureMessage(error, 'The swap was not accepted.') };
    }
  };

  const canSettle =
    boxReady &&
    !!contractState.operator &&
    contractState.operator.toLowerCase() === accountAddress.toLowerCase();

  const handleResetDawn = () => {
    clearBook(contractState.owner);
    const owner = activeRole === 'owner' ? accountAddress : contractState.owner;
    const operator = activeRole === 'operator' ? accountAddress : '';
    setContractState(emptyBook(owner, operator));
    showToast('This wallet’s book is clear.', 'info');
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
      {(currentRoute === 'login' || (currentRoute === 'app' && !accountAddress)) && (
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          onClose={() => navigateTo('landing')}
        />
      )}

      {/* 3. Authenticated App Dashboard (/app) */}
      {currentRoute === 'app' && accountAddress && (
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
                    disabled={activeRole !== 'owner'}
                  >
                    <span>Wallet</span>
                  </button>
                  <button
                    type="button"
                    className={`sup-nav-tab ${activeRole === 'operator' ? 'is-active' : ''}`}
                    disabled={activeRole !== 'operator'}
                  >
                    <span>Agent</span>
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

                  {PRIVY_APP_ID && connectedWalletName.startsWith('Privy') ? (
                    <FundEmbeddedWallet
                      address={accountAddress}
                      onError={(message) => showToast(message, 'error')}
                    />
                  ) : null}
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
                <strong className="meta-k">STRONGBOX:</strong>{' '}
                {strongboxAddress
                  ? `${strongboxAddress.slice(0, 10)}…${strongboxAddress.slice(-8)}`
                  : 'not opened'}
              </span>
              <span className="meta-div">/</span>
              <span className="meta-item">
                <strong className="meta-k">WALLET:</strong> {accountAddress.slice(0, 6)}…{accountAddress.slice(-4)}
              </span>
              <span className="meta-div">/</span>
              <span className="meta-item">
                <strong className="meta-k">OPERATOR:</strong>{' '}
                {contractState.operator
                  ? `${contractState.operator.slice(0, 6)}…${contractState.operator.slice(-4)}`
                  : 'none yet'}
              </span>
              <span className="meta-div">/</span>
              <span className="meta-item">
                <strong className="meta-k">EPOCH:</strong> #{contractState.epoch}
              </span>
              <span className="meta-div">/</span>
              <span className="meta-item">
                <strong className="meta-k">VENUES:</strong> KURU ORDER BOOK · UNISWAP V4
              </span>
            </div>
          </div>

          {/* Main Dashboard Surface */}
          <main className="sup-main-container">
            {!boxReady ? (
              <OpenStrongbox pending={openingBox} onOpen={handleOpenStrongbox} />
            ) : activeRole === 'owner' ? (
              <div className="sup-deck-view">
                {/* 01: The Hold */}
                <OwnerHold
                  hold={contractState.hold}
                  walletBalances={walletBalances}
                  ownerAddress={accountAddress}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                />

                <div className="sup-section-divider" />

                {/* 02: Typed Allowances */}
                <OwnerWarrant
                  warrants={contractState.warrants}
                  currentEpoch={contractState.epoch}
                  operatorAddress={contractState.operator}
                  mode="owner"
                  onUpdateOperator={handleUpdateOperator}
                  onSaveWarrant={handleSaveWarrant}
                  onRevokeGrant={handleRevokeGrant}
                />

                <div className="sup-section-divider" />

                {/* 03: Emergency Revoke All */}
                <RevokeSeal
                  onRevokeAll={handleRevokeAll}
                  hasActiveWarrants={hasActiveWarrants}
                />

                {canSettle ? (
                  <>
                    <div className="sup-section-divider" />
                    <GrantInterpreter
                      warrants={contractState.warrants}
                      currentEpoch={contractState.epoch}
                      onSettle={handleSettle}
                    />
                    <div className="sup-section-divider" />
                    <OperatorSettle
                      warrants={contractState.warrants}
                      currentEpoch={contractState.epoch}
                      onSettle={handleSettle}
                    />
                  </>
                ) : null}

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
                      const walletAmount = walletBalances[token.address] || '0';
                      return (
                        <div key={token.address} className="banner-chip">
                          <span className="chip-token">{token.symbol}:</span>
                          <span className="chip-amount font-mono">{formatCargoAmount(amount)} aboard</span>
                          <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-[#94A3B8]">
                            wallet {formatCargoAmount(walletAmount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="hold-banner-note">
                    This agent swaps only inside a posted grant. Output returns to the strongbox. Withdrawal stays with the owner.
                  </p>
                </div>

                <OwnerWarrant
                  warrants={contractState.warrants}
                  currentEpoch={contractState.epoch}
                  operatorAddress={contractState.operator}
                  mode="agent"
                  onUpdateOperator={handleUpdateOperator}
                  onSaveWarrant={handleSaveWarrant}
                />

                <div className="sup-section-divider" />

                <GrantInterpreter
                  warrants={contractState.warrants}
                  currentEpoch={contractState.epoch}
                  onSettle={handleSettle}
                />

                <div className="sup-section-divider" />

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
                  ↺ Clear this book
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
