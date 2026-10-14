import type { ReactNode } from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { monadTestnet } from './contracts/monadChain';

export const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID ?? '';
const PRIVY_CLIENT_ID = import.meta.env.VITE_PRIVY_CLIENT_ID ?? '';

export function PrivyRoot({ children }: { children: ReactNode }) {
  if (!PRIVY_APP_ID) return children;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      {...(PRIVY_CLIENT_ID ? { clientId: PRIVY_CLIENT_ID } : {})}
      config={{
        loginMethods: ['google', 'twitter', 'discord'],
        appearance: {
          theme: 'light',
          accentColor: '#1C2430',
          landingHeader: 'Come aboard',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
