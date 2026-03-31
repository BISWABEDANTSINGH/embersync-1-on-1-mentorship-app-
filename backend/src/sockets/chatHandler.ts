import { Server, Socket } from 'socket.io';
import { supabase } from '../config/supabase';

export const setupChatSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    
    // Listen for incoming messages
    socket.on('send-message', async (messageData) => {
      const { sessionId, senderId, senderName, content } = messageData;

      const messagePayload = {
        id: crypto.randomUUID(),
        senderId,
        senderName,
        content,
        timestamp: new Date().toISOString()
      };

      // Broadcast to everyone in the room INCLUDING the sender 
      // (so we know the server successfully processed it)
      io.to(sessionId).emit('receive-message', messagePayload);

      // Save to Supabase in the background so chat history isn't lost on refresh
      try {
        await supabase.from('messages').insert([{
          session_id: sessionId,
          sender_id: senderId,
          content: content
        }]);
      } catch (error) {
        console.error('[Chat DB Error]: Failed to save message', error);
      }
    });

  });
};