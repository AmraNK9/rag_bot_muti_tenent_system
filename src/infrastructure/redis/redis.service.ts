import { createClient, RedisClientType } from 'redis';

export class RedisService {
  private static instance: RedisService;
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public async connect(): Promise<void> {
    if (this.client) return;

    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    
    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[Redis] Max retries reached. Stopping reconnection.');
            return new Error('Max retries reached');
          }
          // Exponential backoff
          return Math.min(retries * 100, 3000);
        }
      }
    });

    this.client.on('error', (err) => {
      console.warn('[Redis] Client Error:', err.message);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      console.log(`[Redis] Connected successfully to ${redisUrl}`);
      this.isConnected = true;
    });

    try {
      await this.client.connect();
    } catch (err) {
      console.warn('[Redis] Initial connection failed. Will gracefully fallback to DB.');
    }
  }

  public getClient(): RedisClientType | null {
    if (this.isConnected && this.client) {
      return this.client;
    }
    return null;
  }

  // Helper method for getting cached value safely
  public async get(key: string): Promise<string | null> {
    try {
      const client = this.getClient();
      if (!client) return null;
      return await client.get(key);
    } catch (err) {
      console.warn(`[Redis] Failed to get key ${key}:`, err);
      return null;
    }
  }

  // Helper method for setting cached value safely
  public async set(key: string, value: string, options?: { EX?: number }): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) return;
      
      if (options && options.EX) {
        await client.set(key, value, { EX: options.EX });
      } else {
        await client.set(key, value);
      }
    } catch (err) {
      console.warn(`[Redis] Failed to set key ${key}:`, err);
    }
  }

  // Helper method for deleting cached value (Cache Invalidation)
  public async del(key: string): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) return;
      await client.del(key);
    } catch (err) {
      console.warn(`[Redis] Failed to del key ${key}:`, err);
    }
  }

  // List operations for Chat Memory
  public async rPush(key: string, value: string): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) return;
      await client.rPush(key, value);
    } catch (err) {
      console.warn(`[Redis] Failed to rPush key ${key}:`, err);
    }
  }

  public async lRange(key: string, start: number, end: number): Promise<string[]> {
    try {
      const client = this.getClient();
      if (!client) return [];
      return await client.lRange(key, start, end);
    } catch (err) {
      console.warn(`[Redis] Failed to lRange key ${key}:`, err);
      return [];
    }
  }

  public async lTrim(key: string, start: number, end: number): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) return;
      await client.lTrim(key, start, end);
    } catch (err) {
      console.warn(`[Redis] Failed to lTrim key ${key}:`, err);
    }
  }

  public async expire(key: string, seconds: number): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) return;
      await client.expire(key, seconds);
    } catch (err) {
      console.warn(`[Redis] Failed to expire key ${key}:`, err);
    }
  }

  // Set operations for Dirty Tracking
  public async sAdd(key: string, member: string): Promise<void> {
    try {
      const client = this.getClient();
      if (!client) return;
      await client.sAdd(key, member);
    } catch (err) {
      console.warn(`[Redis] Failed to sAdd to key ${key}:`, err);
    }
  }

  public async sMembers(key: string): Promise<string[]> {
    try {
      const client = this.getClient();
      if (!client) return [];
      return await client.sMembers(key);
    } catch (err) {
      console.warn(`[Redis] Failed to sMembers key ${key}:`, err);
      return [];
    }
  }

  // Hash operations for tracking amounts
  public async hIncrBy(key: string, field: string, increment: number): Promise<number | null> {
    try {
      const client = this.getClient();
      if (!client) return null;
      return await client.hIncrBy(key, field, increment);
    } catch (err) {
      console.warn(`[Redis] Failed to hIncrBy key ${key}:`, err);
      return null;
    }
  }

  public async hGetAll(key: string): Promise<Record<string, string>> {
    try {
      const client = this.getClient();
      if (!client) return {};
      return await client.hGetAll(key);
    } catch (err) {
      console.warn(`[Redis] Failed to hGetAll key ${key}:`, err);
      return {};
    }
  }

  // Single value decrement
  public async decr(key: string): Promise<number | null> {
    try {
      const client = this.getClient();
      if (!client) return null;
      return await client.decr(key);
    } catch (err) {
      console.warn(`[Redis] Failed to decr key ${key}:`, err);
      return null;
    }
  }
}

export const redisService = RedisService.getInstance();
