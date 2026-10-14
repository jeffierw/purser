import { encodeAbiParameters, getAddress, type Hex } from 'viem';
import { KURU_CLOB_SWAP_ACTION, UNISWAP_V4_SWAP_ACTION } from './contractAbi';

export { KURU_CLOB_SWAP_ACTION, UNISWAP_V4_SWAP_ACTION };

/** Official Monad testnet addresses from monad-crypto/protocols, checked with eth_getCode. */
export const NATIVE = '0x0000000000000000000000000000000000000000';
export const MONAD_TESTNET_USDC = getAddress('0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570');
export const MONAD_TESTNET_WMON = getAddress('0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541');
export const KURU_ROUTER = getAddress('0x7EFbE105Ca7415dE98F96622173458ac1c054630');
export const KURU_MON_USDC_MARKET = getAddress('0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9');
export const UNISWAP_V4_POOL_MANAGER = getAddress('0x451D64ab3b650040d2aE1886602b97ed6eDc643d');

export const VENUES = [
  {
    actionId: KURU_CLOB_SWAP_ACTION,
    protocol: 'Kuru',
    action: 'Swap',
    detail: 'Order book',
    hint: 'Pinned to the official MON/USDC market. The agent cannot choose another contract.',
  },
  {
    actionId: UNISWAP_V4_SWAP_ACTION,
    protocol: 'Uniswap v4',
    action: 'Swap',
    detail: 'Hookless pool',
    hint: 'Hooks stay off. The agent cannot pass router commands.',
  },
] as const;

export const UNISWAP_FEE_TIERS = [
  { fee: 100, tickSpacing: 1, label: '0.01%' },
  { fee: 500, tickSpacing: 10, label: '0.05%' },
  { fee: 3000, tickSpacing: 60, label: '0.30%' },
  { fee: 10000, tickSpacing: 200, label: '1%' },
] as const;

export function grantKey(actionId: string, tokenAddress: string): string {
  return `${actionId.toLowerCase()}:${tokenAddress.toLowerCase()}`;
}

export function venueByAction(actionId: string) {
  return VENUES.find((venue) => venue.actionId.toLowerCase() === actionId.toLowerCase());
}

export function isKuruMonUsdc(tokenIn: string, tokenOut: string): boolean {
  const pair = new Set([tokenIn.toLowerCase(), tokenOut.toLowerCase()]);
  return pair.has(NATIVE) && pair.has(MONAD_TESTNET_USDC.toLowerCase());
}

/** Route bytes for a pinned venue. This is not an arbitrary call. */
export function routeForGrant(
  actionId: string,
  tokenIn: string,
  tokenOut: string,
  fee: number | null,
  tickSpacing: number | null,
): Hex {
  if (actionId.toLowerCase() === KURU_CLOB_SWAP_ACTION.toLowerCase()) {
    if (!isKuruMonUsdc(tokenIn, tokenOut)) {
      throw new Error('Kuru on Monad Testnet is pinned to the MON/USDC market.');
    }
    return encodeAbiParameters([{ type: 'address' }], [KURU_MON_USDC_MARKET]);
  }

  if (actionId.toLowerCase() === UNISWAP_V4_SWAP_ACTION.toLowerCase()) {
    if (!fee || !tickSpacing) throw new Error('This Uniswap grant has no fee tier.');
    return encodeAbiParameters([{ type: 'uint24' }, { type: 'int24' }], [fee, tickSpacing]);
  }

  throw new Error('This grant does not name a pinned venue.');
}
