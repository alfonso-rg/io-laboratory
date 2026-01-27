import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { connectDatabase } from './config/database';
import { logger } from './config/logger';
import { setupGameHandlers } from './socket/gameHandlers';
import adminRoutes from './routes/admin';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types';

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Parse allowed origins from environment or use defaults
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(CLIENT_URL ? [CLIENT_URL] : []),
];

async function main() {
  // Create Express app
  const app = express();
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));
  app.use(express.json());

  // HTTP server
  const httpServer = createServer(app);

  // Socket.io server
  const io = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Connect to MongoDB
  try {
    await connectDatabase();
  } catch (error) {
    logger.error('Failed to connect to MongoDB, continuing without persistence');
  }

  // Setup Socket.io handlers
  setupGameHandlers(io);

  // API routes
  app.use('/api/admin', adminRoutes);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Start server
  httpServer.listen(PORT, () => {
    logger.info(`IO Laboratory server running on port ${PORT}`);
    logger.info(`Socket.io ready for connections`);
  });
}

main().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
