import { Server, Socket } from 'socket.io';

export const setupWebRTCSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    
    // 1. A new user opens the video panel, tell the other person in the room to call them
    socket.on('user-ready-for-video', (sessionId: string) => {
      socket.to(sessionId).emit('peer-ready');
    });

    // 2. Relay the WebRTC Offer
    socket.on('webrtc-offer', ({ sessionId, offer }) => {
      socket.to(sessionId).emit('webrtc-offer', offer);
    });

    // 3. Relay the WebRTC Answer
    socket.on('webrtc-answer', ({ sessionId, answer }) => {
      socket.to(sessionId).emit('webrtc-answer', answer);
    });

    // 4. Relay ICE Candidates (The network routing info)
    socket.on('webrtc-ice-candidate', ({ sessionId, candidate }) => {
      socket.to(sessionId).emit('webrtc-ice-candidate', candidate);
    });

  });
};