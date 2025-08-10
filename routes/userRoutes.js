import express from 'express';
import { listUsers, getUser, createUser, updateUser, deleteUser } from '../controllers/userController.js';
// import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', /* requireAuth, requireRole('admin'), */ listUsers);
router.post('/', /* requireAuth, requireRole('admin'), */ createUser);
router.get('/:id', /* requireAuth, */ getUser);
router.patch('/:id', /* requireAuth, */ updateUser);
router.delete('/:id', /* requireAuth, requireRole('admin'), */ deleteUser);

export default router;
