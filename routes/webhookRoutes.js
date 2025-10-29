// routes/webhookRoutes.js
import crypto from 'node:crypto';
import { Router } from 'express';

const r = Router();
function verify(req) {
  const sig = req.headers['x-signature'] || '';
  const hmac = crypto.createHmac('sha256', process.env.SHARED_WEBHOOK_SECRET || 'dev');
  hmac.update(JSON.stringify(req.body || {}));
  const digest = 'sha256=' + hmac.digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig));
}

r.post('/ingest', (req, res) => {
  if (!verify(req)) return res.status(401).json({ success:false, message:'Bad signature' });
  // enqueue work here…
  res.json({ success:true });
});

export default r;
