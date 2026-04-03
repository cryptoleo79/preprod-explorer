import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import config from '../config.js';

// Ensure data directory exists
mkdirSync(dirname(config.database.path), { recursive: true });

export const db = new Database(config.database.path);

export function initDatabase(): void {
  console.log('Initializing database...');

  db.exec(`
    CREATE TABLE IF NOT EXISTS blocks (
      height INTEGER PRIMARY KEY,
      hash TEXT UNIQUE NOT NULL,
      parent_hash TEXT NOT NULL,
      state_root TEXT,
      extrinsics_root TEXT,
      timestamp INTEGER NOT NULL,
      extrinsics_count INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS extrinsics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT UNIQUE NOT NULL,
      block_height INTEGER NOT NULL,
      block_hash TEXT NOT NULL,
      index_in_block INTEGER NOT NULL,
      section TEXT NOT NULL,
      method TEXT NOT NULL,
      args TEXT,
      signer TEXT,
      success INTEGER DEFAULT 1,
      timestamp INTEGER NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (block_height) REFERENCES blocks(height)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_height INTEGER NOT NULL,
      block_hash TEXT NOT NULL,
      extrinsic_index INTEGER,
      event_index INTEGER NOT NULL,
      section TEXT NOT NULL,
      method TEXT NOT NULL,
      data TEXT,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (block_height) REFERENCES blocks(height)
    );

    CREATE TABLE IF NOT EXISTS validators (
      address TEXT PRIMARY KEY,
      peer_id TEXT,
      role TEXT DEFAULT 'FULL',
      best_block INTEGER,
      last_seen INTEGER,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS epoch_info (
      epoch INTEGER PRIMARY KEY,
      sidechain_slot INTEGER,
      mainchain_epoch INTEGER,
      mainchain_slot INTEGER,
      next_epoch_timestamp INTEGER,
      committee TEXT,
      recorded_at INTEGER DEFAULT (strftime('%s', 'now'))
    );

    CREATE TABLE IF NOT EXISTS state (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks(hash);
    CREATE INDEX IF NOT EXISTS idx_extrinsics_block ON extrinsics(block_height);
    CREATE INDEX IF NOT EXISTS idx_extrinsics_section_method ON extrinsics(section, method);
    CREATE INDEX IF NOT EXISTS idx_extrinsics_signer ON extrinsics(signer);
    CREATE INDEX IF NOT EXISTS idx_extrinsics_timestamp ON extrinsics(timestamp);
    CREATE INDEX IF NOT EXISTS idx_events_block ON events(block_height);
    CREATE INDEX IF NOT EXISTS idx_events_section_method ON events(section, method);
  `);

  console.log('Database initialized');
}

// Lazy-initialized prepared statements
let insertBlockStmt: ReturnType<typeof db.prepare> | null = null;
let insertExtrinsicStmt: ReturnType<typeof db.prepare> | null = null;
let insertEventStmt: ReturnType<typeof db.prepare> | null = null;
let insertEpochStmt: ReturnType<typeof db.prepare> | null = null;

