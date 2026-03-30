import { startIndexing } from './indexer/indexer.js';
import { startAPI } from './api/server.js';

console.log('');
console.log('===========================================');
console.log('  Midnight Preprod Network Explorer');
console.log('===========================================');
console.log('');

// Start API server
startAPI();

// Start indexing
startIndexing().catch((err) => {
  console.error('Indexer error:', err);
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  process.exit(0);
});
