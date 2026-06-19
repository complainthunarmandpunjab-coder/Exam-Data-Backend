const Redis = require('ioredis');
const logger = require('./logger');
const config = require('./environment');

let redisClient = null;
let isRedisEnabled = false;

// Fallback in-memory store if Redis is down or not configured
const memoryCache = new Map();

const memoryCacheMock = {
  get: async (key) => memoryCache.get(key) || null,
  set: async (key, value, expiryMode, time) => {
    memoryCache.set(key, value);
    if (expiryMode === 'EX' && time) {
      setTimeout(() => memoryCache.delete(key), time * 1000);
    }
    return 'OK';
  },
  del: async (key) => memoryCache.delete(key),
  keys: async (pattern) => {
    const regex = new RegExp('^' + pattern.replace('*', '.*') + '$');
    return Array.from(memoryCache.keys()).filter(k => regex.test(k));
  },
  ping: async () => 'PONG (In-Memory Fallback)'
};

try {
  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null
  });

  redisClient.on('connect', () => {
    logger.info('✓ Redis Client Connecting...');
  });

  redisClient.on('ready', () => {
    isRedisEnabled = true;
    logger.info('✓ Redis Cache Connected and Ready');
  });

  redisClient.on('error', (err) => {
    logger.warn(`⚠️ Redis Connection Failed: ${err.message}. Using In-Memory fallback cache.`);
    isRedisEnabled = false;
  });

  // Trigger lazy connection
  redisClient.connect().catch(() => {
    // Suppress unhandled promise rejection; event listener handles reporting
  });
} catch (e) {
  logger.warn(`⚠️ Failed to initialize Redis: ${e.message}. Using In-Memory fallback cache.`);
}

const getClient = () => {
  return isRedisEnabled ? redisClient : memoryCacheMock;
};

module.exports = {
  getClient,
  isRedisEnabled: () => isRedisEnabled
};
