import type { Token, Budget, ShipLogEntry } from './types';
import { DEFAULT_CONTRACT_ADDRESS } from './contracts/monadChain';
import { MONAD_TESTNET_USDC, MONAD_TESTNET_WMON } from './contracts/venues';

export const SUPPORTED_TOKENS: Token[] = [
  {
    symbol: 'MON',
    name: 'Monad',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: MONAD_TESTNET_USDC,
    decimals: 6,
  },
  {
    symbol: 'WMON',
    name: 'Wrapped MON',
    address: MONAD_TESTNET_WMON,
    decimals: 18,
  },
];

export const CONTRACT_STRONGBOX_ADDRESS = DEFAULT_CONTRACT_ADDRESS;

const LEGACY_STORAGE_KEY = 'purser_strongbox_state_v1';
const BOOK_PREFIX = 'purser_book_v3_';
const PENDING_OWNER_KEY = 'purser.undeployed.owner';

export interface ContractState {
  epoch: number;
  owner: string;
  operator: string;
  hold: Record<string, string>; // tokenAddress -> amount string
  warrants: Record<string, Budget>; // grantKey(actionId, token) -> Budget
  logs: ShipLogEntry[];
}

export function emptyHold(): Record<string, string> {
  return Object.fromEntries(SUPPORTED_TOKENS.map((token) => [token.address, '0']));
}

export function emptyBook(owner = '', operator = ''): ContractState {
  return {
    epoch: 1,
    owner,
    operator,
    hold: emptyHold(),
    warrants: {},
    logs: [],
  };
}

function bookKey(owner: string): string {
  return `${BOOK_PREFIX}${owner.toLowerCase()}`;
}

export function loadBook(owner: string): ContractState | null {
  if (!owner) return null;
  try {
    const raw = localStorage.getItem(bookKey(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContractState;
    if ((parsed.owner || '').toLowerCase() !== owner.toLowerCase()) return null;
    return {
      ...emptyBook(owner),
      ...parsed,
      owner,
      hold: { ...emptyHold(), ...(parsed.hold || {}) },
      warrants: parsed.warrants || {},
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    };
  } catch {
    return null;
  }
}

export function saveBook(state: ContractState): void {
  if (!state.owner) return;
  try {
    localStorage.setItem(bookKey(state.owner), JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function clearBook(owner: string): void {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  if (owner) localStorage.removeItem(bookKey(owner));
}

/** Open the book that belongs to this session. The old shared demo ledger is discarded. */
export function openBookForSession(address: string, role: 'owner' | 'operator'): ContractState {
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  const pending = localStorage.getItem(PENDING_OWNER_KEY) || '';
  const owner =
    role === 'owner'
      ? address
      : pending && pending.toLowerCase() !== address.toLowerCase()
        ? pending
        : '';
  const saved = owner ? loadBook(owner) : null;
  const book = saved ?? emptyBook(role === 'owner' ? address : owner, role === 'operator' ? address : '');
  if (role === 'owner') book.owner = address;
  if (role === 'operator' && !book.operator) book.operator = address;
  return book;
}

export function formatCargoAmount(raw: string | undefined): string {
  const value = Number(raw || '0');
  if (!Number.isFinite(value) || value === 0) return '0';
  if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}
