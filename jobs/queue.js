// jobs/queue.js
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
const connection = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL) : undefined;
export const jobs = new Queue('jobs', { connection });
