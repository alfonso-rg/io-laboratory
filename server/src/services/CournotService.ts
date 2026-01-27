import { v4 as uuidv4 } from 'uuid';
import { Server as SocketServer } from 'socket.io';
import {
  CournotConfig,
  GameState,
  RoundResult,
  NashEquilibrium,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../types';
import { EconomicsService } from './EconomicsService';
import { LLMService } from './LLMService';
import { GameResultModel } from '../models/GameResult';
import { logger } from '../config/logger';

export class CournotService {
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  private llmService: LLMService;
  private gameState: GameState | null = null;
  private isPaused: boolean = false;

  constructor(io: SocketServer<ClientToServerEvents, ServerToClientEvents>) {
    this.io = io;
    this.llmService = new LLMService();
  }

  /**
   * Get current game state
   */
  getGameState(): GameState | null {
    return this.gameState;
  }

  /**
   * Create a new game with the given configuration
   */
  createGame(config: CournotConfig): GameState {
    const nashEquilibrium = EconomicsService.calculateNashEquilibrium(config);

    this.gameState = {
      gameId: uuidv4(),
      status: 'configuring',
      config,
      currentRound: 0,
      rounds: [],
      nashEquilibrium,
    };

    logger.info(`Game created: ${this.gameState.gameId}`, {
      config,
      nashEquilibrium,
    });

    return this.gameState;
  }

  /**
   * Start the game
   */
  async startGame(): Promise<void> {
    if (!this.gameState) {
      throw new Error('No game configured');
    }

    if (this.gameState.status === 'running') {
      throw new Error('Game already running');
    }

    this.gameState.status = 'running';
    this.gameState.startedAt = new Date();
    this.isPaused = false;

    logger.info(`Game started: ${this.gameState.gameId}`);
    this.io.emit('game-state', this.gameState);

    // Run all rounds
    await this.runGame();
  }

  /**
   * Pause the game
   */
  pauseGame(): void {
    if (this.gameState?.status === 'running') {
      this.gameState.status = 'paused';
      this.isPaused = true;
      this.io.emit('game-state', this.gameState);
      logger.info(`Game paused: ${this.gameState.gameId}`);
    }
  }

  /**
   * Resume the game
   */
  async resumeGame(): Promise<void> {
    if (this.gameState?.status === 'paused') {
      this.gameState.status = 'running';
      this.isPaused = false;
      this.io.emit('game-state', this.gameState);
      logger.info(`Game resumed: ${this.gameState.gameId}`);
      await this.runGame();
    }
  }

  /**
   * Reset the game
   */
  resetGame(): void {
    if (this.gameState) {
      const config = this.gameState.config;
      this.createGame(config);
      this.io.emit('game-state', this.gameState);
      logger.info(`Game reset: ${this.gameState?.gameId}`);
    }
  }

  /**
   * Run the game loop
   */
  private async runGame(): Promise<void> {
    if (!this.gameState) return;

    const { config, rounds } = this.gameState;
    const startRound = this.gameState.currentRound + 1;

    for (let round = startRound; round <= config.totalRounds; round++) {
      if (this.isPaused) {
        logger.info('Game loop paused');
        return;
      }

      await this.playRound(round);

      // Small delay between rounds for UI updates
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Game completed
    await this.completeGame();
  }

  /**
   * Play a single round
   */
  private async playRound(roundNumber: number): Promise<void> {
    if (!this.gameState) return;

    this.gameState.currentRound = roundNumber;
    this.io.emit('round-started', roundNumber);

    logger.info(`Starting round ${roundNumber}`);

    try {
      // Notify clients that LLMs are thinking
      this.io.emit('llm-thinking', { firm: 1, status: 'thinking' });
      this.io.emit('llm-thinking', { firm: 2, status: 'thinking' });

      // Get decisions from both firms
      const decisions = await this.llmService.getBothDecisions(
        this.gameState.config,
        roundNumber,
        this.gameState.rounds
      );

      // Emit individual decisions
      this.io.emit('firm-decision', {
        firm: 1,
        quantity: decisions.firm1.quantity,
        reasoning: decisions.firm1.reasoning,
      });
      this.io.emit('firm-decision', {
        firm: 2,
        quantity: decisions.firm2.quantity,
        reasoning: decisions.firm2.reasoning,
      });

      // Calculate round results
      const roundResult = EconomicsService.calculateRoundResult(
        roundNumber,
        decisions.firm1.quantity,
        decisions.firm2.quantity,
        this.gameState.config,
        decisions.firm1.reasoning,
        decisions.firm2.reasoning
      );

      // Store result
      this.gameState.rounds.push(roundResult);

      // Emit round complete
      this.io.emit('round-complete', roundResult);
      this.io.emit('game-state', this.gameState);

      logger.info(`Round ${roundNumber} complete`, {
        firm1Quantity: roundResult.firm1Quantity,
        firm2Quantity: roundResult.firm2Quantity,
        price: roundResult.marketPrice,
      });
    } catch (error) {
      logger.error(`Error in round ${roundNumber}:`, error);
      this.io.emit('error', `Error in round ${roundNumber}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Complete the game and save results
   */
  private async completeGame(): Promise<void> {
    if (!this.gameState) return;

    this.gameState.status = 'completed';
    this.gameState.completedAt = new Date();

    // Calculate summary
    const summary = EconomicsService.calculateGameSummary(
      this.gameState.rounds,
      this.gameState.nashEquilibrium
    );

    // Save to database
    try {
      const gameResult = new GameResultModel({
        gameId: this.gameState.gameId,
        config: this.gameState.config,
        rounds: this.gameState.rounds,
        nashEquilibrium: this.gameState.nashEquilibrium,
        summary,
        startedAt: this.gameState.startedAt,
        completedAt: this.gameState.completedAt,
      });

      await gameResult.save();
      logger.info(`Game results saved: ${this.gameState.gameId}`);
    } catch (error) {
      logger.error('Error saving game results:', error);
    }

    // Notify clients
    this.io.emit('game-over', this.gameState);
    this.io.emit('game-state', this.gameState);

    logger.info(`Game completed: ${this.gameState.gameId}`, { summary });
  }
}