function getInsertBlockStmt() {
  if (!insertBlockStmt) {
    insertBlockStmt = db.prepare(`
      INSERT OR REPLACE INTO blocks (height, hash, parent_hash, state_root, extrinsics_root, timestamp, extrinsics_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
  }
  return insertBlockStmt;
}

function getInsertExtrinsicStmt() {
  if (!insertExtrinsicStmt) {
    insertExtrinsicStmt = db.prepare(`
      INSERT OR IGNORE INTO extrinsics (hash, block_height, block_hash, index_in_block, section, method, args, signer, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }
  return insertExtrinsicStmt;
}

function getInsertEventStmt() {
  if (!insertEventStmt) {
    insertEventStmt = db.prepare(`
      INSERT INTO events (block_height, block_hash, extrinsic_index, event_index, section, method, data, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }
  return insertEventStmt;
}

function getInsertEpochStmt() {
  if (!insertEpochStmt) {
    insertEpochStmt = db.prepare(`
      INSERT OR REPLACE INTO epoch_info (epoch, sidechain_slot, mainchain_epoch, mainchain_slot, next_epoch_timestamp, committee)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
  }
  return insertEpochStmt;
}

// Block operations
export function insertBlock(block: {
  height: number;
  hash: string;
  parent_hash: string;
  state_root?: string;
  extrinsics_root?: string;
  timestamp: number;
  extrinsics_count: number;
}): void {
  getInsertBlockStmt().run([
    block.height,
    block.hash,
    block.parent_hash,
    block.state_root || null,
    block.extrinsics_root || null,
    block.timestamp,
    block.extrinsics_count
  ]);
}

// Extrinsic operations
export function insertExtrinsic(ext: {
  hash: string;
  block_height: number;
  block_hash: string;
  index_in_block: number;
  section: string;
  method: string;
  args?: string;
  signer?: string;
  timestamp: number;
}): void {
  getInsertExtrinsicStmt().run([
    ext.hash,
    ext.block_height,
    ext.block_hash,
    ext.index_in_block,
    ext.section,
    ext.method,
    ext.args || null,
    ext.signer || null,
    ext.timestamp
  ]);
}

// Event operations
export function insertEvent(event: {
  block_height: number;
  block_hash: string;
  extrinsic_index?: number;
  event_index: number;
  section: string;
  method: string;
  data?: string;
  timestamp: number;
}): void {
  getInsertEventStmt().run([
    event.block_height,
    event.block_hash,
    event.extrinsic_index ?? null,
    event.event_index,
    event.section,
    event.method,
    event.data || null,
    event.timestamp
  ]);
}

// Epoch info operations
export function insertEpochInfo(info: {
  epoch: number;
  sidechain_slot: number;
  mainchain_epoch: number;
  mainchain_slot: number;
  next_epoch_timestamp: number;
  committee?: string;
}): void {
  getInsertEpochStmt().run([
    info.epoch,
    info.sidechain_slot,
    info.mainchain_epoch,
    info.mainchain_slot,
    info.next_epoch_timestamp,
    info.committee || null
  ]);
}

// State operations
export function getState(key: string): string | null {
  const row = db.prepare('SELECT value FROM state WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value || null;
}

export function setState(key: string, value: string): void {
  db.prepare('INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)').run(key, value);
}

// Query operations
export function getBlocks(limit = 50, offset = 0) {
  return db.prepare(`
    SELECT * FROM blocks ORDER BY height DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
}

export function getBlockByHeight(height: number) {
  return db.prepare('SELECT * FROM blocks WHERE height = ?').get(height);
}

export function getBlockByHash(hash: string) {
  return db.prepare('SELECT * FROM blocks WHERE hash = ?').get(hash);
}

export function getExtrinsicsByBlock(blockHeight: number) {
  return db.prepare(`
    SELECT * FROM extrinsics WHERE block_height = ? ORDER BY index_in_block
  `).all(blockHeight);
}

export function getExtrinsicByHash(hash: string) {
  return db.prepare('SELECT * FROM extrinsics WHERE hash = ?').get(hash);
}

export function getEventsByBlock(blockHeight: number) {
  return db.prepare(`
    SELECT * FROM events WHERE block_height = ? ORDER BY event_index
  `).all(blockHeight);
}

export function getRecentExtrinsics(limit = 50) {
  return db.prepare(`
    SELECT * FROM extrinsics ORDER BY block_height DESC, index_in_block DESC LIMIT ?
  `).all(limit);
}

export function getExtrinsicStats() {
  return db.prepare(`
    SELECT section, method, COUNT(*) as count
    FROM extrinsics
    GROUP BY section, method
    ORDER BY count DESC
    LIMIT 20
  `).all();
}

export function getLatestEpoch() {
  return db.prepare('SELECT * FROM epoch_info ORDER BY epoch DESC LIMIT 1').get();
}

export function getStats() {
  // Use MAX(rowid) as fast estimate instead of slow COUNT(*) on large tables
  const blocksCount = db.prepare('SELECT MAX(rowid) as count FROM blocks').get() as { count: number };
  const extrinsicsCount = db.prepare('SELECT MAX(rowid) as count FROM extrinsics').get() as { count: number };
  const eventsCount = db.prepare('SELECT MAX(rowid) as count FROM events').get() as { count: number };
  const latestBlock = db.prepare('SELECT MAX(height) as height, MAX(timestamp) as timestamp FROM blocks').get() as { height: number; timestamp: number };
  const oldestBlock = db.prepare('SELECT MIN(height) as height FROM blocks').get() as { height: number };

  // Transaction type breakdown
  const txTypes = db.prepare(`
    SELECT section, method, COUNT(*) as count
    FROM extrinsics
    GROUP BY section, method
    ORDER BY count DESC
  `).all() as { section: string; method: string; count: number }[];

  const midnightTxs = txTypes.find(t => t.section === 'midnight' && t.method === 'sendMnTransaction')?.count || 0;
  const bridgeOps = txTypes.find(t => t.section === 'cNightObservation' && t.method === 'processTokens')?.count || 0;
  const committeeOps = txTypes.find(t => t.section === 'sessionCommitteeManagement' && t.method === 'set')?.count || 0;

  return {
    blocks: blocksCount.count || 0,
    extrinsics: extrinsicsCount.count || 0,
    events: eventsCount.count || 0,
    latestBlock: latestBlock.height,
    latestTimestamp: latestBlock.timestamp,
    oldestBlock: oldestBlock.height,
    network: config.network.name,
    transactions: {
      total: midnightTxs,
      bridge: bridgeOps,
      committee: committeeOps,
    },
  };
}

export function getMidnightTransactions(limit = 100) {
  return db.prepare(`
    SELECT * FROM extrinsics
    WHERE section = 'midnight' AND method = 'sendMnTransaction'
    ORDER BY block_height DESC, index_in_block DESC
    LIMIT ?
  `).all(limit);
}

export function searchByHash(hash: string) {
  // Try block hash first
  const block = getBlockByHash(hash);
  if (block) return { type: 'block', data: block };

  // Try extrinsic hash
  const ext = getExtrinsicByHash(hash);
  if (ext) return { type: 'extrinsic', data: ext };

  return null;
}

// --- Analytics query functions ---

export function getMidnightTxsWithTimestamp(hours: number) {
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
  return db.prepare(`
    SELECT hash, args, timestamp, block_height, signer
    FROM extrinsics
    WHERE section = 'midnight' AND method = 'sendMnTransaction' AND timestamp >= ?
    ORDER BY timestamp ASC
  `).all(cutoff) as { hash: string; args: string; timestamp: number; block_height: number; signer: string }[];
}

export function getAllMidnightTxCount() {
  return (db.prepare("SELECT COUNT(*) as count FROM extrinsics WHERE section = 'midnight' AND method = 'sendMnTransaction'").get() as { count: number }).count;
}

export function getBridgeAnalytics(hours: number) {
  const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;
  const totalBridgeOps = (db.prepare("SELECT COUNT(*) as count FROM extrinsics WHERE section = 'cNightObservation' AND method = 'processTokens'").get() as { count: number }).count;
  const last24h = (db.prepare("SELECT COUNT(*) as count FROM extrinsics WHERE section = 'cNightObservation' AND method = 'processTokens' AND timestamp >= ?").get(cutoff) as { count: number }).count;

  const trend = db.prepare(`
    SELECT
      datetime((timestamp / 3600) * 3600, 'unixepoch') as hour,
      COUNT(*) as count
    FROM extrinsics
    WHERE section = 'cNightObservation' AND method = 'processTokens' AND timestamp >= ?
    GROUP BY (timestamp / 3600)
    ORDER BY hour
  `).all(cutoff) as { hour: string; count: number }[];

  const recentBridgeOps = db.prepare(`
    SELECT hash, block_height, timestamp, args
    FROM extrinsics
    WHERE section = 'cNightObservation' AND method = 'processTokens'
    ORDER BY block_height DESC, index_in_block DESC
    LIMIT 10
  `).all() as { hash: string; block_height: number; timestamp: number; args: string }[];

  return { totalBridgeOps, last24h, trend, recentBridgeOps };
}

export function getContractAnalytics() {
  const deployedContracts = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'midnight' AND e.method = 'ContractDeploy'
    ORDER BY e.block_height DESC
  `).all() as { block_height: number; data: string; timestamp: number }[];

  const contractCalls = db.prepare(`
    SELECT COUNT(*) as count FROM events WHERE section = 'midnight' AND method = 'ContractCall'
  `).get() as { count: number };

  const deploymentsPerDay = db.prepare(`
    SELECT date(timestamp, 'unixepoch') as day, COUNT(*) as count
    FROM extrinsics WHERE section = 'midnight' AND method = 'sendMnTransaction'
    GROUP BY day ORDER BY day DESC LIMIT 30
  `).all() as { day: string; count: number }[];

  const topContracts = deployedContracts.map(c => {
    let address = '', txHash = '';
    try {
      const outer = JSON.parse(c.data);
      const inner = typeof outer[0] === 'string' ? JSON.parse(outer[0]) : outer[0];
      address = inner.contractAddress || '';
      txHash = inner.txHash || '';
    } catch {}
    return { address, txHash, interactions: 0, firstSeen: c.timestamp, lastSeen: c.timestamp, block: c.block_height };
  });

  return { totalContracts: topContracts.length, totalCalls: contractCalls.count, topContracts, deploymentsPerDay };
}

export function getNetworkOverviewData() {
  const blocksCount = (db.prepare('SELECT COUNT(*) as count FROM blocks').get() as { count: number }).count;
  const extrinsicsCount = (db.prepare('SELECT COUNT(*) as count FROM extrinsics').get() as { count: number }).count;
  const midnightTxs = (db.prepare("SELECT COUNT(*) as count FROM extrinsics WHERE section = 'midnight' AND method = 'sendMnTransaction'").get() as { count: number }).count;
  const bridgeOps = (db.prepare("SELECT COUNT(*) as count FROM extrinsics WHERE section = 'cNightObservation' AND method = 'processTokens'").get() as { count: number }).count;
  const committeeUpdates = (db.prepare("SELECT COUNT(*) as count FROM extrinsics WHERE section = 'sessionCommitteeManagement' AND method = 'set'").get() as { count: number }).count;

  // Average block time from last 100 blocks
  const recentBlocks = db.prepare(`
    SELECT timestamp FROM blocks ORDER BY height DESC LIMIT 101
  `).all() as { timestamp: number }[];

  let avgBlockTime = 0;
  if (recentBlocks.length >= 2) {
    const timeDiff = recentBlocks[0].timestamp - recentBlocks[recentBlocks.length - 1].timestamp;
    avgBlockTime = Math.round((timeDiff / (recentBlocks.length - 1)) * 100) / 100;
  }

  // TPS from last hour
  const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
  const lastHourTxs = (db.prepare("SELECT COUNT(*) as count FROM extrinsics WHERE timestamp >= ?").get(oneHourAgo) as { count: number }).count;
  const tps = Math.round((lastHourTxs / 3600) * 1000) / 1000;

  const epoch = getLatestEpoch();

  // Event-based counts for overview
  const contractDeploys = (db.prepare("SELECT COUNT(*) as count FROM events WHERE section = 'midnight' AND method = 'ContractDeploy'").get() as { count: number }).count;
  const contractCalls = (db.prepare("SELECT COUNT(*) as count FROM events WHERE section = 'midnight' AND method = 'ContractCall'").get() as { count: number }).count;
  const eventBreakdown = getEventBreakdown();
  const committeeData = getCommitteeMembers();

  // Genesis time for network age
  const genesisBlock = db.prepare('SELECT timestamp FROM blocks ORDER BY height ASC LIMIT 1').get() as { timestamp?: number } | undefined;
  const genesisTime = genesisBlock?.timestamp || 0;
  const networkAgeDays = genesisTime ? Math.floor((Date.now() / 1000 - genesisTime) / 86400) : 0;

  return { blocksCount, extrinsicsCount, midnightTxs, bridgeOps, committeeUpdates, avgBlockTime, tps, epoch, contractDeploys, contractCalls, committeeSize: committeeData.size, eventBreakdown, genesisTime, networkAgeDays };
}

// --- Event-based analytics functions ---

export function getPrivacyFromEvents(hours?: number) {
  // Total applied midnight txs from events
  const totalTxApplied = (db.prepare("SELECT COUNT(*) as count FROM events WHERE section = 'midnight' AND method = 'TxApplied'").get() as { count: number }).count;

  // Count extrinsic indices that have UnshieldedTokens events (these are unshielded txs)
  const unshieldedTxCount = (db.prepare(`
    SELECT COUNT(DISTINCT block_height || '-' || extrinsic_index) as count
    FROM events
    WHERE section = 'midnight' AND method = 'UnshieldedTokens'
  `).get() as { count: number }).count;

  // Shielded = TxApplied that don't have a corresponding UnshieldedTokens event
  const shieldedTxCount = totalTxApplied - unshieldedTxCount;

  // Contract deploys and calls from events
  const contractDeploys = (db.prepare("SELECT COUNT(*) as count FROM events WHERE section = 'midnight' AND method = 'ContractDeploy'").get() as { count: number }).count;
  const contractCalls = (db.prepare("SELECT COUNT(*) as count FROM events WHERE section = 'midnight' AND method = 'ContractCall'").get() as { count: number }).count;

  const shieldedRatio = totalTxApplied > 0 ? Math.round((shieldedTxCount / totalTxApplied) * 10000) / 10000 : 0;

  // Get unshielded details
  const unshieldedDetails = db.prepare(`
    SELECT e.block_height as block, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'midnight' AND e.method = 'UnshieldedTokens'
    ORDER BY e.block_height DESC
    LIMIT 50
  `).all() as { block: number; data: string; timestamp: number }[];

  const parsedUnshieldedDetails = unshieldedDetails.map(row => {
    try {
      const parsed = JSON.parse(row.data);
      return {
        block: row.block,
        address: parsed.address || parsed[0] || null,
        tokenType: parsed.tokenType || parsed[1] || null,
        value: parsed.value || parsed[2] || null,
        timestamp: row.timestamp,
      };
    } catch {
      return { block: row.block, address: null, tokenType: null, value: null, timestamp: row.timestamp };
    }
  });

  // Trend: hourly breakdown from events (optionally filtered by hours)
  let trend: { hour: string; shielded: number; unshielded: number; total: number }[] = [];
  if (hours) {
    const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;

    // Get all TxApplied per hour
    const txAppliedPerHour = db.prepare(`
      SELECT datetime((timestamp / 3600) * 3600, 'unixepoch') as hour, COUNT(*) as count
      FROM events
      WHERE section = 'midnight' AND method = 'TxApplied' AND timestamp >= ?
      GROUP BY (timestamp / 3600)
      ORDER BY hour
    `).all(cutoff) as { hour: string; count: number }[];

    // Get UnshieldedTokens per hour (unique tx per block+extrinsic)
    const unshieldedPerHour = db.prepare(`
      SELECT datetime((timestamp / 3600) * 3600, 'unixepoch') as hour,
        COUNT(DISTINCT block_height || '-' || extrinsic_index) as count
      FROM events
      WHERE section = 'midnight' AND method = 'UnshieldedTokens' AND timestamp >= ?
      GROUP BY (timestamp / 3600)
      ORDER BY hour
    `).all(cutoff) as { hour: string; count: number }[];

    const unshieldedMap = new Map(unshieldedPerHour.map(r => [r.hour, r.count]));

    trend = txAppliedPerHour.map(row => {
      const unshielded = unshieldedMap.get(row.hour) || 0;
      return {
        hour: row.hour,
        total: row.count,
        unshielded,
        shielded: row.count - unshielded,
      };
    });
  }

  return {
    totalMidnightTxs: totalTxApplied,
    shielded: shieldedTxCount,
    unshielded: unshieldedTxCount,
    contractDeploys,
    contractCalls,
    shieldedRatio,
    unshieldedDetails: parsedUnshieldedDetails,
    trend,
  };
}

export function getCommitteeMembers() {
  const row = db.prepare(`
    SELECT args, block_height FROM extrinsics
    WHERE section = 'sessionCommitteeManagement' AND method = 'set'
    ORDER BY block_height DESC LIMIT 1
  `).get() as { args: string; block_height: number } | undefined;

  if (!row || !row.args) {
    return { epoch: 0, size: 0, members: [] };
  }

  try {
    const parsed = JSON.parse(row.args);
    // args is a JSON array: [membersArray, epoch]
    const membersRaw = Array.isArray(parsed) ? (typeof parsed[0] === 'string' ? JSON.parse(parsed[0]) : parsed[0]) : [];
    const epoch = Array.isArray(parsed) && parsed.length >= 2 ? parsed[1] : row.block_height;

    const members = (Array.isArray(membersRaw) ? membersRaw : []).map((m: any) => {
      if (m.permissioned) {
        return {
          pubKey: m.permissioned.id || null,
          auraKey: m.permissioned.keys?.aura || null,
          grandpaKey: m.permissioned.keys?.grandpa || null,
          type: 'permissioned',
        };
      }
      // Fallback for other formats
      return {
        pubKey: m.id || m.pubKey || null,
        auraKey: m.keys?.aura || null,
        grandpaKey: m.keys?.grandpa || null,
        type: 'unknown',
      };
    });

    return { epoch, size: members.length, members };
  } catch {
    return { epoch: 0, size: 0, members: [] };
  }
}

export function getContractAddresses() {
  const rows = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp, b.hash as block_hash
    FROM events e
    JOIN blocks b ON e.block_height = b.height
    WHERE e.section = 'midnight' AND e.method = 'ContractDeploy'
    ORDER BY e.block_height DESC
  `).all() as { block_height: number; data: string; timestamp: number; block_hash: string }[];

  const contracts = rows.map(row => {
    try {
      const parsed = JSON.parse(row.data);
      return {
        address: parsed.contractAddress || parsed[1] || null,
        txHash: parsed.txHash || parsed[0] || null,
        block: row.block_height,
        blockHash: row.block_hash,
        timestamp: row.timestamp,
      };
    } catch {
      return {
        address: null,
        txHash: null,
        block: row.block_height,
        blockHash: row.block_hash,
        timestamp: row.timestamp,
      };
    }
  });

  return { total: contracts.length, contracts };
}

export function getEventBreakdown() {
  return db.prepare(`
    SELECT section, method, COUNT(*) as count
    FROM events
    GROUP BY section, method
    ORDER BY count DESC
  `).all() as { section: string; method: string; count: number }[];
}

// --- Governance Dashboard ---

function parseEventData(data: string | null): any {
  if (!data) return null;
  try {
    const outer = JSON.parse(data);
    if (Array.isArray(outer) && outer.length > 0 && typeof outer[0] === 'string') {
      try { return JSON.parse(outer[0]); } catch { return outer; }
    }
    return outer;
  } catch { return data; }
}

export function getGovernanceData() {
  const councilProposals = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp, b.hash as block_hash
    FROM events e JOIN blocks b ON e.block_height = b.height
    WHERE e.section = 'council' AND e.method = 'Proposed'
    ORDER BY e.block_height DESC
  `).all() as { block_height: number; data: string; timestamp: number; block_hash: string }[];

  const councilVotes = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'council' AND e.method = 'Voted'
    ORDER BY e.block_height DESC
  `).all() as { block_height: number; data: string; timestamp: number }[];

  const tcProposals = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'technicalCommittee' AND e.method = 'Proposed'
    ORDER BY e.block_height DESC
  `).all() as { block_height: number; data: string; timestamp: number }[];

  const tcVotes = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'technicalCommittee' AND e.method = 'Voted'
    ORDER BY e.block_height DESC
  `).all() as { block_height: number; data: string; timestamp: number }[];

  const authorityResets = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'federatedAuthorityObservation'
    ORDER BY e.block_height DESC
  `).all() as { block_height: number; data: string; timestamp: number }[];

  const parsedCouncilProposals = councilProposals.map(r => ({ block_height: r.block_height, block_hash: r.block_hash, data: parseEventData(r.data), timestamp: r.timestamp }));
  const parsedCouncilVotes = councilVotes.map(r => ({ block_height: r.block_height, data: parseEventData(r.data), timestamp: r.timestamp }));
  const parsedTcProposals = tcProposals.map(r => ({ block_height: r.block_height, data: parseEventData(r.data), timestamp: r.timestamp }));
  const parsedTcVotes = tcVotes.map(r => ({ block_height: r.block_height, data: parseEventData(r.data), timestamp: r.timestamp }));
  const parsedResets = authorityResets.map(r => ({ block_height: r.block_height, data: parseEventData(r.data), timestamp: r.timestamp }));

  const totalActions = councilProposals.length + councilVotes.length + tcProposals.length + tcVotes.length + authorityResets.length;
  const allTimestamps = [
    ...councilProposals.map(r => r.timestamp),
    ...councilVotes.map(r => r.timestamp),
    ...tcProposals.map(r => r.timestamp),
    ...tcVotes.map(r => r.timestamp),
    ...authorityResets.map(r => r.timestamp),
  ];
  const lastActivity = allTimestamps.length > 0 ? Math.max(...allTimestamps) : 0;

  return {
    council: {
      proposals: parsedCouncilProposals,
      votes: parsedCouncilVotes,
      totalProposals: councilProposals.length,
      totalVotes: councilVotes.length,
    },
    technicalCommittee: {
      proposals: parsedTcProposals,
      votes: parsedTcVotes,
      totalProposals: tcProposals.length,
      totalVotes: tcVotes.length,
    },
    authorityResets: parsedResets,
    summary: {
      totalGovernanceActions: totalActions,
      lastActivity,
    },
  };
}

// --- Epoch Timeline ---

export function getEpochTimeline(limit = 50) {
  const epochHistory = db.prepare(`
    SELECT * FROM epoch_info ORDER BY epoch DESC LIMIT ?
  `).all(limit) as any[];

  const sessionChanges = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'session' AND e.method = 'NewSession'
    ORDER BY e.block_height DESC LIMIT ?
  `).all(limit) as { block_height: number; data: string; timestamp: number }[];

  const authorityChanges = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp
    FROM events e
    WHERE e.section = 'grandpa' AND e.method = 'NewAuthorities'
    ORDER BY e.block_height DESC LIMIT ?
  `).all(limit) as { block_height: number; data: string; timestamp: number }[];

  const currentEpoch = epochHistory.length > 0 ? epochHistory[0] : null;

  const parsedSessionChanges = sessionChanges.map(r => ({ block_height: r.block_height, data: parseEventData(r.data), timestamp: r.timestamp }));
  const parsedAuthorityChanges = authorityChanges.map(r => ({ block_height: r.block_height, data: parseEventData(r.data), timestamp: r.timestamp }));

  // Calculate average epoch duration from history
  let avgEpochDuration = 0;
  if (epochHistory.length >= 2) {
    const durations: number[] = [];
    for (let i = 0; i < epochHistory.length - 1; i++) {
      const diff = (epochHistory[i].next_epoch_timestamp || epochHistory[i].recorded_at) - (epochHistory[i + 1].next_epoch_timestamp || epochHistory[i + 1].recorded_at);
      if (diff > 0) durations.push(diff);
    }
    if (durations.length > 0) {
      avgEpochDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    }
  }

  return {
    currentEpoch,
    epochHistory,
    sessionChanges: parsedSessionChanges,
    authorityChanges: parsedAuthorityChanges,
    stats: {
      totalSessions: sessionChanges.length,
      totalAuthorityChanges: authorityChanges.length,
      avgEpochDuration,
    },
  };
}

