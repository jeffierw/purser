import { SUPPORTED_TOKENS } from '../mockContractState';
import type { Budget, Token } from '../types';
import { isKuruMonUsdc, KURU_CLOB_SWAP_ACTION } from './venues';

export interface SettlePlan {
  warrant: Budget;
  tokenIn: Token;
  tokenOut: Token;
  amountIn: string;
}

export type OrderReading = { ok: true; plan: SettlePlan } | { ok: false; reason: string };

function liveGrants(warrants: Record<string, Budget>, epoch: number): Budget[] {
  return Object.values(warrants).filter((warrant) => {
    if (warrant.epoch !== epoch || !warrant.active) return false;
    if (warrant.validUntil && Date.now() > warrant.validUntil) return false;
    if (!warrant.actionId || !warrant.protocol) return false;
    if (parseFloat(warrant.remaining) <= 0) return false;
    return true;
  });
}

function tokenBySymbol(symbol: string): Token | undefined {
  return SUPPORTED_TOKENS.find((token) => token.symbol.toLowerCase() === symbol.toLowerCase());
}

/** Read one plain-language swap and refuse anything a live grant cannot express. */
export function interpretOrder(
  text: string,
  warrants: Record<string, Budget>,
  epoch: number,
): OrderReading {
  const raw = text.trim();
  if (!raw) {
    return { ok: false, reason: 'Write one order. Example: swap 1 MON for USDC on Kuru.' };
  }
  const lower = raw.toLowerCase();
  if (/\b(withdraw|transfer|send|drain|approve)\b|转出|提现|提走/.test(lower)) {
    return { ok: false, reason: 'This agent cannot move cargo out. Withdrawal stays with the owner.' };
  }
  if (/\b(lend|borrow|stake|perp|long|short)\b|借贷|质押|杠杆/.test(lower)) {
    return {
      ok: false,
      reason: 'That action is not on this testnet. The agent can only swap inside a posted grant.',
    };
  }
  if (/\b(every|daily|dca|monday|weekly)\b|每天|每周/.test(lower)) {
    return {
      ok: false,
      reason: 'A repeating order needs a clock this testnet build does not run. Send one swap inside the grant.',
    };
  }

  const match = lower.match(
    /(\d+(?:\.\d+)?)\s*(mon|usdc|wmon)\b[\s\S]{0,40}?\b(?:for|into|to|换成|换)\s*(mon|usdc|wmon)\b/,
  );
  if (!match) {
    return { ok: false, reason: 'Say it as “swap 1 MON for USDC on Kuru”, or name Uniswap v4.' };
  }

  const amount = Number(match[1]);
  const tokenIn = tokenBySymbol(match[2]);
  const tokenOut = tokenBySymbol(match[3]);
  if (!tokenIn || !tokenOut || tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase() || !(amount > 0)) {
    return { ok: false, reason: 'Name two different assets and an amount above zero.' };
  }

  const wantsUni = /uniswap|\bv4\b/.test(lower);
  const wantsKuru = /kuru|order book/.test(lower);
  if (wantsUni && wantsKuru) {
    return { ok: false, reason: 'Name one venue: Kuru or Uniswap v4.' };
  }

  const candidates = liveGrants(warrants, epoch).filter((warrant) => {
    if (warrant.tokenAddress.toLowerCase() !== tokenIn.address.toLowerCase()) return false;
    if (!warrant.allowedTokensOut.some((out) => out.toLowerCase() === tokenOut.address.toLowerCase())) return false;
    if (wantsUni && !warrant.protocol.toLowerCase().includes('uniswap')) return false;
    if (wantsKuru && !warrant.protocol.toLowerCase().includes('kuru')) return false;
    return true;
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      reason: `No live grant lets the agent swap ${tokenIn.symbol} for ${tokenOut.symbol}. The owner posts that grant first.`,
    };
  }
  if (candidates.length > 1) {
    return { ok: false, reason: 'More than one grant matches. Name Kuru or Uniswap v4.' };
  }

  const warrant = candidates[0];
  if (warrant.actionId.toLowerCase() === KURU_CLOB_SWAP_ACTION.toLowerCase() && !isKuruMonUsdc(tokenIn.address, tokenOut.address)) {
    return { ok: false, reason: 'Kuru on Monad Testnet is pinned to the MON/USDC market.' };
  }
  if (warrant.protocol.toLowerCase().includes('uniswap') && (!warrant.fee || !warrant.tickSpacing)) {
    return { ok: false, reason: 'This Uniswap grant has no fee tier.' };
  }
  if (amount > parseFloat(warrant.perTxCap)) {
    return { ok: false, reason: `That amount is over the per-trade cap of ${warrant.perTxCap} ${tokenIn.symbol}.` };
  }
  if (amount > parseFloat(warrant.remaining)) {
    return { ok: false, reason: `That amount is over the remaining grant of ${warrant.remaining} ${tokenIn.symbol}.` };
  }

  return { ok: true, plan: { warrant, tokenIn, tokenOut, amountIn: match[1] } };
}
