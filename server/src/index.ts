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

async function main() {
  // Create Express app
  const app = express();
  app.use(cors());
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
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST'],
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
