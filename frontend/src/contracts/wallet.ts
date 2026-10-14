import { getAddress, type Address } from 'viem';
import { monadTestnet } from './monadChain';
import { monadService, setActiveEthereumProvider } from './contractService';

export type ShipRole = 'owner' | 'operator';

export class WalletConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletConnectError';
  }
}

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function injectedProvider(): EthereumProvider | null {
  if (typeof window === 'undefined') return null;
  const ethereum = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return ethereum ?? null;
}

function chainIdHex(): string {
  return `0x${monadTestnet.id.toString(16)}`;
}

async function ensureMonadTestnet(provider: EthereumProvider): Promise<void> {
  const chainId = chainIdHex();
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: monadTestnet.name,
          nativeCurrency: monadTestnet.nativeCurrency,
          rpcUrls: [...monadTestnet.rpcUrls.default.http],
          blockExplorerUrls: [monadTestnet.blockExplorers.default.url],
        },
      ],
    });
  }
}

function roleFor(address: Address, owner: Address, delegate: Address): ShipRole | null {
  if (address.toLowerCase() === owner.toLowerCase()) return 'owner';
  if (delegate !== '0x0000000000000000000000000000000000000000' && address.toLowerCase() === delegate.toLowerCase()) {
    return 'operator';
  }
  return null;
}

export function walletErrorMessage(error: unknown): string {
  if (error instanceof WalletConnectError) return error.message;
  const coded = error as { code?: number | string; privyErrorCode?: string };
  const privyCode = String(coded.privyErrorCode ?? coded.code ?? '');
  if (privyCode.includes('exited')) {
    return 'That window closed. Nothing changed. You can try again, or come aboard another way.';
  }
  if (coded.code === 4001) return 'The wallet window closed. Nothing was signed.';
  if (error instanceof Error && error.message) return error.message;
  return 'The wallet could not connect. You can try again.';
}

export async function grantRoleForAddress(
  rawAddress: string,
  walletName: string
): Promise<{ address: Address; role: ShipRole; walletName: string; deployed: boolean }> {
  const address = getAddress(rawAddress);
  const located = await monadService.locateStrongbox(address);
  if (located.status === 'unreachable') {
    throw new WalletConnectError(
      'Monad Testnet did not answer. Check the connection, then try this key again.'
    );
  }
  if (located.status === 'none') {
    monadService.useStrongbox(null);
    return { address, role: 'owner', walletName, deployed: false };
  }

  monadService.useStrongbox(located.box);
  const role = roleFor(address, located.owner, located.delegate);
  if (!role) {
    monadService.useStrongbox(null);
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    throw new WalletConnectError(
      `${short} is not named on this warrant. If this passkey has another key, try that one, or ask the owner to add this address.`
    );
  }

  return { address, role, walletName, deployed: true };
}

/** Ask the injected wallet for an account on Monad Testnet, then match it to the strongbox. */
export async function connectInjectedWallet(): Promise<{
  address: Address;
  role: ShipRole;
  walletName: string;
  deployed: boolean;
}> {
  const provider = injectedProvider();
  if (!provider) {
    throw new WalletConnectError('This browser has no wallet extension. A passkey can still come aboard.');
  }

  await ensureMonadTestnet(provider);
  setActiveEthereumProvider(provider);

  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  const raw = accounts?.[0];
  if (!raw) throw new WalletConnectError('The wallet did not return an account.');
  return grantRoleForAddress(raw, 'Browser Wallet');
}
