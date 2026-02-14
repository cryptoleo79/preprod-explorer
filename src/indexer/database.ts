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
  const blocksCount = db.prepare('SELECT COUNT(*) as count FROM blocks').get() as { count: number };
  const extrinsicsCount = db.prepare('SELECT COUNT(*) as count FROM extrinsics').get() as { count: number };
  const eventsCount = db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
  const latestBlock = db.prepare('SELECT MAX(height) as height, MAX(timestamp) as timestamp FROM blocks').get() as { height: number; timestamp: number };
  const oldestBlock = db.prepare('SELECT MIN(height) as height FROM blocks').get() as { height: number };

  return {
    blocks: blocksCount.count,
    extrinsics: extrinsicsCount.count,
    events: eventsCount.count,
    latestBlock: latestBlock.height,
    latestTimestamp: latestBlock.timestamp,
    oldestBlock: oldestBlock.height,
    network: config.network.name,
  };
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
