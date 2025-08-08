// backend/workers/badgeQueueWorker.js
import Queue from 'bull';
import { awardBadgeById } from '../controllers/badgeController.js';
import { logAuditAction } from '../utils/auditLogger.js';

const badgeQueue = new Queue('badge-award-queue');

badgeQueue.process(async (job, done) => {
  try {
    const { userId, badgeId } = job.data;
    await awardBadgeById(userId, badgeId);
    await logAuditAction({
      user: userId,
      action: `Auto-awarded badge ${badgeId}`,
      context: 'Badge System',
    });
    done();
  } catch (error) {
    console.error('Error processing badge queue:', error);
    done(error);
  }
});

export default badgeQueue;