// --- Cardano Anchors ---

export function getCardanoAnchors(limit = 50) {
  const anchors = db.prepare(`
    SELECT epoch, sidechain_slot, mainchain_epoch, mainchain_slot, next_epoch_timestamp, recorded_at
    FROM epoch_info
    ORDER BY epoch DESC
    LIMIT ?
  `).all(limit) as { epoch: number; sidechain_slot: number; mainchain_epoch: number; mainchain_slot: number; next_epoch_timestamp: number; recorded_at: number }[];

  const bridgeEvents = db.prepare(`
    SELECT e.block_height, e.data, e.timestamp, e.method
    FROM events e
    WHERE e.section = 'cNightObservation' AND e.method IN ('Registration', 'Deregistration', 'MappingAdded')
    ORDER BY e.block_height DESC
    LIMIT 20
  `).all() as { block_height: number; data: string; timestamp: number; method: string }[];

  const currentAnchor = anchors.length > 0 ? {
    midnightEpoch: anchors[0].epoch,
    midnightSlot: anchors[0].sidechain_slot,
    cardanoEpoch: anchors[0].mainchain_epoch,
    cardanoSlot: anchors[0].mainchain_slot,
    timestamp: anchors[0].next_epoch_timestamp || anchors[0].recorded_at,
  } : null;

  const registrations: any[] = [];
  const deregistrations: any[] = [];
  const mappings: any[] = [];

  for (const evt of bridgeEvents) {
    const parsed = { block_height: evt.block_height, data: parseEventData(evt.data), timestamp: evt.timestamp };
    if (evt.method === 'Registration') registrations.push(parsed);
    else if (evt.method === 'Deregistration') deregistrations.push(parsed);
    else if (evt.method === 'MappingAdded') mappings.push(parsed);
  }

  return {
    currentAnchor,
    anchorHistory: anchors,
    bridgeEvents: {
      registrations,
      deregistrations,
      mappings,
    },
    stats: {
      totalAnchors: anchors.length,
      totalRegistrations: registrations.length,
      totalDeregistrations: deregistrations.length,
      totalMappings: mappings.length,
    },
  };
}

// Address activity lookup
export function getAddressActivity(address: string, limit = 50) {
  // Transactions signed by this address
  const transactions = db.prepare(`
    SELECT * FROM extrinsics WHERE signer = ? ORDER BY block_height DESC LIMIT ?
  `).all(address, limit) as any[];

  // Events that reference this address in their data
  const events = db.prepare(`
    SELECT e.* FROM events e WHERE e.data LIKE '%' || ? || '%' ORDER BY e.block_height DESC LIMIT ?
  `).all(address, limit) as any[];

  const transactionCount = transactions.length;
  const allBlocks = [
    ...transactions.map((t: any) => t.block_height),
    ...events.map((e: any) => e.block_height),
  ].filter(Boolean);

  const firstSeen = allBlocks.length > 0 ? Math.min(...allBlocks) : null;
  const lastSeen = allBlocks.length > 0 ? Math.max(...allBlocks) : null;

  return {
    address,
    transactionCount,
    firstSeen,
    lastSeen,
    transactions,
    events,
  };
}
