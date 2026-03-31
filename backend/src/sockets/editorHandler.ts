import { Server, Socket } from 'socket.io';

export const setupEditorSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    
    // 1. User joins a specific mentoring session room
    socket.on('join-session', (sessionId: string) => {
      socket.join(sessionId);
      console.log(`[Socket] User ${socket.id} joined session: ${sessionId}`);
    });

    // 2. Listen for code changes and broadcast to the other person in the room
    socket.on('code-change', ({ sessionId, code }: { sessionId: string, code: string }) => {
      // socket.to(room).emit sends it to everyone in the room EXCEPT the sender
      socket.to(sessionId).emit('receive-code', code);
    });
    // Sync language changes between mentor and student
    socket.on('language-change', ({ sessionId, language }) => {
      socket.to(sessionId).emit('receive-language', language);
    });
    // When a mentor ends the session, tell everyone else in the room to leave
    socket.on('end-session', (sessionId: string) => {
      socket.to(sessionId).emit('session-ended');
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] User ${socket.id} disconnected`);
    });
  });
};