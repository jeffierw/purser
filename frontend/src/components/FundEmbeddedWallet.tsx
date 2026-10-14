import { useState } from 'react';
import { useAddFunds, useLinkAccount } from '@privy-io/react-auth';
import { monadTestnet } from '../contracts/monadChain';

const NATIVE_ASSET = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export function FundEmbeddedWallet({
  address,
  onError,
}: {
  address: string;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { addFunds } = useAddFunds();
  const { linkGoogle, linkTwitter, linkDiscord } = useLinkAccount({
    onError: () => onError('That login could not be linked.'),
  });

  return (
    <div className="sup-privy-tools">
      <button
        type="button"
        className="sup-disconnect-btn"
        onClick={() => {
          void addFunds({
            destination: {
              address,
              chain: `eip155:${monadTestnet.id}`,
              asset: NATIVE_ASSET,
            },
            fiat: { defaultAmount: '25' },
            crypto: { refundAddress: address },
          }).catch((error: unknown) => {
            onError(error instanceof Error ? error.message : 'Funding did not start.');
          });
        }}
      >
        Add funds
      </button>
      <button type="button" className="sup-disconnect-btn" onClick={() => setOpen((value) => !value)}>
        Link login
      </button>
      {open ? (
        <div className="sup-privy-menu">
          <button type="button" className="sup-disconnect-btn" onClick={() => linkGoogle()}>
            Google
          </button>
          <button type="button" className="sup-disconnect-btn" onClick={() => linkTwitter()}>
            X
          </button>
          <button type="button" className="sup-disconnect-btn" onClick={() => linkDiscord()}>
            Discord
          </button>
        </div>
      ) : null}
    </div>
  );
}
