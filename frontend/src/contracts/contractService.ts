import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  formatUnits,
  type Address,
  type Hash,
} from 'viem';
import { monadTestnet, DEFAULT_CONTRACT_ADDRESS } from './monadChain';
import { KURU_DELEGATED_SPEND_ABI, ERC20_ABI } from './contractAbi';

// Public RPC Client for Monad
export const publicClient = createPublicClient({
  chain: monadTestnet,
  transport: http(),
});

// Check if browser has an injected Web3 wallet (MetaMask, Rabby, OKX, etc.)
export function getInjectedProvider() {
  if (typeof window !== 'undefined' && (window as unknown as { ethereum?: unknown }).ethereum) {
    return (window as unknown as { ethereum: { request: (args: unknown) => Promise<unknown> } }).ethereum;
  }
  return null;
}

export function getWalletClient() {
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

/**
 * Service to execute on-chain calls matching KuruDelegatedSpend.sol
 */
export class MonadContractService {
  private contractAddress: Address;

  constructor(address: Address = DEFAULT_CONTRACT_ADDRESS) {
    this.contractAddress = address;
  }

  // ================= READ METHODS =================

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
          functionName: 'entrypoint',
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
        entrypoint: entrypoint as Address,
        epoch: epoch as bigint,
      };
    } catch (err) {
      console.warn('[MonadContractService] Failed to read on-chain core state:', err);
      return null;
    }
  }

  async readBudget(tokenAddress: Address): Promise<ContractBudgetData | null> {
    try {
      const res = await publicClient.readContract({
        address: this.contractAddress,
        abi: KURU_DELEGATED_SPEND_ABI,
        functionName: 'budgets',
        args: [tokenAddress],
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

  async readPairAllowed(tokenIn: Address, tokenOut: Address): Promise<boolean> {
    try {
      return (await publicClient.readContract({
        address: this.contractAddress,
        abi: KURU_DELEGATED_SPEND_ABI,
        functionName: 'pairAllowed',
        args: [tokenIn, tokenOut],
      })) as boolean;
    } catch {
      return false;
    }
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
      args: [tokenAddress, remUnits, capUnits, validUntilSec],
    });
    return hash;
  }

  async setPair(
    account: Address,
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
      args: [tokenIn, tokenOut, allowed],
    });
    return hash;
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

  async spend(
    account: Address,
    tokenIn: Address,
    tokenOut: Address,
    amountIn: string,
    minAmountOut: string,
    programHex = '0x' as `0x${string}`,
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
      functionName: 'spend',
      args: [tokenIn, tokenOut, inUnits, minOutUnits, programHex],
    });
    return hash;
  }
}

export const monadService = new MonadContractService();
