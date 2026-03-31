import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { supabase } from '../config/supabase';

// ==========================================
// CREATE A NEW SESSION (Mentors Only)
// ==========================================
export const createSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;

    // 1. Verify the user is actually a mentor
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    if (profile.role !== 'mentor') {
      res.status(403).json({ error: 'Forbidden: Only mentors can create sessions' });
      return;
    }

    // 2. Create the session in the database
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert([
        { 
          mentor_id: userId,
          title: req.body.title || 'New Mentorship Session',
          status: 'waiting' 
        }
      ])
      .select()
      .single();

    if (sessionError) throw sessionError;

    res.status(201).json({ 
      message: 'Session created successfully', 
      session,
      joinLink: `${process.env.CLIENT_URL}/session/${session.id}`
    });
  } catch (error: any) {
    console.error('[Create Session Error]:', error.message);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

// ==========================================
// JOIN AN EXISTING SESSION (Students)
// ==========================================
export const joinSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // 1. Check if the session exists and is waiting
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (fetchError || !session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status === 'completed') {
      res.status(400).json({ error: 'This session has already ended' });
      return;
    }

    // 2. If the user is a student, attach them to the session
    // (If it's the mentor re-joining, we just let them in without updating the student_id)
    if (session.mentor_id !== userId) {
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ 
          student_id: userId,
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .is('student_id', null); // Only update if no student has joined yet

      if (updateError) {
        res.status(400).json({ error: 'Session is already full or unavailable' });
        return;
      }
    }

    res.status(200).json({ message: 'Successfully joined the session', sessionId });
  } catch (error: any) {
    console.error('[Join Session Error]:', error.message);
    res.status(500).json({ error: 'Failed to join session' });
  }
};

// ==========================================
// END A SESSION
// ==========================================
export const endSession = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Only the mentor should be able to end the session
    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('mentor_id')
      .eq('id', sessionId)
      .single();

    if (fetchError || session?.mentor_id !== userId) {
      res.status(403).json({ error: 'Forbidden: Only the mentor can end this session' });
      return;
    }

    const { error: updateError } = await supabase
      .from('sessions')
      .update({ 
        status: 'completed',
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (updateError) throw updateError;

    res.status(200).json({ message: 'Session ended successfully' });
  } catch (error: any) {
    console.error('[End Session Error]:', error.message);
    res.status(500).json({ error: 'Failed to end session' });
  }
};