import { defineChain, getAddress } from 'viem';

export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
    public: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
});

/** The first strongbox, owned by the deploy key. New sailors open their own through the factory. */
export const DEFAULT_CONTRACT_ADDRESS = getAddress('0x2399D477400A9390776884e9575b914fe1E44174');

/** Shared factory. `open` pins the already-deployed Kuru and Uniswap v4 adapters. */
export const FACTORY_ADDRESS = getAddress('0xB7bDDe084B1196a8E561600241AAd636FBE2ED73');

