import express, { Application, Request, Response } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import materialRoutes from './routes/material';
import { WebSocketServer } from 'ws';
const { setupWSConnection } = require('y-websocket/bin/utils');// Route & Socket Imports
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

// ==========================================
// 1. SOCKET.IO SETUP (Chat, Signaling, Events)
// ==========================================
const io = new SocketIOServer(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Top-level socket connection logging
io.on('connection', (socket) => {
  console.log(`[Socket.io Connected]: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[Socket.io Disconnected]: ${socket.id}`);
  });
});

// Initialize the specific socket handlers
setupEditorSockets(io);
setupChatSockets(io);
setupWebRTCSockets(io); 

// ==========================================
// 2. YJS CRDT SETUP (Real-time Code Sync)
// ==========================================
// Create a secondary WebSocket server specifically for Yjs CRDTs
const wss = new WebSocketServer({ noServer: true });

// Listen for connection upgrades on the main HTTP server
server.on('upgrade', (request, socket, head) => {
  // If the request is for our Yjs endpoint, handle it with the WS server
  if (request.url?.startsWith('/yjs')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
  // Note: Socket.io automatically intercepts requests starting with /socket.io/
  // so they will happily live side-by-side without conflicting!
});

// Pass the raw WebSocket connections to the Yjs document sync utility
wss.on('connection', (ws, req) => {
  console.log(`[Yjs CRDT Connected]: Client joined document sync`);
  setupWSConnection(ws, req);
});


// ==========================================
// START SERVER
// ==========================================
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io listening for events`);
  console.log(`🧠 Yjs CRDT engine ready on /yjs`);
  console.log(`=================================`);
});