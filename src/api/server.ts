import express from 'express';
import cors from 'cors';
import {
  getStats,
  getBlocks,
  getBlockByHeight,
  getBlockByHash,
  getExtrinsicsByBlock,
  getExtrinsicByHash,
  getEventsByBlock,
  getRecentExtrinsics,
  getExtrinsicStats,
  getLatestEpoch,
  searchByHash,
  getMidnightTransactions,
  getMidnightTxsWithTimestamp,
  getAllMidnightTxCount,
  getBridgeAnalytics,
  getContractAnalytics,
  getNetworkOverviewData,
  getPrivacyFromEvents,
  getCommitteeMembers,
  getContractAddresses,
  getEventBreakdown,
  getGovernanceData,
  getEpochTimeline,
  getCardanoAnchors,
  getAddressActivity,
  db,
} from '../indexer/database.js';
import config from '../config.js';
import { decodeMidnightTransaction, classifyMidnightTx } from '../midnight-decoder.js';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

// Rewrite non-API paths to /api/ prefix for nginx proxy compatibility
// Exclude paths that have their own non-prefixed route aliases
const aliasedPaths = ['/block/', '/blocks', '/extrinsics', '/extrinsic/', '/stats', '/search', '/analytics/volume', '/health', '/docs', '/block-producers', '/address/', '/tx-enriched/'];
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/') && req.path !== '/' && !req.path.match(/\.(js|css|html|ico|png|svg|woff)$/) && !aliasedPaths.some(p => req.path.startsWith(p))) {
    req.url = '/api' + req.url;
  }
  next();
});

