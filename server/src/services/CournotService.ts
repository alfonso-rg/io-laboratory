import { v4 as uuidv4 } from 'uuid';
import { Server as SocketServer } from 'socket.io';
import mongoose from 'mongoose';
import {
  CournotConfig,
  GameState,
  RoundResult,
  ReplicationResult,
  RealizedParameters,
  ServerToClientEvents,
  ClientToServerEvents,
  getNumFirms,
  getCompetitionMode,
  getFirmConfig,
} from '../types';
import { EconomicsService } from './EconomicsService';
import { LLMService } from './LLMService';
import { ParameterService } from './ParameterService';
import { GameResultModel } from '../models/GameResult';
import { logger } from '../config/logger';

export class CournotService {
  private io: SocketServer<ClientToServerEvents, ServerToClientEvents>;
  private llmService: LLMService;
  private gameState: GameState | null = null;
  private isPaused: boolean = false;
  // Realized parameters for different variation modes
  private fixedRealizedParams: RealizedParameters | null = null;
  private replicationRealizedParams: RealizedParameters | null = null;

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
    const numFirms = getNumFirms(config);
    const mode = getCompetitionMode(config);

    // Initialize fixed realized parameters if using 'fixed' variation (default)
    const variation = config.parameterVariation || 'fixed';
    if (variation === 'fixed' && ParameterService.hasRandomParameters(config)) {
      this.fixedRealizedParams = ParameterService.drawAllParameters(config);
      logger.info('Generated fixed realized parameters for game', this.fixedRealizedParams);
    } else {
      this.fixedRealizedParams = null;
    }
    this.replicationRealizedParams = null;

    // Calculate legacy Nash equilibrium (always Cournot duopoly for backward compatibility)
    const nashEquilibrium = EconomicsService.calculateNashEquilibrium(config);
    const cooperativeEquilibrium = EconomicsService.calculateCooperativeEquilibrium(config);

    // Calculate extended equilibria for N firms
    let nPolyEquilibrium;
    let bertrandEquilibrium;
    let limitPricingAnalysis;

