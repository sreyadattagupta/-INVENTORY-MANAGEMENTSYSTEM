/**
 * RATE LIMITER - PORT 2100
 * Database: Redis (In-Memory Key-Value Store)
 * Strategy: Fixed Window Counter (5 requests per minute per IP)
 *
 * WHY REDIS?
 * Redis is an in-memory key-value store ideal for rate limiting because:
 * 1. Sub-millisecond reads/writes — rate check adds near-zero latency
 * 2. Atomic INCR operation prevents race conditions in concurrent requests
 * 3. Native TTL (time-to-live) auto-expires counters — no cleanup needed
 * 4. Horizontal scalability — all app instances share one Redis counter
 */

const express = require('express');
const app = express();
app.use(express.json());

// ─────────────────────────────────────────────
// SIMULATED REDIS STORE (in-memory for demo)
// In production: replace with `ioredis` or `redis` npm package
// const Redis = require('ioredis');
// const redis = new Redis({ host: 'localhost', port: 6379 });
// ─────────────────────────────────────────────

const redisStore = new Map(); // { key -> { count, expiresAt } }

const RATE_LIMIT = 5;         // max requests
const WINDOW_MS  = 60 * 1000; // 1 minute window

/**
 * Simulates Redis INCR + EXPIRE behavior
 * Atomically increments counter; sets TTL on first call
 */
function redisIncr(key) {
  const now = Date.now();
  let entry = redisStore.get(key);

  if (!entry || now > entry.expiresAt) {
    // Key doesn't exist or has expired — create fresh window
    entry = { count: 1, expiresAt: now + WINDOW_MS };
    redisStore.set(key, entry);
    return { count: 1, ttl: WINDOW_MS };
  }

  entry.count += 1;
  return { count: entry.count, ttl: entry.expiresAt - now };
}

function redisGet(key) {
  const now = Date.now();
  const entry = redisStore.get(key);
  if (!entry || now > entry.expiresAt) return null;
  return entry;
}

// ─── RATE LIMITER MIDDLEWARE ───────────────────────────────────────────────
function rateLimiter(req, res, next) {
  const clientIP  = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const redisKey  = `rate_limit:${clientIP}`;

  const { count, ttl } = redisIncr(redisKey);
  const remaining       = Math.max(0, RATE_LIMIT - count);
  const resetSeconds    = Math.ceil(ttl / 1000);

  // Standard rate-limit response headers
  res.setHeader('X-RateLimit-Limit',     RATE_LIMIT);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset',     resetSeconds);

  if (count > RATE_LIMIT) {
    return res.status(429).json({
      error:    'Too Many Requests',
      message:  `Rate limit of ${RATE_LIMIT} req/min exceeded.`,
      retryAfterSeconds: resetSeconds,
      db:       'Redis (Key-Value Store)',
      key:      redisKey,
    });
  }

  next();
}

// ─── ROUTES ────────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    service:    'Rate Limiter — Redis-backed',
    port:        2100,
    rateLimit:  `${RATE_LIMIT} requests / minute`,
    database:   'Redis (in-memory key-value)',
    endpoints: [
      'GET  /ping         — rate-limited test endpoint',
      'GET  /status       — view your current rate-limit state',
      'POST /reset        — reset your counter (admin)',
      'GET  /store        — inspect full Redis store (admin)',
    ],
  });
});

// Rate-limited endpoint
app.get('/ping', rateLimiter, (req, res) => {
  const clientIP = req.ip || '127.0.0.1';
  const entry    = redisGet(`rate_limit:${clientIP}`);

  res.json({
    message:   'pong 🏓',
    used:      entry ? entry.count : 1,
    remaining: parseInt(res.getHeader('X-RateLimit-Remaining')),
    resetIn:   `${res.getHeader('X-RateLimit-Reset')}s`,
    db:        'Redis INCR + TTL',
  });
});

// Show current window status for caller's IP
app.get('/status', (req, res) => {
  const clientIP = req.ip || '127.0.0.1';
  const key      = `rate_limit:${clientIP}`;
  const entry    = redisGet(key);

  if (!entry) {
    return res.json({ ip: clientIP, used: 0, remaining: RATE_LIMIT, status: 'No active window' });
  }

  res.json({
    ip:        clientIP,
    redisKey:  key,
    used:      entry.count,
    remaining: Math.max(0, RATE_LIMIT - entry.count),
    limit:     RATE_LIMIT,
    resetsIn:  `${Math.ceil((entry.expiresAt - Date.now()) / 1000)}s`,
    db:        'Redis',
  });
});

// Admin: reset a specific IP or your own
app.post('/reset', (req, res) => {
  const { ip } = req.body;
  const target  = ip || req.ip || '127.0.0.1';
  const key     = `rate_limit:${target}`;
  const existed = redisStore.has(key);
  redisStore.delete(key);
  res.json({ message: existed ? `Counter reset for ${target}` : `No active counter for ${target}`, key });
});

// Admin: view entire Redis store
app.get('/store', (req, res) => {
  const now  = Date.now();
  const dump = {};
  for (const [k, v] of redisStore.entries()) {
    dump[k] = {
      count:    v.count,
      expiresIn: `${Math.ceil((v.expiresAt - now) / 1000)}s`,
    };
  }
  res.json({ store: dump, engine: 'Redis (simulated)', totalKeys: Object.keys(dump).length });
});

// ─── START ─────────────────────────────────────────────────────────────────
const PORT = 2100;
app.listen(PORT, () => {
  console.log(`\n🔴 Redis Rate Limiter running on http://localhost:${PORT}`);
  console.log(`   Limit  : ${RATE_LIMIT} requests / minute`);
  console.log(`   DB     : Redis (in-memory key-value store)\n`);
});