// Root - Explorer UI
app.get('/', async (req, res) => {
  const stats = getStats();
  const blocks = getBlocks(10, 0);
  const epoch = getLatestEpoch() as any;

  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Midnight Preprod Explorer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0f; color: #e0e0e0; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #9d4edd; margin-bottom: 10px; }
    .subtitle { color: #888; margin-bottom: 30px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .stat { background: #1a1a2e; padding: 20px; border-radius: 10px; border: 1px solid #2a2a4e; }
    .stat-label { color: #888; font-size: 12px; text-transform: uppercase; }
    .stat-value { font-size: 24px; font-weight: bold; color: #9d4edd; margin-top: 5px; }
    .section { background: #1a1a2e; border-radius: 10px; padding: 20px; margin-bottom: 20px; border: 1px solid #2a2a4e; }
    .section h2 { color: #9d4edd; margin-bottom: 15px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #2a2a4e; }
    th { color: #888; font-size: 12px; text-transform: uppercase; }
    td { font-family: monospace; font-size: 13px; }
    .hash { color: #7b68ee; max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    a { color: #9d4edd; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .search { margin-bottom: 30px; display: flex; gap: 10px; }
    .search input { flex: 1; padding: 12px 15px; border: 1px solid #2a2a4e; border-radius: 8px; background: #1a1a2e; color: #e0e0e0; font-size: 14px; }
    .search button { padding: 12px 25px; background: #9d4edd; border: none; border-radius: 8px; color: white; cursor: pointer; font-weight: bold; }
    .search button:hover { background: #8b3ecc; }
    .epoch-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .epoch-item { background: #0a0a0f; padding: 10px; border-radius: 5px; }
    .epoch-label { font-size: 11px; color: #666; }
    .epoch-value { font-family: monospace; color: #7b68ee; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Midnight Preprod Explorer</h1>
    <p class="subtitle">Block explorer for Midnight Preprod Network</p>

    <div class="search">
      <input type="text" id="searchInput" placeholder="Search by block height or hash..." onkeypress="if(event.key==='Enter')search()">
      <button onclick="search()">Search</button>
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Blocks</div>
        <div class="stat-value">${stats.blocks.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Latest Block</div>
        <div class="stat-value">${stats.latestBlock?.toLocaleString() || 'N/A'}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Extrinsics</div>
        <div class="stat-value">${stats.extrinsics.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Events</div>
        <div class="stat-value">${stats.events.toLocaleString()}</div>
      </div>
    </div>

    ${epoch ? `
    <div class="section">
      <h2>Epoch Info</h2>
      <div class="epoch-info">
        <div class="epoch-item">
          <div class="epoch-label">Sidechain Epoch</div>
          <div class="epoch-value">${epoch.epoch?.toLocaleString() || 'N/A'}</div>
        </div>
        <div class="epoch-item">
          <div class="epoch-label">Sidechain Slot</div>
          <div class="epoch-value">${epoch.sidechain_slot?.toLocaleString() || 'N/A'}</div>
        </div>
        <div class="epoch-item">
          <div class="epoch-label">Mainchain Epoch</div>
          <div class="epoch-value">${epoch.mainchain_epoch || 'N/A'}</div>
        </div>
        <div class="epoch-item">
          <div class="epoch-label">Mainchain Slot</div>
          <div class="epoch-value">${epoch.mainchain_slot?.toLocaleString() || 'N/A'}</div>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="section">
      <h2>Recent Blocks</h2>
      <table>
        <tr>
          <th>Height</th>
          <th>Hash</th>
          <th>Extrinsics</th>
          <th>Time</th>
        </tr>
        ${(blocks as any[]).map(b => `
        <tr>
          <td><a href="/api/blocks/${b.height}">${b.height.toLocaleString()}</a></td>
          <td class="hash">${b.hash}</td>
          <td>${b.extrinsics_count}</td>
          <td>${new Date(b.timestamp * 1000).toLocaleString()}</td>
        </tr>
        `).join('')}
      </table>
    </div>

    <div class="section">
      <h2>Network Info</h2>
      <table>
        <tr><td>Network</td><td>${config.network.name}</td></tr>
        <tr><td>RPC Endpoint</td><td><code>${config.network.rpcEndpoint}</code></td></tr>
        <tr><td>Genesis Hash</td><td class="hash">${config.network.genesisHash}</td></tr>
        <tr><td>Node Version</td><td>${config.node.version}</td></tr>
        <tr><td>Ledger Version</td><td>${config.node.ledgerVersion}</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>API Endpoints</h2>
      <table>
        <tr><td><a href="/api/stats">/api/stats</a></td><td>Indexer statistics</td></tr>
        <tr><td><a href="/api/blocks">/api/blocks</a></td><td>List blocks</td></tr>
        <tr><td><a href="/api/extrinsics">/api/extrinsics</a></td><td>Recent extrinsics</td></tr>
        <tr><td><a href="/api/epoch">/api/epoch</a></td><td>Current epoch info</td></tr>
        <tr><td><a href="/api/network">/api/network</a></td><td>Network info</td></tr>
      </table>
    </div>
  </div>

  <script>
    function search() {
      const q = document.getElementById('searchInput').value.trim();
      if (q) window.location.href = '/api/search?q=' + encodeURIComponent(q);
    }
    setTimeout(() => location.reload(), 30000);
  </script>
</body>
</html>
  `);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), network: config.network.name });
});

// CoinGecko price proxy (IPv4 only - server has no IPv6 routing)
let priceCache: { data: any; ts: number } | null = null;
app.get('/api/price', async (req, res) => {
  try {
    const now = Date.now();
    if (priceCache && now - priceCache.ts < 60000) {
      return res.json(priceCache.data);
    }
    const qs = new URLSearchParams(req.query as Record<string, string>).toString();
    const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?${qs}`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json();
    priceCache = { data, ts: now };
    res.json(data);
  } catch (e: any) {
    if (priceCache) return res.json(priceCache.data);
    res.status(502).json({ error: 'Price fetch failed' });
  }
});

// Network info
app.get('/api/network', (req, res) => {
  res.json({
    name: config.network.name,
    rpcEndpoint: config.network.rpcEndpoint,
    genesisHash: config.network.genesisHash,
    chainType: config.network.chainType,
    node: config.node,
  });
});

// Stats (compatible with nightforge explorer)
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    const epoch = getLatestEpoch();
    res.json({
      ...stats,
      totalBlocks: stats.blocks,
      totalExtrinsics: stats.extrinsics,
      totalEvents: stats.events,
      epoch
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Alias for nightforge compatibility
app.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    const epoch = getLatestEpoch();
    res.json({
      ...stats,
      totalBlocks: stats.blocks,
      totalExtrinsics: stats.extrinsics,
      totalEvents: stats.events,
      epoch
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Blocks
app.get('/api/blocks', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const blocks = getBlocks(limit, offset);
    res.json(blocks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blocks/:heightOrHash', (req, res) => {
  try {
    const { heightOrHash } = req.params;
    let block;

    if (/^\d+$/.test(heightOrHash)) {
      block = getBlockByHeight(parseInt(heightOrHash));
    } else {
      block = getBlockByHash(heightOrHash);
    }

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json(block);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blocks/:height/extrinsics', (req, res) => {
  try {
    const height = parseInt(req.params.height);
    const extrinsics = getExtrinsicsByBlock(height);
    res.json(extrinsics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Single block with extrinsics (nightforge compatible)
app.get('/block/:height', (req, res) => {
  try {
    const height = parseInt(req.params.height);
    const block = getBlockByHeight(height) as any;
    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }
    const extrinsics = getExtrinsicsByBlock(height);
    res.json({ ...block, extrinsics });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Blocks list (nightforge compatible)
app.get('/blocks', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const blocks = getBlocks(limit, offset);
    res.json(blocks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Extrinsics list (nightforge compatible)
app.get('/extrinsics', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const extrinsics = getRecentExtrinsics(limit);
    res.json(extrinsics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Single extrinsic (nightforge compatible)
app.get('/extrinsic/:hash', (req, res) => {
  try {
    const ext = getExtrinsicByHash(req.params.hash);
    if (!ext) {
      return res.status(404).json({ error: 'Extrinsic not found' });
    }
    res.json(ext);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search (nightforge compatible)
app.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Check if it's a block height
    if (/^\d+$/.test(q)) {
      const block = getBlockByHeight(parseInt(q));
      if (block) {
        return res.json({ type: 'block', result: block });
      }
    }

    // Search by hash
    const result = searchByHash(q);
    if (result) {
      return res.json({ type: result.type, result: result.data });
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Analytics - transaction volume per hour (nightforge chart)
app.get('/analytics/volume', (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;

    const data = db
      .prepare(
        `
      SELECT
        datetime((timestamp / 3600) * 3600, 'unixepoch') as hour,
        COUNT(*) as count
      FROM extrinsics
      WHERE timestamp >= ?
      GROUP BY (timestamp / 3600)
      ORDER BY hour
    `
      )
      .all(cutoff);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/blocks/:height/events', (req, res) => {
  try {
    const height = parseInt(req.params.height);
    const events = getEventsByBlock(height);
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Extrinsics
app.get('/api/extrinsics', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const extrinsics = getRecentExtrinsics(limit);
    res.json(extrinsics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/extrinsics/:hash', (req, res) => {
  try {
    const ext = getExtrinsicByHash(req.params.hash);
    if (!ext) {
      return res.status(404).json({ error: 'Extrinsic not found' });
    }
    res.json(ext);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Decoded Midnight transaction
app.get('/api/extrinsics/:hash/decoded', (req, res) => {
  try {
    let hash = req.params.hash;
    hash = hash.startsWith('0x') ? hash : `0x${hash}`;
    const ext = getExtrinsicByHash(hash);
    if (!ext) return res.status(404).json({ error: 'Extrinsic not found' });
    if ((ext as any).section !== 'midnight') {
      return res.json({ ...ext, decoded: null, message: 'Not a Midnight transaction' });
    }
    const decoded = decodeMidnightTransaction((ext as any).args);
    res.json({ ...ext, decoded });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/extrinsics/stats', (req, res) => {
  try {
    const stats = getExtrinsicStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search
app.get('/api/search', (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Check if it's a block height
    if (/^\d+$/.test(q)) {
      const block = getBlockByHeight(parseInt(q));
      if (block) {
        return res.json({ type: 'block', data: block });
      }
    }

    // Search by hash
    const result = searchByHash(q);
    if (result) {
      return res.json(result);
    }

    res.status(404).json({ error: 'Not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Epoch info
app.get('/api/epoch', (req, res) => {
  try {
    const epoch = getLatestEpoch();
    if (!epoch) {
      return res.status(404).json({ error: 'No epoch data available' });
    }
    res.json(epoch);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Validators (from grandpa info)
app.get('/api/validators', (req, res) => {
  try {
    const validators = db.prepare('SELECT * FROM validators ORDER BY last_seen DESC').all();
    res.json(validators);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Extrinsic types distribution
app.get('/api/analytics/extrinsic-types', (req, res) => {
  try {
    const stats = db
      .prepare(
        `
      SELECT section, method, COUNT(*) as count
      FROM extrinsics
      GROUP BY section, method
      ORDER BY count DESC
      LIMIT 20
    `
      )
      .all();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Block production rate
app.get('/api/analytics/block-rate', (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const cutoff = Math.floor(Date.now() / 1000) - hours * 3600;

    const data = db
      .prepare(
        `
      SELECT
        (timestamp / 3600) * 3600 as hour,
        COUNT(*) as blocks,
        SUM(extrinsics_count) as extrinsics
      FROM blocks
      WHERE timestamp >= ?
      GROUP BY hour
      ORDER BY hour
    `
      )
      .all(cutoff);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Midnight transaction analytics - shielded/unshielded breakdown
app.get('/api/analytics/tx-classification', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);
    const txs = getMidnightTransactions(limit);

    let shielded = 0;
    let unshielded = 0;
    let mixed = 0;
    let unknown = 0;
    const txTypeBreakdown: Record<string, number> = {};

    for (const tx of txs as any[]) {
      const classified = classifyMidnightTx(tx.args);

      if (classified.shieldingType === 'shielded') shielded++;
      else if (classified.shieldingType === 'unshielded') unshielded++;
      else if (classified.shieldingType === 'mixed') mixed++;
      else unknown++;

      txTypeBreakdown[classified.txType] = (txTypeBreakdown[classified.txType] || 0) + 1;
    }

    res.json({
      analyzed: txs.length,
      shielding: { shielded, unshielded, mixed, unknown },
      types: txTypeBreakdown,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Recent midnight transactions with decoded info
app.get('/api/midnight-txs', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const txs = getMidnightTransactions(limit);

    const decoded = (txs as any[]).map(tx => {
      const classification = classifyMidnightTx(tx.args);
      return {
        hash: tx.hash,
        block_height: tx.block_height,
        timestamp: tx.timestamp,
        signer: tx.signer,
        shieldingType: classification.shieldingType,
        txType: classification.txType,
      };
    });

    res.json(decoded);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Privacy Dashboard API (event-based) ---
let privacyAnalyticsCache: { data: any; ts: number } | null = null;

app.get('/api/analytics/privacy', (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours as string) || 24, 168);
    const now = Date.now();

    // Return cached result if less than 60s old
    if (privacyAnalyticsCache && now - privacyAnalyticsCache.ts < 60000 && privacyAnalyticsCache.data._hours === hours) {
      return res.json(privacyAnalyticsCache.data);
    }

    const eventData = getPrivacyFromEvents(hours);

    const result = {
      totalMidnightTxs: eventData.totalMidnightTxs,
      shielded: eventData.shielded,
      unshielded: eventData.unshielded,
      contractDeploys: eventData.contractDeploys,
      contractCalls: eventData.contractCalls,
      shieldedRatio: eventData.shieldedRatio,
      unshieldedDetails: eventData.unshieldedDetails,
      trend: eventData.trend,
      _hours: hours,
    };

    privacyAnalyticsCache = { data: result, ts: now };
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Committee Members API ---
app.get('/api/committee', (req, res) => {
  try {
    const data = getCommitteeMembers();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Deployed Contracts API (event-based) ---
app.get('/api/contracts/deployed', (req, res) => {
  try {
    const data = getContractAddresses();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Event Breakdown API ---
app.get('/api/analytics/events', (req, res) => {
  try {
    const data = getEventBreakdown();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Bridge Monitor API ---
app.get('/api/analytics/bridge', (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours as string) || 24, 168);
    const data = getBridgeAnalytics(hours);

    const recentBridgeOps = data.recentBridgeOps.map(op => {
      let args_summary = '';
      try {
        const parsed = JSON.parse(op.args);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const cardanoInfo = JSON.parse(parsed[1]);
          args_summary = `Cardano block #${cardanoInfo.blockNumber || 'N/A'} (${cardanoInfo.blockHash ? cardanoInfo.blockHash.slice(0, 16) + '...' : 'N/A'})`;
        }
      } catch {}
      return {
        hash: op.hash,
        block_height: op.block_height,
        timestamp: op.timestamp,
        args_summary,
      };
    });

    res.json({
      totalBridgeOps: data.totalBridgeOps,
      last24h: data.last24h,
      trend: data.trend,
      recentBridgeOps,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Contract Leaderboard API ---
app.get('/api/analytics/contracts', (req, res) => {
  try {
    const data = getContractAnalytics();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Network Overview API ---
app.get('/api/analytics/overview', (req, res) => {
  try {
    const data = getNetworkOverviewData();

    // Get shielded ratio from events (much more reliable than hex decoding)
    let shieldedRatio = 0;
    try {
      const privacyData = getPrivacyFromEvents();
      shieldedRatio = privacyData.shieldedRatio;
    } catch {}

    res.json({
      network: config.network.name,
      blocks: data.blocksCount,
      extrinsics: data.extrinsicsCount,
      midnightTxs: data.midnightTxs,
      bridgeOps: data.bridgeOps,
      committeeUpdates: data.committeeUpdates,
      avgBlockTime: data.avgBlockTime,
      tps: data.tps,
      shieldedRatio,
      contractDeploys: data.contractDeploys,
      contractCalls: data.contractCalls,
      committeeSize: data.committeeSize,
      eventBreakdown: data.eventBreakdown,
      nodeVersion: config.node.version || 'unknown',
      specVersion: config.node.specVersion || 0,
      epoch: data.epoch || null,
      genesisTime: data.genesisTime || null,
      networkAgeDays: data.networkAgeDays || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Governance Dashboard API ---
app.get('/api/governance', (req, res) => {
  try {
    const data = getGovernanceData();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Epoch Timeline API ---
app.get('/api/epochs', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const data = getEpochTimeline(limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Cardano Anchors API ---
app.get('/api/cardano-anchors', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const data = getCardanoAnchors(limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Address Lookup API ---
app.get('/api/address/:address', (req, res) => {
  try {
    const { address } = req.params;
    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const data = getAddressActivity(address, limit);
    if (data.transactionCount === 0 && data.events.length === 0) {
      return res.status(404).json({ error: 'Address not found', address });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/address/:address', (req, res) => {
  try {
    const { address } = req.params;
    if (!address) {
      return res.status(400).json({ error: 'Address parameter is required' });
    }
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const data = getAddressActivity(address, limit);
    if (data.transactionCount === 0 && data.events.length === 0) {
      return res.status(404).json({ error: 'Address not found', address });
    }
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- DUST Fee Tracker API ---
app.get('/api/analytics/dust', (req, res) => {
  try {
    // Count dust-related events from our events table
    const dustEvents = db.prepare(`
      SELECT section, method, COUNT(*) as count
      FROM events
      WHERE section IN ('dust', 'dustSystem', 'midnightSystem')
         OR method LIKE '%dust%' OR method LIKE '%Dust%' OR method LIKE '%fee%' OR method LIKE '%Fee%'
      GROUP BY section, method
      ORDER BY count DESC
    `).all();

    // Get fee-related data from extrinsics
    // On Midnight, fees are paid in DUST which is tracked through events
    // Count transactions per hour to estimate DUST consumption
    const hourly = db.prepare(`
      SELECT
        datetime((timestamp / 3600) * 3600, 'unixepoch') as hour,
        COUNT(*) as txs
      FROM extrinsics
      WHERE timestamp >= ? AND section != 'timestamp'
      GROUP BY (timestamp / 3600)
      ORDER BY hour DESC
      LIMIT 48
    `).all(Math.floor(Date.now()/1000) - 172800);

    // Total non-timestamp extrinsics (each consumes DUST)
    const totalTxs = db.prepare(`
      SELECT COUNT(*) as count FROM extrinsics WHERE section != 'timestamp'
    `).get() as any;

    res.json({
      totalTransactions: totalTxs.count,
      dustEvents,
      hourlyActivity: hourly,
      note: "Each transaction on Midnight consumes DUST as a fee. DUST is generated from NIGHT tokens over time."
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Block Producers Leaderboard (queries official Midnight indexer) ---
let blockProducerCache: { data: any; ts: number } | null = null;

async function handleBlockProducers(req: any, res: any) {
  try {
    const now = Date.now();
    if (blockProducerCache && now - blockProducerCache.ts < 300000) {
      return res.json(blockProducerCache.data);
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 500, 2000);

    const response = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ block { height } }` }),
      signal: AbortSignal.timeout(10000),
    });
    const latestData = await response.json() as any;
    const latestHeight = latestData?.data?.block?.height || 0;

    const sampleHeights: number[] = [];
    for (let h = latestHeight; h > Math.max(0, latestHeight - limit) && sampleHeights.length < 100; h -= Math.max(1, Math.floor(limit / 100))) {
      sampleHeights.push(h);
    }

    const authors: Record<string, number> = {};
    const batchSize = 10;
    for (let i = 0; i < sampleHeights.length; i += batchSize) {
      const batch = sampleHeights.slice(i, i + batchSize);
      const queries = batch.map((h, idx) => `b${idx}: block(offset: { height: ${h} }) { height author }`).join('\n');
      const batchResp = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `{ ${queries} }` }),
        signal: AbortSignal.timeout(15000),
      });
      const batchData = await batchResp.json() as any;
      if (batchData?.data) {
        for (const key of Object.keys(batchData.data)) {
          const block = batchData.data[key];
          if (block?.author) {
            authors[block.author] = (authors[block.author] || 0) + 1;
          }
        }
      }
    }

    const producers = Object.entries(authors)
      .map(([pubkey, blocks]) => ({ pubkey, blocks, percentage: 0 }))
      .sort((a, b) => b.blocks - a.blocks);

    const totalSampled = producers.reduce((s, p) => s + p.blocks, 0);
    producers.forEach(p => {
      p.percentage = totalSampled > 0 ? Math.round((p.blocks / totalSampled) * 10000) / 100 : 0;
    });

    try {
      const committeeData = getCommitteeMembers();
      const auraMap: Record<string, { name: string; type: string }> = {};
      if (committeeData && committeeData.members) {
        committeeData.members.forEach((m: any, i: number) => {
          const aura = (m.auraKey || '').replace('0x', '');
          auraMap[aura] = { name: `Validator #${i + 1}`, type: m.type };
        });
      }
      producers.forEach((p: any) => {
        const match = auraMap[p.pubkey];
        if (match) { p.name = match.name; p.type = match.type; }
      });
    } catch {}

    const result = { totalBlocks: latestHeight, sampled: totalSampled, producers };
    blockProducerCache = { data: result, ts: now };
    res.json(result);
  } catch (error: any) {
    if (blockProducerCache) return res.json(blockProducerCache.data);
    res.status(500).json({ error: error.message });
  }
}

app.get('/api/block-producers', handleBlockProducers);
app.get('/block-producers', handleBlockProducers);

// --- Enriched Transaction Data from Official Indexer ---
async function handleTxEnriched(req: any, res: any) {
  try {
    const hash = req.params.hash.startsWith('0x') ? req.params.hash.slice(2) : req.params.hash;

    const resp = await fetch('https://indexer.preprod.midnight.network/api/v4/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ transactions(offset: { hash: "${hash}" }) { hash id protocolVersion contractActions { __typename address state } unshieldedCreatedOutputs { value } unshieldedSpentOutputs { value } zswapLedgerEvents { __typename } dustLedgerEvents { __typename } block { height author timestamp } } }`
      }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await resp.json() as any;

    const localTx = getExtrinsicByHash('0x' + hash) || getExtrinsicByHash(hash);

    let authorName: string | null = null;
    try {
      const enrichedTx = data?.data?.transactions?.[0];
      if (enrichedTx?.block?.author) {
        const committeeData = getCommitteeMembers();
        if (committeeData && committeeData.members) {
          committeeData.members.forEach((m: any, i: number) => {
            const aura = (m.auraKey || '').replace('0x', '');
            if (aura === enrichedTx.block.author) {
              authorName = `Validator #${i + 1}`;
            }
          });
        }
      }
    } catch {}

    res.json({ local: localTx, enriched: data?.data?.transactions?.[0] || null, authorName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

app.get('/api/tx-enriched/:hash', handleTxEnriched);
app.get('/tx-enriched/:hash', handleTxEnriched);

// --- API Documentation ---
function getDocsHTML(baseUrl: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NightForge API Documentation</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    code, pre, .mono { font-family: 'JetBrains Mono', monospace; }
    .sidebar::-webkit-scrollbar { width: 4px; }
    .sidebar::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
    pre { white-space: pre-wrap; word-break: break-all; }
    .copy-btn:active { transform: scale(0.95); }
  </style>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            midnight: { 50:'#fff7ed',100:'#ffedd5',200:'#fed7aa',300:'#fdba74',400:'#fb923c',500:'#ff6b35',600:'#ea580c',700:'#c2410c',800:'#9a3412',900:'#7c2d12' },
            dark: { 50:'#1e293b',100:'#1a1a2e',200:'#151525',300:'#0f0f1a',400:'#0a0a0f' }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-dark-400 text-gray-200 min-h-screen flex">
  <!-- Sidebar -->
  <aside class="sidebar w-64 bg-dark-300 border-r border-slate-800 fixed h-full overflow-y-auto hidden lg:block">
    <div class="p-5 border-b border-slate-800">
      <h1 class="text-xl font-bold text-midnight-500">NightForge API</h1>
      <p class="text-xs text-slate-500 mt-1">${baseUrl}</p>
    </div>
    <nav class="p-4 space-y-4 text-sm">
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Core</h3>
        <ul class="space-y-1">
          <li><a href="#health" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/health</a></li>
          <li><a href="#network" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/network</a></li>
          <li><a href="#stats" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/stats</a></li>
          <li><a href="#blocks" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/blocks</a></li>
          <li><a href="#block-detail" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/blocks/:id</a></li>
          <li><a href="#block-extrinsics" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/blocks/:h/extrinsics</a></li>
          <li><a href="#block-events" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/blocks/:h/events</a></li>
          <li><a href="#extrinsics" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/extrinsics</a></li>
          <li><a href="#extrinsic-detail" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/extrinsics/:hash</a></li>
          <li><a href="#extrinsic-decoded" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/extrinsics/:hash/decoded</a></li>
          <li><a href="#extrinsic-stats" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/extrinsics/stats</a></li>
          <li><a href="#search" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/search</a></li>
          <li><a href="#validators" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/validators</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Analytics</h3>
        <ul class="space-y-1">
          <li><a href="#overview" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/overview</a></li>
          <li><a href="#extrinsic-types" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/extrinsic-types</a></li>
          <li><a href="#block-rate" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/block-rate</a></li>
          <li><a href="#tx-classification" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/tx-classification</a></li>
          <li><a href="#events-breakdown" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/events</a></li>
          <li><a href="#volume" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/analytics/volume</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Privacy</h3>
        <ul class="space-y-1">
          <li><a href="#privacy" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/privacy</a></li>
          <li><a href="#midnight-txs" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/midnight-txs</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Bridge</h3>
        <ul class="space-y-1">
          <li><a href="#bridge" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/bridge</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Governance</h3>
        <ul class="space-y-1">
          <li><a href="#governance" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/governance</a></li>
          <li><a href="#committee" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/committee</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Epochs</h3>
        <ul class="space-y-1">
          <li><a href="#epoch" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/epoch</a></li>
          <li><a href="#epochs" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/epochs</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Cardano</h3>
        <ul class="space-y-1">
          <li><a href="#cardano-anchors" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/cardano-anchors</a></li>
        </ul>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-500 mb-2">Contracts</h3>
        <ul class="space-y-1">
          <li><a href="#contracts" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/analytics/contracts</a></li>
          <li><a href="#deployed" class="block px-2 py-1 rounded hover:bg-dark-100 text-slate-300 hover:text-white">/api/contracts/deployed</a></li>
        </ul>
      </div>
    </nav>
  </aside>

  <!-- Main content -->
  <main class="flex-1 lg:ml-64">
    <div class="max-w-4xl mx-auto p-6 lg:p-10">
      <header class="mb-10">
        <h1 class="text-3xl font-bold text-white mb-2">NightForge Explorer API</h1>
        <p class="text-slate-400 mb-4">Public REST API for the Midnight blockchain explorer. All endpoints return JSON unless otherwise noted.</p>
        <div class="flex items-center gap-3 text-sm">
          <span class="bg-dark-100 border border-slate-700 rounded px-3 py-1 mono text-midnight-400">${baseUrl}</span>
          <span class="bg-emerald-900/30 text-emerald-400 border border-emerald-800 rounded px-2 py-1 text-xs font-medium">CORS Enabled</span>
          <span class="bg-blue-900/30 text-blue-400 border border-blue-800 rounded px-2 py-1 text-xs font-medium">No Auth Required</span>
        </div>
      </header>

      <!-- CORE -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Core</h2>

        <div id="health" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/health</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/health')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/health" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Health check endpoint. Returns service status and current timestamp.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "status": "ok",
  "timestamp": "2026-03-31T12:00:00.000Z",
  "network": "Midnight Preprod"
}</code></pre>
        </div>

        <div id="network" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/network</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/network')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/network" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Network configuration and node details.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "name": "Midnight Preprod",
  "rpcEndpoint": "wss://...",
  "genesisHash": "0x...",
  "chainType": "Live",
  "node": { "version": "...", "specVersion": 1 },
  "cardanoNetwork": "preprod"
}</code></pre>
        </div>

        <div id="stats" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/stats</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/stats')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/stats" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Indexer statistics including total blocks, extrinsics, events, and current epoch.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "blocks": 150000, "extrinsics": 500000, "events": 1200000,
  "totalBlocks": 150000, "totalExtrinsics": 500000, "totalEvents": 1200000,
  "latestBlock": 150000,
  "epoch": { "epoch": 42, "sidechain_slot": 12345, "mainchain_epoch": 500 }
}</code></pre>
        </div>

        <div id="blocks" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/blocks</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/blocks?limit=10')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/blocks?limit=10" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Paginated list of blocks (newest first).</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">limit</code> (max 100, default 50), <code class="text-slate-400">offset</code> (default 0)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "height": 150000, "hash": "0xabc...", "parent_hash": "0xdef...",
    "extrinsics_count": 3, "events_count": 12, "timestamp": 1711882800 }
]</code></pre>
        </div>

        <div id="block-detail" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/blocks/:heightOrHash</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/blocks/1')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/blocks/1" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Get a single block by height (number) or hash (hex string).</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "height": 1, "hash": "0xabc...", "parent_hash": "0xdef...",
  "state_root": "0x...", "extrinsics_root": "0x...",
  "extrinsics_count": 1, "events_count": 5, "timestamp": 1711800000
}</code></pre>
        </div>

        <div id="block-extrinsics" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/blocks/:height/extrinsics</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/blocks/1/extrinsics')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/blocks/1/extrinsics" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">All extrinsics in a specific block.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "hash": "0x...", "block_height": 1, "index": 0, "section": "timestamp",
    "method": "set", "signer": null, "success": 1, "timestamp": 1711800000 }
]</code></pre>
        </div>

        <div id="block-events" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/blocks/:height/events</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/blocks/1/events')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/blocks/1/events" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">All events emitted in a specific block.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "block_height": 1, "index": 0, "section": "system",
    "method": "ExtrinsicSuccess", "data": "..." }
]</code></pre>
        </div>

        <div id="extrinsics" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/extrinsics</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/extrinsics?limit=10')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/extrinsics?limit=10" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Recent extrinsics across all blocks.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">limit</code> (max 100, default 50)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "hash": "0x...", "block_height": 150000, "section": "midnight",
    "method": "transact", "signer": "5G...", "success": 1 }
]</code></pre>
        </div>

        <div id="extrinsic-detail" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/extrinsics/:hash</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/extrinsics/0x...')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Get a single extrinsic by its hash.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "hash": "0x...", "block_height": 150000, "index": 1,
  "section": "midnight", "method": "transact",
  "signer": "5G...", "args": "0x...", "success": 1
}</code></pre>
        </div>

        <div id="extrinsic-decoded" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/extrinsics/:hash/decoded</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/extrinsics/0x.../decoded')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Get a Midnight extrinsic with decoded transaction details (shielding type, inputs, outputs).</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "hash": "0x...", "section": "midnight", "method": "transact",
  "decoded": { "txType": "transfer", "shieldingType": "shielded", "inputs": 2, "outputs": 2 }
}</code></pre>
        </div>

        <div id="extrinsic-stats" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/extrinsics/stats</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/extrinsics/stats')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/extrinsics/stats" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Extrinsic statistics: totals, success/fail counts.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "total": 500000, "successful": 498000, "failed": 2000
}</code></pre>
        </div>

        <div id="search" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/search?q=...</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/search?q=1')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/search?q=1" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Search by block height (number) or hash (block/extrinsic).</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">q</code> (required) - block height or hex hash</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{ "type": "block", "data": { "height": 1, "hash": "0x..." } }</code></pre>
        </div>

        <div id="validators" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/validators</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/validators')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/validators" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">List of known validators, sorted by last seen.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "address": "5G...", "last_seen": 1711882800, "blocks_produced": 500 }
]</code></pre>
        </div>
      </section>

      <!-- ANALYTICS -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Analytics</h2>

        <div id="overview" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/overview</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/overview')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/overview" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Comprehensive network overview: blocks, TPS, shielded ratio, committee size, epoch info, and more.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "network": "Midnight Preprod", "blocks": 150000, "extrinsics": 500000,
  "midnightTxs": 120000, "bridgeOps": 5000, "avgBlockTime": 6.2,
  "tps": 1.3, "shieldedRatio": 0.85, "contractDeploys": 45,
  "contractCalls": 80000, "committeeSize": 7
}</code></pre>
        </div>

        <div id="extrinsic-types" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/extrinsic-types</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/extrinsic-types')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/extrinsic-types" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Top 20 extrinsic types by frequency (section + method).</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "section": "midnight", "method": "transact", "count": 120000 },
  { "section": "timestamp", "method": "set", "count": 150000 }
]</code></pre>
        </div>

        <div id="block-rate" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/block-rate</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/block-rate?hours=24')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/block-rate?hours=24" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Hourly block production and extrinsic counts.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">hours</code> (default 24)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "hour": 1711882800, "blocks": 600, "extrinsics": 1800 }
]</code></pre>
        </div>

        <div id="tx-classification" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/tx-classification</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/tx-classification')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/tx-classification" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Classifies recent Midnight transactions as shielded/unshielded/mixed.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">limit</code> (max 2000, default 500)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "analyzed": 500,
  "shielding": { "shielded": 400, "unshielded": 50, "mixed": 30, "unknown": 20 },
  "types": { "transfer": 300, "contract_call": 150, "deploy": 50 }
}</code></pre>
        </div>

        <div id="events-breakdown" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/events</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/events')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/events" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Event type breakdown across all indexed blocks.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "section": "system", "method": "ExtrinsicSuccess", "count": 490000 },
  { "section": "midnight", "method": "Transacted", "count": 120000 }
]</code></pre>
        </div>

        <div id="volume" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/analytics/volume</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/analytics/volume?hours=24')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/analytics/volume?hours=24" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Hourly transaction volume.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">hours</code> (default 24)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "hour": "2026-03-31 12:00:00", "count": 150 }
]</code></pre>
        </div>
      </section>

      <!-- PRIVACY -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Privacy</h2>

        <div id="privacy" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/privacy</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/privacy?hours=24')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/privacy?hours=24" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Privacy dashboard: shielded/unshielded ratios, contract deploys/calls, and trends (event-based).</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">hours</code> (max 168, default 24). Cached for 60s.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "totalMidnightTxs": 500, "shielded": 400, "unshielded": 80,
  "contractDeploys": 5, "contractCalls": 120,
  "shieldedRatio": 0.83, "trend": [...]
}</code></pre>
        </div>

        <div id="midnight-txs" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/midnight-txs</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/midnight-txs?limit=10')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/midnight-txs?limit=10" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Recent Midnight-specific transactions with decoded shielding info.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">limit</code> (max 100, default 20)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "hash": "0x...", "block_height": 150000, "timestamp": 1711882800,
    "signer": "5G...", "shieldingType": "shielded", "txType": "transfer" }
]</code></pre>
        </div>
      </section>

      <!-- BRIDGE -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Bridge</h2>

        <div id="bridge" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/bridge</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/bridge?hours=24')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/bridge?hours=24" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Cardano bridge operations: totals, trends, and recent bridge transactions.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">hours</code> (max 168, default 24)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "totalBridgeOps": 5000, "last24h": 120, "trend": [...],
  "recentBridgeOps": [
    { "hash": "0x...", "block_height": 149990, "timestamp": 1711882000,
      "args_summary": "Cardano block #12345 (0xabc...)" }
  ]
}</code></pre>
        </div>
      </section>

      <!-- GOVERNANCE -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Governance</h2>

        <div id="governance" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/governance</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/governance')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/governance" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Governance dashboard: committee updates, proposals, and voting data.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "committeeUpdates": [...],
  "recentGovernanceEvents": [...]
}</code></pre>
        </div>

        <div id="committee" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/committee</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/committee')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/committee" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Current committee members and their status.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "address": "5G...", "role": "member", "since_epoch": 10 }
]</code></pre>
        </div>
      </section>

      <!-- EPOCHS -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Epochs</h2>

        <div id="epoch" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/epoch</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/epoch')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/epoch" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Current epoch information: sidechain epoch/slot, mainchain epoch/slot.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "epoch": 42, "sidechain_slot": 12345,
  "mainchain_epoch": 500, "mainchain_slot": 130000000
}</code></pre>
        </div>

        <div id="epochs" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/epochs</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/epochs?limit=20')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/epochs?limit=20" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Epoch timeline: historical epoch data.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">limit</code> (max 200, default 50)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "epoch": 42, "sidechain_slot": 12345, "mainchain_epoch": 500,
    "block_height": 149000, "timestamp": 1711880000 }
]</code></pre>
        </div>
      </section>

      <!-- CARDANO -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Cardano</h2>

        <div id="cardano-anchors" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/cardano-anchors</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/cardano-anchors?limit=20')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/cardano-anchors?limit=20" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-1">Cardano anchor points: sidechain state anchored to Cardano.</p>
          <p class="text-xs text-slate-500 mb-3">Params: <code class="text-slate-400">limit</code> (max 200, default 50)</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "block_height": 149500, "mainchain_block": 12345678,
    "mainchain_hash": "0x...", "timestamp": 1711881000 }
]</code></pre>
        </div>
      </section>

      <!-- CONTRACTS -->
      <section class="mb-12">
        <h2 class="text-xl font-semibold text-midnight-400 border-b border-slate-800 pb-2 mb-6">Contracts</h2>

        <div id="contracts" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/analytics/contracts</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/analytics/contracts')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/analytics/contracts" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">Contract leaderboard: most active contracts by call count.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>{
  "contracts": [
    { "address": "0x...", "calls": 5000, "deploys": 1, "last_call": 1711882800 }
  ]
}</code></pre>
        </div>

        <div id="deployed" class="mb-8 bg-dark-200 rounded-lg border border-slate-800 p-5">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <span class="bg-emerald-700 text-white text-xs font-bold px-2 py-0.5 rounded">GET</span>
              <code class="text-white">/api/contracts/deployed</code>
            </div>
            <div class="flex gap-2">
              <button onclick="copyUrl('/api/contracts/deployed')" class="copy-btn text-xs bg-dark-100 hover:bg-slate-700 text-slate-400 px-2 py-1 rounded">Copy URL</button>
              <a href="${baseUrl}/api/contracts/deployed" target="_blank" class="text-xs bg-midnight-500/20 hover:bg-midnight-500/30 text-midnight-400 px-2 py-1 rounded">Try it</a>
            </div>
          </div>
          <p class="text-sm text-slate-400 mb-3">All deployed contract addresses discovered from on-chain events.</p>
          <pre class="bg-dark-400 rounded p-3 text-xs text-slate-300 overflow-x-auto"><code>[
  { "address": "0x...", "deployed_at_block": 50000, "deployer": "5G..." }
]</code></pre>
        </div>
      </section>

      <footer class="border-t border-slate-800 pt-6 text-sm text-slate-500 text-center">
        <p>NightForge Explorer &mdash; Built for the Midnight community</p>
        <p class="mt-1">All endpoints are public and rate-limited. Please be respectful.</p>
      </footer>
    </div>
  </main>

  <script>
    function copyUrl(path) {
      const url = '${baseUrl}' + path;
      navigator.clipboard.writeText(url).then(() => {
        const btn = event.target;
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('text-emerald-400');
        setTimeout(() => { btn.textContent = orig; btn.classList.remove('text-emerald-400'); }, 1500);
      });
    }

    // Smooth scroll for sidebar links
    document.querySelectorAll('aside a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Highlight active section in sidebar
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          document.querySelectorAll('aside a').forEach(a => a.classList.remove('bg-dark-100', 'text-white'));
          const link = document.querySelector('aside a[href="#' + entry.target.id + '"]');
          if (link) { link.classList.add('bg-dark-100', 'text-white'); }
        }
      });
    }, { rootMargin: '-20% 0px -70% 0px' });

    document.querySelectorAll('[id]').forEach(el => {
      if (el.closest('main')) observer.observe(el);
    });
  </script>
