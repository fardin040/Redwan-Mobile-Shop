// ============================================================
// services/redis.js — Redis client
// ============================================================
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableReadyCheck: false,
  enableOfflineQueue: false,
});

redis.on('connect', () => console.log('✅  Redis connected'));
redis.on('error', (err) => console.error('❌  Redis error:', err));

module.exports = redis;
