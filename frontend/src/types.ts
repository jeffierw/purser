export interface Token {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  isNative?: boolean;
}

export interface Budget {
  actionId: string;
  protocol: string;
  action: string;
  fee: number | null;
  tickSpacing: number | null;
  tokenAddress: string;
  remaining: string;
  perTxCap: string;
  validUntil: number | null; // null means no expiry
  epoch: number;
  active: boolean;
  allowedTokensOut: string[]; // token addresses
  delegateAddress: string;
  createdAt: number;
}

export interface HoldBalance {
  token: Token;
  amount: string;
}

export type LogType = 'spend' | 'withdraw' | 'revoke' | 'deposit' | 'grant';

export interface ShipLogEntry {
  id: string;
  timestamp: string;
  primaryText: string;
  hash: string;
  type: LogType;
}

export type UserRole = 'unauthenticated' | 'owner' | 'operator';
