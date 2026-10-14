import { HDKey } from '@scure/bip32';
import { entropyToMnemonic, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import {
  createPasskeyWithPrfOutput,
  createSecp256k1SigningSession,
  getPasskeyPrfOutput,
  isMeraError,
  type Secp256k1SigningSession,
} from '@category-labs/mera';
import { toViemAccount } from '@category-labs/mera/viem';
import type { Address } from 'viem';
import { setActiveLocalAccount } from './contractService';
import { grantRoleForAddress, WalletConnectError } from './wallet';

const CREDENTIAL_KEY = 'purser.mera.credential';

let pendingPrf: Uint8Array | null = null;
let session: Secp256k1SigningSession | undefined;

export type MeraKey = {
  index: number;
  address: Address;
};

function deriveEvmKey(prfOutput: Uint8Array, index: number): Uint8Array {
  const mnemonic = entropyToMnemonic(prfOutput, wordlist);
  const seed = mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  try {
    const node = root.derive(`m/44'/60'/0'/0/${index}`);
    if (node.privateKey === null) throw new Error('This passkey did not produce a key.');
    const key = new Uint8Array(node.privateKey);
    node.wipePrivateData();
    return key;
  } finally {
    seed.fill(0);
    root.wipePrivateData();
  }
}

function addressFor(prfOutput: Uint8Array, index: number): Address {
  const privateKey = deriveEvmKey(prfOutput, index);
  const opened = createSecp256k1SigningSession({ privateKey });
  try {
    return toViemAccount(opened).address;
  } finally {
    opened.end();
    privateKey.fill(0);
  }
}

function rememberCredential(credentialId: string) {
  localStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ credentialId }));
}

export type AccessNotice = {
  tone: 'calm' | 'alert';
  message: string;
};

function causesOf(error: unknown): unknown[] {
  const list: unknown[] = [];
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    list.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return list;
}

function domErrorName(error: unknown): string {
  for (const item of causesOf(error)) {
    if (!item || typeof item !== 'object' || !('name' in item)) continue;
    const name = (item as { name?: unknown }).name;
    if (typeof name === 'string' && name !== 'Error' && name !== 'MeraError') return name;
  }
  return '';
}

/** User-facing copy. Closing the passkey window is a calm note, not a failure. */
export function describeMeraFailure(error: unknown): AccessNotice {
  const domName = domErrorName(error);
  if (domName === 'NotAllowedError' || domName === 'AbortError') {
    return {
      tone: 'calm',
      message: 'Passkey closed. Nothing changed. Open it again whenever you are ready.',
    };
  }
  if (isMeraError(error)) {
    if (error.code === 'PRF_UNAVAILABLE') {
      return {
        tone: 'alert',
        message: 'This passkey cannot open a key on this computer. In Chrome, save it to Google Password Manager, then try again.',
      };
    }
    if (error.code === 'CRYPTO_UNAVAILABLE' || domName === 'SecurityError') {
      return {
        tone: 'alert',
        message: 'Passkeys need a secure page. Open Purser on localhost or https, then try again.',
      };
    }
    if (domName === 'NotSupportedError') {
      return {
        tone: 'alert',
        message: 'This browser cannot open a passkey. Chrome can, or you can come aboard with a browser wallet.',
      };
    }
    if (error.code === 'PASSKEY_OPERATION_FAILED') {
      return {
        tone: 'alert',
        message: 'The passkey could not be opened. You can try again, or come aboard another way.',
      };
    }
  }
  if (error instanceof WalletConnectError || error instanceof Error) {
    return { tone: 'alert', message: error.message };
  }
  return { tone: 'alert', message: 'The passkey could not be opened. You can try again.' };
}

/** One passkey prompt. Returns the first two keys derived from it. */
export async function unlockMeraKeys(): Promise<MeraKey[]> {
  disconnectMera();
  const stored = localStorage.getItem(CREDENTIAL_KEY);
  const known = stored ? (JSON.parse(stored) as { credentialId?: string }) : undefined;

  let prfOutput: Uint8Array;
  let credentialId: string;

  if (known?.credentialId) {
    const opened = await getPasskeyPrfOutput({
      rpId: location.hostname,
      credential: { credentialId: known.credentialId },
    });
    prfOutput = opened.prfOutput;
    credentialId = opened.credentialId;
  } else {
    const created = await createPasskeyWithPrfOutput({
      rp: { id: location.hostname, name: 'Purser' },
      user: { name: 'purser', displayName: 'Purser' },
    });
    prfOutput = created.prfOutput;
    credentialId = created.credentialId;
  }

  rememberCredential(credentialId);
  pendingPrf = new Uint8Array(prfOutput);
  return [0, 1].map((index) => ({ index, address: addressFor(pendingPrf as Uint8Array, index) }));
}

export async function boardWithMeraKey(index: number) {
  if (!pendingPrf) throw new WalletConnectError('Open the passkey first, then choose a key.');
  if (session) {
    session.end();
    session = undefined;
  }
  const privateKey = deriveEvmKey(pendingPrf, index);
  session = createSecp256k1SigningSession({ privateKey });
  privateKey.fill(0);
  const account = toViemAccount(session);
  setActiveLocalAccount(account);
  try {
    return await grantRoleForAddress(account.address, `Passkey key ${index + 1}`);
  } catch (error) {
    session.end();
    session = undefined;
    setActiveLocalAccount(null);
    throw error;
  }
}

export function disconnectMera() {
  session?.end();
  session = undefined;
  if (pendingPrf) pendingPrf.fill(0);
  pendingPrf = null;
  setActiveLocalAccount(null);
}
