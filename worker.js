// worker.js  (optional separate Render worker)
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
const connection = process.env.REDIS_URL ? new IORedis(process.env.REDIS_URL) : undefined;

new Worker('jobs', async (job) => {
  // handle job.name cases
  console.log('Processing job', job.name, job.id);
}, { connection });
