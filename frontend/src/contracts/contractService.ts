import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  formatUnits,
  getAddress,
  type Address,
  type Hash,
  type LocalAccount,
} from 'viem';
import { monadTestnet, FACTORY_ADDRESS } from './monadChain';
import { KURU_DELEGATED_SPEND_ABI, KURU_CLOB_SWAP_ACTION, ERC20_ABI } from './contractAbi';

// Public RPC Client for Monad
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

let activeProvider: Eip1193Provider | null = null;
let activeAccount: LocalAccount | null = null;

/** Prefer the provider from the session that just logged in, including a Privy embedded wallet. */
export function setActiveEthereumProvider(provider: Eip1193Provider | null) {
  activeProvider = provider;
  if (provider) activeAccount = null;
}

/** A passkey-derived account signs through viem instead of an injected provider. */
export function setActiveLocalAccount(account: LocalAccount | null) {
  activeAccount = account;
  if (account) activeProvider = null;
}

// Check if browser has an injected Web3 wallet (MetaMask, Rabby, OKX, etc.)
export function getInjectedProvider() {
  if (activeProvider) return activeProvider;
  if (typeof window !== 'undefined' && (window as unknown as { ethereum?: Eip1193Provider }).ethereum) {
    return (window as unknown as { ethereum: Eip1193Provider }).ethereum;
  }
  return null;
}

export function getWalletClient() {
  if (activeAccount) {
    return createWalletClient({
      account: activeAccount,
      chain: monadTestnet,
      transport: http(),
    });
  }
  const provider = getInjectedProvider();
  if (!provider) return null;
  return createWalletClient({
    chain: monadTestnet,
    transport: custom(provider),
  });
}

export interface ContractBudgetData {
  remaining: bigint;
  perTxCap: bigint;
  validUntil: bigint;
  epoch: bigint;
  active: boolean;
}

