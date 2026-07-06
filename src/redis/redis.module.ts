import { Module, Global } from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const url = process.env.REDIS_URL;
        if (!url) throw new Error('REDIS_URL não configurada.');
        const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
        client.on('error', (err) => console.error('[Redis]', err.message));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
