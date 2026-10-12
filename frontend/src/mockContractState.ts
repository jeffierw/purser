import type { Token, Budget, ShipLogEntry } from './types';

export const SUPPORTED_TOKENS: Token[] = [
  {
    symbol: 'MON',
    name: 'Monad Native Coin',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    isNative: true,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea',
    decimals: 6,
  },
  {
    symbol: 'CHOG',
    name: 'Chog Coin',
    address: '0xE0590015A87363f424cF5601280d442041451a45',
    decimals: 18,
  },
  {
    symbol: 'WMON',
    name: 'Wrapped MON',
    address: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',
    decimals: 18,
  },
];

export const OWNER_ADDRESS = '0x8b32A247c4b07Ccf8e5d36e298516c944Dfc108C';
export const DEFAULT_OPERATOR_ADDRESS = '0x3F88cA37E84B5B49d863581775796f61F1E67C92';
export const CONTRACT_STRONGBOX_ADDRESS = '0x992B92B08a79243781254394eDEB1578F8A1eC00';

const STORAGE_KEY = 'purser_strongbox_state_v1';

export interface ContractState {
  epoch: number;
  owner: string;
  operator: string;
  hold: Record<string, string>; // tokenAddress -> amount string
  warrants: Record<string, Budget>; // tokenInAddress -> Budget
  logs: ShipLogEntry[];
}


function getInitialState(): ContractState {
  const initialWarrant: Budget = {
    tokenAddress: SUPPORTED_TOKENS[1].address, // USDC
    remaining: '800',
    perTxCap: '200',
    validUntil: null, // no expiry
    epoch: 1,
    active: true,
    allowedTokensOut: [SUPPORTED_TOKENS[0].address, SUPPORTED_TOKENS[2].address], // MON, CHOG
    delegateAddress: DEFAULT_OPERATOR_ADDRESS,
    createdAt: Date.now() - 3600 * 1000 * 24,
  };

  return {
    epoch: 1,
    owner: OWNER_ADDRESS,
    operator: DEFAULT_OPERATOR_ADDRESS,
    hold: {
      [SUPPORTED_TOKENS[0].address]: '150', // 150 MON
      [SUPPORTED_TOKENS[1].address]: '1200', // 1200 USDC
      [SUPPORTED_TOKENS[2].address]: '3400', // 3400 CHOG
      [SUPPORTED_TOKENS[3].address]: '0',
    },
    warrants: {
      [SUPPORTED_TOKENS[1].address]: initialWarrant,
    },
    logs: [
      {
        id: '1',
        timestamp: 'Two days ago, 14:20',
        primaryText: 'Owner put 150 MON and 1200 USDC aboard.',
        hash: '0x3a4b9c1d…',
        type: 'deposit',
      },
      {
        id: '2',
        timestamp: 'Yesterday, 09:15',
        primaryText: 'Warrant written: Operator may spend 1000 USDC toward MON and CHOG.',
        hash: '0x99f7a81b…',
        type: 'grant',
      },
      {
        id: '3',
        timestamp: 'Yesterday, 16:42',
        primaryText: '200 USDC became 3400 CHOG. Came aboard.',
        hash: '0x1c88d24e…',
        type: 'spend',
      },
    ],
  };
}

export function loadContractState(): ContractState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  return getInitialState();
}

export function saveContractState(state: ContractState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // ignore
  }
}
