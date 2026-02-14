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
  db,
} from '../indexer/database.js';
import config from '../config.js';

const app = express();

app.use(cors({ origin: config.api.corsOrigins }));
app.use(express.json());

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
  });
}

export default app;
