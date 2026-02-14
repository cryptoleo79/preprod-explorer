// Midnight Preprod Network Configuration
export const config = {
  // Network
  network: {
    name: 'Midnight Preprod',
    rpcEndpoint: 'wss://rpc.preprod.midnight.network',
    httpEndpoint: 'https://rpc.preprod.midnight.network',
    genesisHash: '0x47966a2b82275f75cf0b7e51e4161b546158e8ce2cc9e743b7caa10735e06830',
    chainType: 'Live',
  },

  // Node Info (from RPC)
  node: {
    name: 'Midnight Node',
    version: '0.20.0-76958d41',
    ledgerVersion: 'ledger-7.0.0-rc.2',
    specVersion: 20000,
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
    port: 3004,
    corsOrigins: ['http://localhost:3000', 'http://localhost:5173'],
  },

  // Database
  database: {
    path: './data/preprod.db',
  },

  // Sidechain (Cardano Partner Chain)
  sidechain: {
    mainchainEpoch: 267,
    dParameter: {
      numPermissionedCandidates: 10,
      numRegisteredCandidates: 0,
    },
  },
};

export default config;
