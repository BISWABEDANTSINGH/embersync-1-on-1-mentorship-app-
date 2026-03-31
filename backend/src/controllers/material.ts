import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { supabase } from '../config/supabase';

// ==========================================
// GET ALL MATERIALS (Students & Mentors)
// ==========================================
export const getMaterials = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Fetch materials, ordering by newest first
    const { data: materials, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ materials });
  } catch (error: any) {
    console.error('[Get Materials Error]:', error.message);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
};

// ==========================================
// CREATE NEW MATERIAL RECORD (Mentors Only)
// ==========================================
export const createMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { title, file_url, type, size } = req.body;

    if (!title || !file_url || !type) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Verify user is a mentor
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role !== 'mentor') {
      res.status(403).json({ error: 'Forbidden: Only mentors can upload materials' });
      return;
    }

    // Insert the record
    const { data: material, error } = await supabase
      .from('materials')
      .insert([{
        uploader_id: userId,
        title,
        file_url,
        type,
        size: size || 'Unknown'
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ message: 'Material added successfully', material });
  } catch (error: any) {
    console.error('[Create Material Error]:', error.message);
    res.status(500).json({ error: 'Failed to add material' });
  }
};

// ==========================================
// DELETE MATERIAL (Mentors Only)
// ==========================================
export const deleteMaterial = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { materialId } = req.params;

    // Delete the material ONLY if the current user is the one who uploaded it
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId)
      .eq('uploader_id', userId); // Security check

    if (error) throw error;

    res.status(200).json({ message: 'Material deleted successfully' });
  } catch (error: any) {
    console.error('[Delete Material Error]:', error.message);
    res.status(500).json({ error: 'Failed to delete material' });
  }
};