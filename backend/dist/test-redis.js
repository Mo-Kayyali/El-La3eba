"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = require("ioredis");
async function test() {
    const redis = new ioredis_1.Redis();
    await redis.set('key', '0');
    const t1 = async () => {
        await redis.watch('key');
        await new Promise(r => setTimeout(r, 10));
        const multi = redis.multi();
        multi.set('key', '1');
        const res = await multi.exec();
        console.log('T1 res:', res);
    };
    const t2 = async () => {
        await redis.watch('key');
        await new Promise(r => setTimeout(r, 10));
        const multi = redis.multi();
        multi.set('key', '2');
        const res = await multi.exec();
        console.log('T2 res:', res);
    };
    await Promise.all([t1(), t2()]);
    const final = await redis.get('key');
    console.log('Final:', final);
    redis.disconnect();
}
test();
//# sourceMappingURL=test-redis.js.map