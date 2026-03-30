// Midnight Preview Network Configuration
export const config = {
  // Network
  network: {
    name: 'Midnight Preview',
    rpcEndpoint: 'wss://rpc.preview.midnight.network',
    httpEndpoint: 'https://rpc.preview.midnight.network',
    genesisHash: '0x70e2e53c401c4c6ae277bc45fc1ad1b6bd63a6831321076d58120051ecbfb945',
    chainType: 'Live',
  },

  // Node Info (from RPC)
  node: {
    name: 'Midnight Node',
    version: '0.22.0-238079bc',
    ledgerVersion: 'ledger-8.0.0',
    specVersion: 22000,
    transactionVersion: 2,
  },

  // Indexer Settings
  indexer: {
    batchSize: 100,
    startFromRecent: false,
    reconnectDelay: 5000,
    maxReconnectDelay: 60000,
  },

  // API Server
  api: {
    port: 3000,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
  },

  // Database
  database: {
    path: './data/preview.db',
  },

  // Sidechain (Cardano Partner Chain)
  sidechain: {
    mainchainEpoch: 0,
    dParameter: {
      numPermissionedCandidates: 10,
      numRegisteredCandidates: 0,
    },
  },
};

export default config;
