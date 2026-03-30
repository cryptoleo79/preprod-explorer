import { ApiPromise, WsProvider } from '@polkadot/api';
import {
  initDatabase,
  insertBlock,
  insertExtrinsic,
  insertEvent,
  insertEpochInfo,
  getState,
  setState,
  getStats,
  db,
} from './database.js';
import config from '../config.js';

let api: ApiPromise | null = null;
let isIndexing = false;
let isReconnecting = false;
let subscription: any = null;
let reconnectAttempts = 0;

export async function connectToChain(): Promise<ApiPromise> {
  console.log(`Connecting to ${config.network.rpcEndpoint}`);
  const provider = new WsProvider(config.network.rpcEndpoint);

  provider.on('disconnected', () => {
    console.log('WebSocket disconnected');
    scheduleReconnect();
  });

  provider.on('error', (err) => {
    console.log('WebSocket error:', err.message);
  });

  api = await ApiPromise.create({ provider, noInitWarn: true });
  console.log('Connected to RPC');
  reconnectAttempts = 0;

  // Log chain info and update config dynamically
  const chain = await api.rpc.system.chain();
  const version = await api.rpc.system.version();
  const genesisHash = api.genesisHash.toHex();
  console.log(`Chain: ${chain}, Version: ${version}`);

  config.network.genesisHash = genesisHash;
  config.node.version = version.toString();

  try {
    const runtime = await api.rpc.state.getRuntimeVersion();
    config.node.specVersion = runtime.specVersion.toNumber();
    config.node.transactionVersion = runtime.transactionVersion.toNumber();
  } catch {}

  return api;
}

function scheduleReconnect() {
  if (isReconnecting) return;

  isReconnecting = true;
  const delay = Math.min(
    config.indexer.reconnectDelay * Math.pow(2, Math.min(reconnectAttempts, 10)),
    config.indexer.maxReconnectDelay
  );
  reconnectAttempts++;

  console.log(`Scheduling reconnect in ${delay / 1000}s (attempt ${reconnectAttempts})...`);
  setTimeout(() => reconnect(), delay);
}

async function reconnect() {
  console.log('Reconnecting...');
  isReconnecting = false;
  try {
    if (api) {
      try {
        await api.disconnect();
      } catch {}
    }
    api = null;
    subscription = null;

    await startSubscription();
    reconnectAttempts = 0;

    await detectAndFillGaps();
  } catch (err: any) {
    console.log('Reconnect failed:', err.message);
    scheduleReconnect();
  }
}

export function findGaps(limit = 1000): { start: number; end: number }[] {
  const gaps: { start: number; end: number }[] = [];

  const rangeResult = db
    .prepare('SELECT MIN(height) as min_height, MAX(height) as max_height FROM blocks')
    .get() as { min_height: number; max_height: number } | undefined;

  if (!rangeResult || !rangeResult.max_height) {
    return gaps;
  }

  const { min_height, max_height } = rangeResult;

  const existingBlocks = db
    .prepare('SELECT height FROM blocks WHERE height >= ? AND height <= ? ORDER BY height ASC')
    .all(min_height, max_height) as { height: number }[];

  const heightSet = new Set(existingBlocks.map((b) => b.height));

  let gapStart: number | null = null;
  let gapsFound = 0;

  for (let h = min_height; h <= max_height && gapsFound < limit; h++) {
    if (!heightSet.has(h)) {
      if (gapStart === null) {
        gapStart = h;
      }
    } else {
      if (gapStart !== null) {
        gaps.push({ start: gapStart, end: h - 1 });
        gapsFound++;
        gapStart = null;
      }
    }
  }

  if (gapStart !== null) {
    gaps.push({ start: gapStart, end: max_height });
  }

  return gaps;
}

export async function backfillRange(apiInstance: ApiPromise, start: number, end: number): Promise<number> {
  let filled = 0;

  for (let height = start; height <= end; height++) {
    try {
      const count = await indexBlock(apiInstance, height);
      if (count > 0) filled++;
    } catch (e) {
      console.log(`Failed to backfill block ${height}`);
    }
  }

  return filled;
}

export async function detectAndFillGaps(): Promise<void> {
  if (!api) {
    console.log('No API connection for gap detection');
    return;
  }

  console.log('Checking for gaps in indexed blocks...');
  const gaps = findGaps(50);

  if (gaps.length === 0) {
    console.log('No gaps found');
    return;
  }

  const totalMissing = gaps.reduce((sum, g) => sum + (g.end - g.start + 1), 0);
  console.log(`Found ${gaps.length} gaps (${totalMissing} missing blocks)`);

  for (const gap of gaps) {
    const size = gap.end - gap.start + 1;
    console.log(`Filling gap: ${gap.start} - ${gap.end} (${size} blocks)`);

    const filled = await backfillRange(api, gap.start, gap.end);
    console.log(`Filled ${filled}/${size} blocks`);
  }

  console.log('Gap filling complete');
}

async function checkRecentGaps(apiInstance: ApiPromise): Promise<void> {
  const lastIndexed = getState('last_indexed_block');
  if (!lastIndexed) return;

  const lastIndexedNum = parseInt(lastIndexed);
  const header = await apiInstance.rpc.chain.getHeader();
  const currentBlock = header.number.toNumber();

  if (currentBlock > lastIndexedNum + 1) {
    const missed = currentBlock - lastIndexedNum - 1;
    console.log(`Detected ${missed} potentially missed blocks (${lastIndexedNum + 1} to ${currentBlock - 1})`);

    await backfillRange(apiInstance, lastIndexedNum + 1, currentBlock - 1);
  }
}

