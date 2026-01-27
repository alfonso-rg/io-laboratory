import { v4 as uuidv4 } from 'uuid';
import { Server as SocketServer } from 'socket.io';
import {
  CournotConfig,
  GameState,
  RoundResult,
  ReplicationResult,
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
    const cooperativeEquilibrium = EconomicsService.calculateCooperativeEquilibrium(config);

    this.gameState = {
      gameId: uuidv4(),
      status: 'configuring',
      config,
      currentRound: 0,
      currentReplication: 0,
      rounds: [],
      replications: [],
      nashEquilibrium,
      cooperativeEquilibrium,
    };

    logger.info(`Game created: ${this.gameState.gameId}`, {
      config,
      nashEquilibrium,
      cooperativeEquilibrium,
      numReplications: config.numReplications,
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
   * Run the game loop with multiple replications
   */
  private async runGame(): Promise<void> {
    if (!this.gameState) return;

    const { config } = this.gameState;
    const numReplications = config.numReplications || 1;
    const startReplication = this.gameState.currentReplication || 1;

    for (let replication = startReplication; replication <= numReplications; replication++) {
      if (this.isPaused) {
        logger.info('Game loop paused');
        return;
      }

      // Start new replication
      this.gameState.currentReplication = replication;
      this.gameState.currentRound = 0;
      this.gameState.rounds = [];

      const replicationStartTime = new Date();

      this.io.emit('replication-started', {
        replicationNumber: replication,
        totalReplications: numReplications,
      });
      this.io.emit('game-state', this.gameState);

      logger.info(`Starting replication ${replication} of ${numReplications}`);

      // Run all rounds for this replication
      for (let round = 1; round <= config.totalRounds; round++) {
        if (this.isPaused) {
          logger.info('Game loop paused');
          return;
        }

        await this.playRound(round);

        // Small delay between rounds for UI updates
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Save replication result
      const replicationResult: ReplicationResult = {
        replicationNumber: replication,
        rounds: [...this.gameState.rounds],
        summary: this.calculateReplicationSummary(this.gameState.rounds),
        startedAt: replicationStartTime,
        completedAt: new Date(),
      };

      this.gameState.replications.push(replicationResult);
      this.io.emit('replication-complete', replicationResult);

      logger.info(`Replication ${replication} complete`, {
        summary: replicationResult.summary,
      });

      // Delay between replications
      if (replication < numReplications) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // All replications completed
    await this.completeGame();
  }

  /**
   * Calculate summary for a replication
   */
  private calculateReplicationSummary(rounds: RoundResult[]) {
    const totalFirm1Profit = rounds.reduce((sum, r) => sum + r.firm1Profit, 0);
    const totalFirm2Profit = rounds.reduce((sum, r) => sum + r.firm2Profit, 0);
    const avgFirm1Quantity = rounds.reduce((sum, r) => sum + r.firm1Quantity, 0) / rounds.length;
    const avgFirm2Quantity = rounds.reduce((sum, r) => sum + r.firm2Quantity, 0) / rounds.length;
    const avgMarketPrice = rounds.reduce((sum, r) => sum + r.marketPrice, 0) / rounds.length;

    return {
      totalFirm1Profit,
      totalFirm2Profit,
      avgFirm1Quantity,
      avgFirm2Quantity,
      avgMarketPrice,
    };
  }

  /**
   * Play a single round
   */
  private async playRound(roundNumber: number): Promise<void> {
    if (!this.gameState) return;

    this.gameState.currentRound = roundNumber;
    this.io.emit('round-started', roundNumber);

    logger.info(`Starting round ${roundNumber}`);

    let communication: { firm: 1 | 2; message: string }[] | undefined;

    try {
      // Communication phase (if enabled)
      if (this.gameState.config.communication.allowCommunication) {
        this.io.emit('communication-started', roundNumber);
        logger.info(`Starting communication phase for round ${roundNumber}`);

        communication = await this.runCommunicationPhase(roundNumber);
        this.io.emit('communication-complete', communication);
      }

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

      // Add communication to result if it occurred
      if (communication) {
        roundResult.communication = communication;
      }

      // Store result
      this.gameState.rounds.push(roundResult);

      // Emit round complete
      this.io.emit('round-complete', roundResult);
      this.io.emit('game-state', this.gameState);

      logger.info(`Round ${roundNumber} complete`, {
        firm1Quantity: roundResult.firm1Quantity,
        firm2Quantity: roundResult.firm2Quantity,
        price: roundResult.marketPrice,
        hadCommunication: !!communication,
      });
    } catch (error) {
      logger.error(`Error in round ${roundNumber}:`, error);
      this.io.emit('error', `Error in round ${roundNumber}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Run communication phase for a round
   */
  private async runCommunicationPhase(
    roundNumber: number
  ): Promise<{ firm: 1 | 2; message: string }[]> {
    if (!this.gameState) return [];

    const config = this.gameState.config;
    const messagesPerRound = config.communication.messagesPerRound || 2;
    const conversation: { firm: 1 | 2; message: string }[] = [];

    for (let i = 0; i < messagesPerRound; i++) {
      const currentFirm: 1 | 2 = (i % 2 === 0) ? 1 : 2;

      this.io.emit('llm-thinking', { firm: currentFirm, status: 'communicating' });

      const message = await this.llmService.getCommunicationMessage(
        config,
        currentFirm,
        roundNumber,
        this.gameState.rounds,
        conversation
      );

      conversation.push({ firm: currentFirm, message });
      this.io.emit('communication-message', { firm: currentFirm, message });

      // Small delay between messages
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return conversation;
  }

  /**
   * Complete the game and save results
   */
  private async completeGame(): Promise<void> {
    if (!this.gameState) return;

    this.gameState.status = 'completed';
    this.gameState.completedAt = new Date();

    // Calculate summary across all replications
    const allRounds = this.gameState.replications.length > 0
      ? this.gameState.replications.flatMap(r => r.rounds)
      : this.gameState.rounds;

    const summary = EconomicsService.calculateGameSummary(
      allRounds,
      this.gameState.nashEquilibrium
    );

    // Save to database
    try {
      const gameResult = new GameResultModel({
        gameId: this.gameState.gameId,
        config: this.gameState.config,
        rounds: this.gameState.rounds,
        replications: this.gameState.replications,
        nashEquilibrium: this.gameState.nashEquilibrium,
        cooperativeEquilibrium: this.gameState.cooperativeEquilibrium,
        summary,
        startedAt: this.gameState.startedAt,
        completedAt: this.gameState.completedAt,
      });

      await gameResult.save();
      logger.info(`Game results saved: ${this.gameState.gameId}`, {
        numReplications: this.gameState.replications.length,
        totalRounds: allRounds.length,
      });
    } catch (error) {
      logger.error('Error saving game results:', error);
    }

    // Notify clients
    this.io.emit('game-over', this.gameState);
    this.io.emit('game-state', this.gameState);

    logger.info(`Game completed: ${this.gameState.gameId}`, { summary });
  }
}
