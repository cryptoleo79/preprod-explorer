# Midnight Preprod Explorer

Block explorer and indexer for Midnight Preprod Network.

## Network Details

| Property | Value |
|----------|-------|
| **Network** | Midnight Preprod |
| **RPC** | `wss://rpc.preprod.midnight.network` |
| **Genesis Hash** | `0x47966a2b82275f75cf0b7e51e4161b546158e8ce2cc9e743b7caa10735e06830` |
| **Node Version** | `0.20.0-76958d41` |
| **Ledger Version** | `ledger-7.0.0-rc.2` |
| **API Port** | 3004 |

## Quick Start

```bash
# Install dependencies
npm install

# Start indexer + API
npm run dev

# Or just the API (if already indexed)
npm run api-only
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /api/network` | Network info |
| `GET /api/stats` | Indexer statistics |
| `GET /api/blocks` | List blocks (paginated) |
| `GET /api/blocks/:heightOrHash` | Get block by height or hash |
| `GET /api/blocks/:height/extrinsics` | Block extrinsics |
| `GET /api/blocks/:height/events` | Block events |
| `GET /api/extrinsics` | Recent extrinsics |
| `GET /api/extrinsics/:hash` | Get extrinsic by hash |
| `GET /api/search?q=...` | Search by hash or height |
| `GET /api/epoch` | Current epoch info |
| `GET /api/analytics/extrinsic-types` | Extrinsic distribution |
| `GET /api/analytics/block-rate` | Block production rate |

## Project Structure

```
preprod-explorer/
├── src/
│   ├── index.ts           # Entry point
│   ├── config.ts          # Network configuration
│   ├── indexer/
│   │   ├── database.ts    # SQLite database layer
│   │   └── indexer.ts     # Block indexer
│   └── api/
│       └── server.ts      # Express API server
├── data/
│   └── preprod.db         # SQLite database (auto-created)
├── package.json
└── tsconfig.json
```

## Current Services on This Machine

| Port | Service | Network |
|------|---------|---------|
| 3001 | midnight-indexer | testnet-02 |
| 3002 | preview-indexer | preview |
| 3003 | midnight-preview-indexer | preview (built) |
| **3004** | **preprod-explorer** | **preprod** |

## Database Schema

### blocks
- `height` (PK), `hash`, `parent_hash`, `state_root`, `extrinsics_root`, `timestamp`, `extrinsics_count`

### extrinsics
- `id`, `hash`, `block_height`, `block_hash`, `index_in_block`, `section`, `method`, `args`, `signer`, `timestamp`

### events
- `id`, `block_height`, `block_hash`, `extrinsic_index`, `event_index`, `section`, `method`, `data`, `timestamp`

### epoch_info
- `epoch`, `sidechain_slot`, `mainchain_epoch`, `mainchain_slot`, `next_epoch_timestamp`, `committee`