async function startSubscription() {
  const apiInstance = await connectToChain();

  await checkRecentGaps(apiInstance);

  console.log('Subscribing to new blocks...');
  subscription = await apiInstance.rpc.chain.subscribeNewHeads(async (header) => {
    const blockNum = header.number.toNumber();
    const extCount = await indexBlock(apiInstance, blockNum);
    setState('last_indexed_block', blockNum.toString());
    console.log(`Block ${blockNum.toLocaleString()} indexed (${extCount} extrinsics)`);
  });
}

export async function indexBlock(api: ApiPromise, blockNum: number): Promise<number> {
  try {
    const blockHash = await api.rpc.chain.getBlockHash(blockNum);
    const [block, events] = await Promise.all([
      api.rpc.chain.getBlock(blockHash),
      api.query.system.events.at(blockHash),
    ]);

    const header = block.block.header;
    const timestamp = await api.query.timestamp?.now?.at(blockHash);
    const ts = timestamp ? Math.floor(Number(timestamp) / 1000) : Math.floor(Date.now() / 1000);

    // Insert block
    insertBlock({
      height: blockNum,
      hash: blockHash.toString(),
      parent_hash: header.parentHash.toString(),
      state_root: header.stateRoot.toString(),
      extrinsics_root: header.extrinsicsRoot.toString(),
      timestamp: ts,
      extrinsics_count: block.block.extrinsics.length,
    });

    // Insert extrinsics
    let extCount = 0;
    for (let i = 0; i < block.block.extrinsics.length; i++) {
      const ext = block.block.extrinsics[i];
      let signer: string | undefined;

      try {
        if (ext.isSigned) {
          signer = ext.signer.toString();
        }
      } catch {}

      insertExtrinsic({
        hash: ext.hash.toString(),
        block_height: blockNum,
        block_hash: blockHash.toString(),
        index_in_block: i,
        section: ext.method.section,
        method: ext.method.method,
        args: JSON.stringify(ext.method.args?.map((a) => a.toString()) || []),
        signer,
        timestamp: ts,
      });
      extCount++;
    }

    // Insert events
    if (events && Array.isArray(events)) {
      for (let i = 0; i < events.length; i++) {
        const record = events[i];
        const { event, phase } = record;
        let extrinsicIndex: number | undefined;

        if (phase.isApplyExtrinsic) {
          extrinsicIndex = phase.asApplyExtrinsic.toNumber();
        }

        insertEvent({
          block_height: blockNum,
          block_hash: blockHash.toString(),
          extrinsic_index: extrinsicIndex,
          event_index: i,
          section: event.section,
          method: event.method,
          data: JSON.stringify(event.data.map((d) => d.toString())),
          timestamp: ts,
        });
      }
    }

    return extCount;
  } catch (e) {
    return 0;
  }
}

export async function fetchEpochInfo(apiInstance: ApiPromise): Promise<void> {
  try {
    const response = await fetch(config.network.httpEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'sidechain_getStatus', params: [] }),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json() as any;

    if (result?.result?.sidechain) {
      const sc = result.result.sidechain;
      const mc = result.result.mainchain;
      insertEpochInfo({
        epoch: sc.epoch,
        sidechain_slot: sc.slot,
        mainchain_epoch: mc?.epoch || 0,
        mainchain_slot: mc?.slot || 0,
        next_epoch_timestamp: sc.nextEpochTimestamp || 0,
      });
      console.log(`Recorded epoch info: Epoch ${sc.epoch}, Slot ${sc.slot}`);
    }
  } catch (e: any) {
    console.log('Epoch fetch failed:', e.message);
  }
}

export async function startIndexing() {
  if (isIndexing) {
    console.log('Already indexing');
    return;
  }

  isIndexing = true;
  initDatabase();

  const apiInstance = await connectToChain();
  const header = await apiInstance.rpc.chain.getHeader();
  const latestBlock = header.number.toNumber();

  console.log(`Latest block on chain: ${latestBlock.toLocaleString()}`);

  // Fetch epoch info
  await fetchEpochInfo(apiInstance);

  let startBlock: number;
  const savedBlock = getState('last_indexed_block');

  if (savedBlock) {
    startBlock = parseInt(savedBlock) + 1;
    console.log(`Resuming from block ${startBlock.toLocaleString()}`);
  } else if (config.indexer.startFromRecent) {
    startBlock = Math.max(1, latestBlock - 1000);
    console.log(`Starting from recent block ${startBlock.toLocaleString()}`);
  } else {
    startBlock = 1;
    console.log('Starting from genesis');
  }

  // Historical indexing
  if (startBlock < latestBlock - 10) {
    console.log(`Indexing blocks ${startBlock.toLocaleString()} to ${latestBlock.toLocaleString()}`);

    let currentBlock = startBlock;
    while (currentBlock <= latestBlock && isIndexing) {
      const batchEnd = Math.min(currentBlock + config.indexer.batchSize - 1, latestBlock);

      const promises: Promise<number>[] = [];
      for (let b = currentBlock; b <= batchEnd; b++) {
        promises.push(indexBlock(apiInstance, b));
      }

      await Promise.all(promises);
      setState('last_indexed_block', batchEnd.toString());

      const progress = (((batchEnd - startBlock) / (latestBlock - startBlock)) * 100).toFixed(1);
      console.log(`Block ${batchEnd.toLocaleString()} / ${latestBlock.toLocaleString()} (${progress}%)`);

      currentBlock = batchEnd + 1;

      // Update epoch info periodically
      if (currentBlock % 1000 === 0) {
        await fetchEpochInfo(apiInstance);
      }
    }
    console.log('Initial indexing complete!');
  }

  await startSubscription();

  // Periodically update epoch info
  setInterval(() => {
    if (api) fetchEpochInfo(api);
  }, 60000);
}

export function stopIndexing() {
  isIndexing = false;
  if (subscription) subscription();
  console.log('Stopping indexer...');
}

export { getStats };
