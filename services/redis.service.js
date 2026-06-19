const redis = require('../config/redis');
const logger = require('../config/logger');

class RedisService {
  constructor() {
    this.client = redis.getClient();
  }

  async get(key) {
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error(`Redis get error for key ${key}: ${err.message}`);
      return null;
    }
  }

  async set(key, value, expiryInSeconds = 300) {
    try {
      const stringified = JSON.stringify(value);
      await this.client.set(key, stringified, 'EX', expiryInSeconds);
      return true;
    } catch (err) {
      logger.error(`Redis set error for key ${key}: ${err.message}`);
      return false;
    }
  }

  async del(key) {
    try {
      await this.client.del(key);
      return true;
    } catch (err) {
      logger.error(`Redis del error for key ${key}: ${err.message}`);
      return false;
    }
  }

  async invalidatePrefix(prefix) {
    try {
      const keys = await this.client.keys(`${prefix}*`);
      if (keys.length > 0) {
        await Promise.all(keys.map(k => this.client.del(k)));
      }
      return true;
    } catch (err) {
      logger.error(`Redis invalidate prefix error for ${prefix}: ${err.message}`);
      return false;
    }
  }
}

module.exports = new RedisService();