</body>
</html>`;
}

app.get('/api/docs', (req, res) => {
  res.type('html').send(getDocsHTML('https://preprod.nightforge.jp'));
});

app.get('/docs', (req, res) => {
  res.type('html').send(getDocsHTML('https://preprod.nightforge.jp'));
});

export function startAPI() {
  app.listen(config.api.port, () => {
    console.log(`API server running on http://localhost:${config.api.port}`);
    console.log('Endpoints:');
    console.log(`  GET /health - Health check`);
    console.log(`  GET /api/network - Network info`);
    console.log(`  GET /api/stats - Indexer statistics`);
    console.log(`  GET /api/blocks - List blocks`);
    console.log(`  GET /api/blocks/:heightOrHash - Get block`);
    console.log(`  GET /api/blocks/:height/extrinsics - Block extrinsics`);
    console.log(`  GET /api/blocks/:height/events - Block events`);
    console.log(`  GET /api/extrinsics - Recent extrinsics`);
    console.log(`  GET /api/extrinsics/:hash - Get extrinsic`);
    console.log(`  GET /api/search?q=... - Search by hash or height`);
    console.log(`  GET /api/epoch - Current epoch info`);
    console.log(`  GET /api/analytics/extrinsic-types - Extrinsic distribution`);
    console.log(`  GET /api/analytics/block-rate - Block production rate`);
    console.log(`  GET /api/analytics/privacy - Privacy dashboard (event-based)`);
    console.log(`  GET /api/analytics/bridge - Bridge monitor`);
    console.log(`  GET /api/analytics/contracts - Contract leaderboard`);
    console.log(`  GET /api/analytics/overview - Network overview`);
    console.log(`  GET /api/analytics/events - Event type breakdown`);
    console.log(`  GET /api/committee - Current committee members`);
    console.log(`  GET /api/contracts/deployed - Deployed contracts (event-based)`);
    console.log(`  GET /api/governance - Governance dashboard`);
    console.log(`  GET /api/epochs - Epoch timeline`);
    console.log(`  GET /api/cardano-anchors - Cardano anchor points`);
  });
}

export default app;
