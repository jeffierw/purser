import { useEffect, useRef, useState } from 'react';
import { useLogin, useWallets } from '@privy-io/react-auth';
import { monadTestnet } from '../contracts/monadChain';
import { setActiveEthereumProvider } from '../contracts/contractService';
import { grantRoleForAddress, walletErrorMessage, type EthereumProvider, type ShipRole } from '../contracts/wallet';
import { disconnectMera } from '../contracts/mera';

const SOCIALS = [
  { id: 'google', mark: 'G', title: 'Google', subtitle: 'Opens an embedded wallet' },
  { id: 'twitter', mark: 'X', title: 'X', subtitle: 'Opens an embedded wallet' },
  { id: 'discord', mark: 'D', title: 'Discord', subtitle: 'Opens an embedded wallet' },
] as const;

interface SocialLoginProps {
  disabled: boolean;
  onStart: (message: string) => void;
  onSuccess: (address: string, role: ShipRole, walletName: string, deployed: boolean) => void;
  onError: (message: string) => void;
}

export function SocialLogin({ disabled, onStart, onSuccess, onError }: SocialLoginProps) {
  const [waitingForWallet, setWaitingForWallet] = useState(false);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  const { wallets } = useWallets();
  const { login } = useLogin({
    onComplete: () => setWaitingForWallet(true),
    onError: (error) => {
      setWaitingForWallet(false);
      onError(walletErrorMessage(error));
    },
  });

  useEffect(() => {
    if (!waitingForWallet) return;
    const wallet = wallets.find((item) => item.walletClientType === 'privy') ?? wallets[0];
    if (!wallet) return;

    let cancelled = false;
    void (async () => {
      try {
        await wallet.switchChain(monadTestnet.id);
        const provider = (await wallet.getEthereumProvider()) as EthereumProvider;
        setActiveEthereumProvider(provider);
        const session = await grantRoleForAddress(wallet.address, `Privy ${wallet.walletClientType}`);
        if (!cancelled) onSuccessRef.current(session.address, session.role, session.walletName, session.deployed);
      } catch (error) {
        if (!cancelled) onErrorRef.current(walletErrorMessage(error));
      } finally {
        if (!cancelled) setWaitingForWallet(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [waitingForWallet, wallets]);

  return (
    <div className="lg-providers">
      {SOCIALS.map((social) => (
        <button
          key={social.id}
          type="button"
          className="lg-btn lg-btn--wallet"
          disabled={disabled}
          onClick={() => {
            disconnectMera();
            onStart(`Opening ${social.title}…`);
            login({ loginMethods: [social.id] });
          }}
        >
          <span className="lg-btn-icon">{social.mark}</span>
          <div className="lg-btn-text">
            <span className="lg-btn-title">{social.title}</span>
            <span className="lg-btn-subtitle">{social.subtitle}</span>
          </div>
          <span className="lg-btn-arrow">→</span>
        </button>
      ))}
    </div>
  );
}
