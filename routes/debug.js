import express from 'express';
import { debug } from '../controllers/debugController.js';

const router = express.Router();
router.get('/', debug);

export default router;

