import { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
export declare class RedisService extends Redis implements OnModuleDestroy {
    constructor();
    onModuleDestroy(): void;
}
