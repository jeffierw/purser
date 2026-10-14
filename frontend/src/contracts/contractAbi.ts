/** Matches `PurserStrongbox.KURU_FLOW_SWAP`. Mainnet Kuru Flow entrypoint, not on testnet. */
export const KURU_FLOW_SWAP_ACTION =
  '0x7f2cf91e67731ac2a3241f80060da0da599bd393e6749e798e01d441ebe4f574' as const;

/** Matches `PurserStrongbox.KURU_CLOB_SWAP`. */
export const KURU_CLOB_SWAP_ACTION =
  '0x7c37602c2e63dc711a8794b98057b9ef1118fd13528f044b0e9e1064ee4cc8ae' as const;

/** Matches `PurserStrongbox.UNISWAP_V4_SWAP`. */
export const UNISWAP_V4_SWAP_ACTION =
  '0xfd91107d0462541f1a47749a58d5bdbe9a7ee950c15b5dd73d2859d9291dd22e' as const;

export const KURU_DELEGATED_SPEND_ABI = [
  // Read Functions
  {
    type: 'function',
    name: 'owner',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'delegate',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'KURU_FLOW_SWAP',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'actions',
    inputs: [{ name: 'actionId', type: 'bytes32' }],
    outputs: [
      { name: 'adapter', type: 'address' },
      { name: 'enabled', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'epoch',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'NATIVE',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'budgets',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'tokenIn', type: 'address' },
    ],
    outputs: [
      { name: 'remaining', type: 'uint256' },
      { name: 'perTxCap', type: 'uint256' },
      { name: 'validUntil', type: 'uint64' },
      { name: 'epoch', type: 'uint256' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'pairAllowed',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },

  // Write Functions (Owner)
  {
    type: 'function',
    name: 'setDelegate',
    inputs: [{ name: 'next', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setAdapter',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'adapter', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setActionEnabled',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'enabled', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPair',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'allowed', type: 'bool' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setBudget',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'token', type: 'address' },
      { name: 'remaining', type: 'uint256' },
      { name: 'perTxCap', type: 'uint256' },
      { name: 'validUntil', type: 'uint64' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeBudget',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'token', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeAll',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'depositNative',
    inputs: [],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'depositToken',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'to', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },

  // Write Function (Operator / Delegate)
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'actionId', type: 'bytes32' },
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'minAmountOut', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ name: 'gained', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },

  // Events
  {
    type: 'event',
    name: 'DelegateSet',
    inputs: [{ name: 'delegate', type: 'address', indexed: true }],
  },
  {
    type: 'event',
    name: 'PairSet',
    inputs: [
      { name: 'tokenIn', type: 'address', indexed: true },
      { name: 'tokenOut', type: 'address', indexed: true },
      { name: 'allowed', type: 'bool', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'BudgetSet',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'remaining', type: 'uint256', indexed: false },
      { name: 'perTxCap', type: 'uint256', indexed: false },
      { name: 'validUntil', type: 'uint64', indexed: false },
      { name: 'epoch', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Revoked',
    inputs: [{ name: 'epoch', type: 'uint256', indexed: false }],
  },
  {
    type: 'event',
    name: 'Spent',
    inputs: [
      { name: 'tokenIn', type: 'address', indexed: true },
      { name: 'tokenOut', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'epoch', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'decimals',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;