    try {
      // Calculate N-poly Cournot equilibrium
      nPolyEquilibrium = EconomicsService.calculateNashCournotNFirms(config);

      // Calculate Bertrand equilibrium if using Bertrand mode or for comparison
      bertrandEquilibrium = EconomicsService.calculateNashBertrandNFirms(config);

      // Calculate limit-pricing analysis (only for duopoly)
      if (numFirms === 2) {
        limitPricingAnalysis = EconomicsService.analyzeLimitPricing(config);
      }
    } catch (error) {
      logger.warn('Could not calculate extended equilibria:', error);
    }

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
      nPolyEquilibrium,
      bertrandEquilibrium,
      limitPricingAnalysis,
    };

    logger.info(`Game created: ${this.gameState.gameId}`, {
      config: {
        ...config,
        numFirms,
        competitionMode: mode,
      },
      nashEquilibrium,
      cooperativeEquilibrium,
      nPolyEquilibrium,
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

      // Generate per-replication parameters if needed
      const variation = config.parameterVariation || 'fixed';
      if (variation === 'per-replication' && ParameterService.hasRandomParameters(config)) {
        this.replicationRealizedParams = ParameterService.drawAllParameters(config);
        logger.info(`Generated per-replication parameters for replication ${replication}`, this.replicationRealizedParams);
      }

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
   * Calculate summary for a replication.
   * Legacy duopoly fields are always populated for backward compatibility.
   * firmSummaries covers all N firms using firmResults when available.
   */
  private calculateReplicationSummary(rounds: RoundResult[]) {
    const n = rounds.length || 1;

    // Legacy fields (duopoly backward compatibility)
    const totalFirm1Profit = rounds.reduce((sum, r) => sum + r.firm1Profit, 0);
    const totalFirm2Profit = rounds.reduce((sum, r) => sum + r.firm2Profit, 0);
    const avgFirm1Quantity = rounds.reduce((sum, r) => sum + r.firm1Quantity, 0) / n;
    const avgFirm2Quantity = rounds.reduce((sum, r) => sum + r.firm2Quantity, 0) / n;
    const avgMarketPrice = rounds.reduce((sum, r) => sum + r.marketPrice, 0) / n;

    // N-firm extended summary using firmResults
    const firstRoundWithResults = rounds.find(r => r.firmResults && r.firmResults.length > 0);
    let firmSummaries: { firmId: number; totalProfit: number; avgQuantity: number }[] | undefined;

    if (firstRoundWithResults?.firmResults) {
      const numFirms = firstRoundWithResults.firmResults.length;
      firmSummaries = Array.from({ length: numFirms }, (_, i) => {
        const firmId = i + 1;
        let totalProfit = 0;
        let totalQuantity = 0;

        for (const round of rounds) {
          if (round.firmResults) {
            const fr = round.firmResults.find(f => f.firmId === firmId);
            totalProfit += fr?.profit ?? 0;
            totalQuantity += fr?.quantity ?? 0;
          } else {
            // Fallback to legacy fields for firms 1 and 2
            totalProfit += firmId === 1 ? round.firm1Profit : firmId === 2 ? round.firm2Profit : 0;
            totalQuantity += firmId === 1 ? round.firm1Quantity : firmId === 2 ? round.firm2Quantity : 0;
          }
        }

        return { firmId, totalProfit, avgQuantity: totalQuantity / n };
      });
    }

    return {
      totalFirm1Profit,
      totalFirm2Profit,
      avgFirm1Quantity,
      avgFirm2Quantity,
      avgMarketPrice,
      firmSummaries,
    };
  }

  /**
   * Get realized parameters for the current round based on variation mode
   */
  private getRealizedParamsForRound(config: CournotConfig): RealizedParameters | undefined {
    const variation = config.parameterVariation || 'fixed';

    if (!ParameterService.hasRandomParameters(config)) {
      return undefined; // No random parameters, use config directly
    }

    switch (variation) {
      case 'per-round':
        // Generate fresh parameters for each round
        const roundParams = ParameterService.drawAllParameters(config);
        logger.debug('Generated per-round parameters', roundParams);
        return roundParams;
      case 'per-replication':
        return this.replicationRealizedParams || undefined;
      case 'fixed':
      default:
        return this.fixedRealizedParams || undefined;
    }
  }

  /**
   * Play a single round (supports N firms and both competition modes)
   */
  private async playRound(roundNumber: number): Promise<void> {
    if (!this.gameState) return;

    const config = this.gameState.config;
    const numFirms = getNumFirms(config);
    const mode = getCompetitionMode(config);

    this.gameState.currentRound = roundNumber;
    this.io.emit('round-started', roundNumber);

    // Get realized parameters for this round
    const realizedParams = this.getRealizedParamsForRound(config);

    logger.info(`Starting round ${roundNumber} (${numFirms} firms, ${mode} mode)`, {
      hasRealizedParams: !!realizedParams,
      demandType: realizedParams?.demand?.type || 'linear',
    });

    let communication: { firm: number; message: string }[] | undefined;

    try {
      // Communication phase (if enabled)
      if (config.communication.allowCommunication) {
        this.io.emit('communication-started', roundNumber);
        logger.info(`Starting communication phase for round ${roundNumber}`);

        communication = await this.runCommunicationPhase(roundNumber);
        this.io.emit('communication-complete', communication);
      }

      // Notify clients that LLMs are thinking
      for (let i = 1; i <= numFirms; i++) {
        this.io.emit('llm-thinking', { firm: i, status: 'thinking' });
      }

      // Get decisions from all firms (passing realized parameters)
      const decisionsMap = await this.llmService.getAllDecisions(
        config,
        roundNumber,
        this.gameState.rounds,
        realizedParams
      );

      // Emit individual decisions
      for (let i = 1; i <= numFirms; i++) {
        const decision = decisionsMap.get(i);
        if (decision) {
          this.io.emit('firm-decision', {
            firm: i,
            quantity: mode === 'cournot' ? decision.quantity : 0,
            price: mode === 'bertrand' ? decision.quantity : 0,  // In Bertrand, the "quantity" field holds price
            reasoning: decision.reasoning,
          });
        }
      }

      // Build decisions array for result calculation
      const decisionsArray = Array.from(decisionsMap.entries()).map(([firmId, decision]) => ({
        firmId,
        quantity: mode === 'cournot' ? decision.quantity : undefined,
        price: mode === 'bertrand' ? decision.quantity : undefined,
        reasoning: decision.reasoning,
        systemPrompt: decision.systemPrompt,
        roundPrompt: decision.roundPrompt,
      }));

      // Calculate round results using N-poly method with realized parameters
      const roundResult = EconomicsService.calculateNPolyRoundResult(
        roundNumber,
        decisionsArray,
        config,
        realizedParams
      );

      // Store realized parameters in round result
      if (realizedParams) {
        roundResult.realizedParameters = realizedParams;
      }

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
        numFirms,
        mode,
        totalQuantity: roundResult.totalQuantity,
        avgPrice: roundResult.marketPrice,
        hadCommunication: !!communication,
      });
    } catch (error) {
      logger.error(`Error in round ${roundNumber}:`, error);
      this.io.emit('error', `Error in round ${roundNumber}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Run communication phase for a round (supports N firms)
   */
  private async runCommunicationPhase(
    roundNumber: number
  ): Promise<{ firm: number; message: string }[]> {
    if (!this.gameState) return [];

    const config = this.gameState.config;
    const numFirms = getNumFirms(config);
    const messagesPerRound = config.communication.messagesPerRound || 2;
    const conversation: { firm: number; message: string }[] = [];

    for (let i = 0; i < messagesPerRound; i++) {
      // Cycle through firms: 1, 2, ..., n, 1, 2, ...
      const currentFirm = (i % numFirms) + 1;

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
      // Check if MongoDB is connected
      if (mongoose.connection.readyState !== 1) {
        logger.warn(`MongoDB not connected (state: ${mongoose.connection.readyState}), skipping save for game ${this.gameState.gameId}`);
      } else {
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
        logger.info(`Game results saved to MongoDB: ${this.gameState.gameId}`, {
          numReplications: this.gameState.replications.length,
          totalRounds: allRounds.length,
        });
      }
    } catch (error) {
      logger.error(`Error saving game results for ${this.gameState.gameId}:`, error);
    }

    // Notify clients
    this.io.emit('game-over', this.gameState);
    this.io.emit('game-state', this.gameState);

    logger.info(`Game completed: ${this.gameState.gameId}`, { summary });
  }
}
