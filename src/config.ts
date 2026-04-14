// Midnight Preview Network Configuration
export const config = {
  network: {
    name: 'Midnight Preview',
    rpcEndpoint: 'wss://rpc.preview.midnight.network',
    httpEndpoint: 'https://rpc.preview.midnight.network',
    genesisHash: '0x70e2e53c401c4c6ae277bc45fc1ad1b6bd63a6831321076d58120051ecbfb945',
    chainType: 'Live',
  },
  node: { name: 'Midnight Node', version: '0.22.3-6f0ef437', ledgerVersion: 'ledger-8.0.0', specVersion: 22000, transactionVersion: 2 },
  indexer: { batchSize: 100, startFromRecent: false, reconnectDelay: 5000, maxReconnectDelay: 60000 },
  api: { port: 3000, corsOrigins: ['http://localhost:3000', 'http://localhost:5173', 'https://nightforge.jp', 'https://mainnet.nightforge.jp', 'https://preprod.nightforge.jp', 'https://preview.nightforge.jp'] },
  database: { path: './data/preview.db' },
  sidechain: { mainchainEpoch: 0, dParameter: { numPermissionedCandidates: 10, numRegisteredCandidates: 0 } },
};
export default config;
