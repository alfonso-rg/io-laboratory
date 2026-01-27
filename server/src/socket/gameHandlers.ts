import { Server as SocketServer, Socket } from 'socket.io';
import {
  CournotConfig,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '../types';
import { CournotService } from '../services/CournotService';
import { logger } from '../config/logger';

export function setupGameHandlers(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
): void {
  const cournotService = new CournotService(io);

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    logger.info(`Client connected: ${socket.id}`);

    // Send current game state on connection
    const currentState = cournotService.getGameState();
    if (currentState) {
      socket.emit('game-state', currentState);
    }

    // Configure game
    socket.on('configure-game', (config: CournotConfig) => {
      try {
        logger.info('Configuring game', { config });

        // Validate configuration
        if (config.demandSlope <= 0) {
          socket.emit('error', 'Demand slope must be positive');
          return;
        }
        if (config.demandIntercept <= 0) {
          socket.emit('error', 'Demand intercept must be positive');
          return;
        }
        if (config.totalRounds < 1) {
          socket.emit('error', 'Must have at least 1 round');
          return;
        }

        const gameState = cournotService.createGame(config);
        io.emit('game-state', gameState);

        logger.info('Game configured successfully', {
          gameId: gameState.gameId,
          nashEquilibrium: gameState.nashEquilibrium,
        });
      } catch (error) {
        logger.error('Error configuring game:', error);
        socket.emit('error', `Configuration error: ${(error as Error).message}`);
      }
    });

    // Start game
    socket.on('start-game', async () => {
      try {
        logger.info('Starting game');
        await cournotService.startGame();
      } catch (error) {
        logger.error('Error starting game:', error);
        socket.emit('error', `Start error: ${(error as Error).message}`);
      }
    });

    // Pause game
    socket.on('pause-game', () => {
      try {
        logger.info('Pausing game');
        cournotService.pauseGame();
      } catch (error) {
        logger.error('Error pausing game:', error);
        socket.emit('error', `Pause error: ${(error as Error).message}`);
      }
    });

    // Resume game
    socket.on('resume-game', async () => {
      try {
        logger.info('Resuming game');
        await cournotService.resumeGame();
      } catch (error) {
        logger.error('Error resuming game:', error);
        socket.emit('error', `Resume error: ${(error as Error).message}`);
      }
    });

    // Reset game
    socket.on('reset-game', () => {
      try {
        logger.info('Resetting game');
        cournotService.resetGame();
      } catch (error) {
        logger.error('Error resetting game:', error);
        socket.emit('error', `Reset error: ${(error as Error).message}`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });
  });
}
