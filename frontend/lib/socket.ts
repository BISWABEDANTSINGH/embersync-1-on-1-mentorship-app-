import { io } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

// autoConnect: false ensures it only connects when we explicitly tell it to (inside the session room)
export const socket = io(BACKEND_URL, {
  autoConnect: false, 
});