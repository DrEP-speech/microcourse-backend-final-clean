// routes/pdfRoutes.js
import express from 'express';
const router = express.Router();

router.post('/generate', (req, res) => {
  res.send('POST generate PDF (future)');
});

export default router;
