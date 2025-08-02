import express from 'express';
import { dbCheck } from '../controllers/dbController.js';

const router = express.Router();
router.get('/', dbCheck);

export default router;

