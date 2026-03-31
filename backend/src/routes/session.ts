import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middlewares/auth';
import { createSession, joinSession, endSession } from '../controllers/session';

const router = Router();

// ==========================================
// SESSION ENDPOINTS (/api/sessions)
// ==========================================

// Test Route
router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.status(200).json({
    message: 'Authentication successful! You have access to protected routes.',
    user: req.user
  });
});

// Core Routes (All protected by requireAuth middleware)
router.post('/create', requireAuth, createSession);
router.put('/:sessionId/join', requireAuth, joinSession);
router.put('/:sessionId/end', requireAuth, endSession);

export default router;