export interface ContractReadData {
  owner: Address;
  delegate: Address;
  entrypoint: Address;
  epoch: bigint;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'strongboxOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'strongboxByDelegate',
    stateMutability: 'view',
    inputs: [{ name: 'delegate', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'open',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'delegate_', type: 'address' }],
    outputs: [{ name: 'strongbox', type: 'address' }],
  },
  {
    type: 'function',
    name: 'linkDelegate',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

export type LocatedStrongbox =
  | { status: 'ready'; box: Address; owner: Address; delegate: Address }
  | { status: 'none' }
  | { status: 'unreachable' };

/**
 * Service to execute on-chain calls matching PurserStrongbox.sol.
 * The address follows the logged-in sailor's own box. Grants name an action id.
 */
export class MonadContractService {
  private contractAddress: Address = ZERO_ADDRESS;

  strongboxAddress(): Address {
    return this.contractAddress;
  }

  useStrongbox(address: Address | null) {
    this.contractAddress = address && address !== ZERO_ADDRESS ? getAddress(address) : ZERO_ADDRESS;
  }

  /** Find the box this address owns, or the box where it is the current agent. */
  async locateStrongbox(account: Address): Promise<LocatedStrongbox> {
    try {
      const code = await publicClient.getBytecode({ address: FACTORY_ADDRESS });
      if (!code || code === '0x') return { status: 'unreachable' };

      let box = (await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: 'strongboxOf',
        args: [account],
      })) as Address;

      if (!box || box === ZERO_ADDRESS) {
        const byAgent = (await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: FACTORY_ABI,
          functionName: 'strongboxByDelegate',
          args: [account],
        })) as Address;
        if (byAgent && byAgent !== ZERO_ADDRESS) {
          const current = (await publicClient.readContract({
            address: byAgent,
            abi: KURU_DELEGATED_SPEND_ABI,
            functionName: 'delegate',
          })) as Address;
          if (current.toLowerCase() === account.toLowerCase()) box = byAgent;
        }
      }

      if (!box || box === ZERO_ADDRESS) return { status: 'none' };

      const [owner, delegate] = await Promise.all([
        publicClient.readContract({
          address: box,
          abi: KURU_DELEGATED_SPEND_ABI,
          functionName: 'owner',
        }),
        publicClient.readContract({
          address: box,
          abi: KURU_DELEGATED_SPEND_ABI,
          functionName: 'delegate',
        }),
      ]);
      return { status: 'ready', box, owner: owner as Address, delegate: delegate as Address };
    } catch {
      return { status: 'unreachable' };
    }
  }

  /** Opens a box owned by this account. A zero agent means the owner is also the agent. */
  async openStrongbox(account: Address): Promise<Address> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');
    const hash = await client.writeContract({
      account,
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'open',
      args: [ZERO_ADDRESS],
    });
    await publicClient.waitForTransactionReceipt({ hash });
    const box = (await publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'strongboxOf',
      args: [account],
    })) as Address;
    if (!box || box === ZERO_ADDRESS) throw new Error('The strongbox was not opened.');
    this.useStrongbox(box);
    return getAddress(box);
  }

  async linkDelegate(account: Address): Promise<Hash> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');
    const hash = await client.writeContract({
      account,
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'linkDelegate',
    });
    await publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // ================= READ METHODS =================

  /** `missing` means the RPC answered and this address has no contract code. */
  async readStrongboxPresence(): Promise<'ready' | 'missing' | 'unreachable'> {
    try {
      const code = await publicClient.getBytecode({ address: this.contractAddress });
      if (!code || code === '0x') return 'missing';
      return 'ready';
    } catch {
      return 'unreachable';
    }
  }

  async readCoreState(): Promise<ContractReadData | null> {
    try {
      const [owner, delegate, entrypoint, epoch] = await Promise.all([
        publicClient.readContract({
          address: this.contractAddress,
          abi: KURU_DELEGATED_SPEND_ABI,
          functionName: 'owner',
        }),
        publicClient.readContract({
          address: this.contractAddress,
          abi: KURU_DELEGATED_SPEND_ABI,
          functionName: 'delegate',
        }),
        publicClient.readContract({
          address: this.contractAddress,
          abi: KURU_DELEGATED_SPEND_ABI,
          functionName: 'actions',
          args: [KURU_CLOB_SWAP_ACTION],
        }),
        publicClient.readContract({
          address: this.contractAddress,
          abi: KURU_DELEGATED_SPEND_ABI,
          functionName: 'epoch',
        }),
      ]);

      return {
        owner: owner as Address,
        delegate: delegate as Address,
        entrypoint: (entrypoint as readonly [Address, boolean])[0],
        epoch: epoch as bigint,
      };
    } catch (err) {
      console.warn('[MonadContractService] Failed to read on-chain core state:', err);
      return null;
    }
  }

  async readBudget(actionId: `0x${string}`, tokenAddress: Address): Promise<ContractBudgetData | null> {
    try {
      const res = await publicClient.readContract({
        address: this.contractAddress,
        abi: KURU_DELEGATED_SPEND_ABI,
        functionName: 'budgets',
        args: [actionId, tokenAddress],
      });
      return {
        remaining: res[0],
        perTxCap: res[1],
        validUntil: BigInt(res[2]),
        epoch: res[3],
        active: res[4],
      };
    } catch (err) {
      console.warn('[MonadContractService] Failed to read budget on-chain:', err);
      return null;
    }
  }

  async readPairAllowed(actionId: `0x${string}`, tokenIn: Address, tokenOut: Address): Promise<boolean> {
    try {
      return (await publicClient.readContract({
        address: this.contractAddress,
        abi: KURU_DELEGATED_SPEND_ABI,
        functionName: 'pairAllowed',
        args: [actionId, tokenIn, tokenOut],
      })) as boolean;
    } catch {
      return false;
    }
  }

  async readHolderBalances(
    holder: Address,
    tokens: { address: string; decimals: number; isNative?: boolean }[],
  ): Promise<Record<string, string>> {
    const entries = await Promise.all(
      tokens.map(async (token) => {
        try {
          const raw = token.isNative
            ? await publicClient.getBalance({ address: holder })
            : ((await publicClient.readContract({
                address: token.address as Address,
                abi: ERC20_ABI,
                functionName: 'balanceOf',
                args: [holder],
              })) as bigint);
          return [token.address, formatUnits(raw, token.decimals)] as const;
        } catch {
          return [token.address, '0'] as const;
        }
      }),
    );
    return Object.fromEntries(entries);
  }

  async readVaultBalance(tokenAddress: Address, isNative: boolean): Promise<string> {
    try {
      if (isNative) {
        const balance = await publicClient.getBalance({ address: this.contractAddress });
        return formatUnits(balance, 18);
      } else {
        const balance = (await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [this.contractAddress],
        })) as bigint;
        return formatUnits(balance, 6);
      }
    } catch {
      return '0';
    }
  }

  // ================= WRITE METHODS =================

  async depositNative(account: Address, amount: string): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    const value = parseUnits(amount, 18);
    const hash = await client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'depositNative',
      value,
    });
    return hash;
  }

  async depositToken(
    account: Address,
    tokenAddress: Address,
    amount: string,
    decimals = 6
  ): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    const amountUnits = parseUnits(amount, decimals);

    // 1. Approve token
    await client.writeContract({
      account,
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [this.contractAddress, amountUnits],
    });

    // 2. Deposit token
    const hash = await client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'depositToken',
      args: [tokenAddress, amountUnits],
    });
    return hash;
  }

  async withdraw(
    account: Address,
    tokenAddress: Address,
    amount: string,
    to: Address,
    decimals = 18
  ): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    const amountUnits = parseUnits(amount, decimals);
    const hash = await client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'withdraw',
      args: [tokenAddress, amountUnits, to],
    });
    return hash;
  }

  async setBudget(
    account: Address,
    actionId: `0x${string}`,
    tokenAddress: Address,
    remaining: string,
    perTxCap: string,
    validUntilTs: number | null,
    decimals = 18
  ): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    const remUnits = parseUnits(remaining, decimals);
    const capUnits = parseUnits(perTxCap, decimals);
    const validUntilSec = validUntilTs ? BigInt(Math.floor(validUntilTs / 1000)) : 0n;

    const hash = await client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'setBudget',
      args: [actionId, tokenAddress, remUnits, capUnits, validUntilSec],
    });
    return hash;
  }

  async setDelegate(account: Address, next: Address): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    return client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'setDelegate',
      args: [next],
    });
  }

  async setPair(
    account: Address,
    actionId: `0x${string}`,
    tokenIn: Address,
    tokenOut: Address,
    allowed: boolean
  ): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    const hash = await client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'setPair',
      args: [actionId, tokenIn, tokenOut, allowed],
    });
    return hash;
  }

  async revokeBudget(account: Address, actionId: `0x${string}`, tokenAddress: Address): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    return client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'revokeBudget',
      args: [actionId, tokenAddress],
    });
  }

  async revokeAll(account: Address): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    const hash = await client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'revokeAll',
    });
    return hash;
  }

  async execute(
    account: Address,
    actionId: `0x${string}`,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: string,
    minAmountOut: string,
    route: `0x${string}`,
    inDecimals = 18,
    outDecimals = 18
  ): Promise<Hash | null> {
    const client = getWalletClient();
    if (!client) throw new Error('No wallet connected to Monad');

    const inUnits = parseUnits(amountIn, inDecimals);
    const minOutUnits = parseUnits(minAmountOut, outDecimals);

    const hash = await client.writeContract({
      account,
      address: this.contractAddress,
      abi: KURU_DELEGATED_SPEND_ABI,
      functionName: 'execute',
      args: [actionId, tokenIn, tokenOut, inUnits, minOutUnits, route],
    });
    return hash;
  }
}

export const monadService = new MonadContractService();
