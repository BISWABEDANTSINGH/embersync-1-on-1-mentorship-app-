import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import { getMaterials, createMaterial, deleteMaterial } from '../controllers/material';

const router = Router();

// ==========================================
// MATERIAL ENDPOINTS (/api/materials)
// ==========================================

// All routes are protected by the requireAuth middleware
router.get('/', requireAuth, getMaterials);
router.post('/create', requireAuth, createMaterial);
router.delete('/:materialId', requireAuth, deleteMaterial);

export default router;