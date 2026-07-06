import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  onModuleInit() {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.warn('REDIS_URL não definida — Redis desabilitado (mock em memória)');
      // Mock em memória para desenvolvimento sem Redis
      this.client = null as any;
      return;
    }
    this.client = new Redis(url, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      tls: url.startsWith('rediss://') ? {} : undefined,
    });
    this.client.on('error', (err) => this.logger.error('Redis error', err));
    this.client.on('connect', () => this.logger.log('Redis conectado'));
  }

  onModuleDestroy() {
    this.client?.quit();
  }

  /** SET NX com TTL — retorna true se a chave foi criada (não existia) */
  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    if (!this.client) return true; // sem Redis, sempre processa
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async incr(key: string): Promise<number> {
    if (!this.client) return 1;
    return this.client.incr(key);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    if (!this.client) return;
    await this.client.expire(key, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    await this.client.del(key);
  }
}
