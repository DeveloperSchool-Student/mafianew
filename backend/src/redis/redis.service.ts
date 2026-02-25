import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    private redisClient: Redis;

    onModuleInit() {
        if (process.env.USE_MOCK_REDIS === 'true') {
            console.log('Using in-memory Redis Mock for local development.');
            this.redisClient = new RedisMock() as any;
        } else {
            this.redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        }

        this.redisClient.on('connect', () => {
            console.log('Connected to Redis successfully');
        });

        this.redisClient.on('error', (err) => {
            console.error('Redis connection error:', err);
        });
    }

    onModuleDestroy() {
        this.redisClient.quit();
    }

    getClient(): Redis {
        return this.redisClient;
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
            await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
        } else {
            await this.redisClient.set(key, serialized);
        }
    }

    async get<T>(key: string): Promise<T | null> {
        const data = await this.redisClient.get(key);
        if (!data) return null;
        try {
            return JSON.parse(data) as T;
        } catch {
            return null;
        }
    }

    async delete(key: string): Promise<void> {
        await this.redisClient.del(key);
    }
}
