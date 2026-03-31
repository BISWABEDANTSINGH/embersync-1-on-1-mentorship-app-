import express, { Application, Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import materialRoutes from './routes/material';


// Route & Socket Imports
import sessionRoutes from './routes/session';
import { setupEditorSockets } from './sockets/editorHandler';
import { setupChatSockets } from './sockets/chatHandler';
import { setupWebRTCSockets } from './sockets/webrtcHandler';
// Load environment variables
dotenv.config();

const app: Application = express();
const server = http.createServer(app);

// Environment variables
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));
app.use(express.json()); // Parse JSON bodies

// Register API Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/materials', materialRoutes);

// Basic Health Check Route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'Platform Backend is running smoothly 🚀' });
});

// Initialize Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Top-level socket connection logging
io.on('connection', (socket) => {
  console.log(`[Socket Connected]: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected]: ${socket.id}`);
  });
});

// Initialize the specific socket handlers
setupEditorSockets(io);
setupChatSockets(io);
setupWebRTCSockets(io); 
// Start the server
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io is actively listening`);
  console.log(`=================================`);
});