// Competition mode type
export type CompetitionMode = 'cournot' | 'bertrand';

// Information disclosure options for LLMs
export interface InformationDisclosure {
  revealDemandFunction: boolean;      // Tell LLM about P = a - b*Q
  revealOwnCosts: boolean;            // Tell LLM about its own cost function
  revealRivalCosts: boolean;          // Tell LLM about rival's cost function
  revealRivalIsLLM: boolean;          // Tell LLM that rival is also an LLM
  describeRivalAsHuman: boolean;      // Tell LLM that rival is a human subject
}

// Communication settings between LLMs
export interface CommunicationSettings {
  allowCommunication: boolean;        // Allow pre-round dialogue
  messagesPerRound: number;           // Max messages exchanged per round
  communicationPrompt?: string;       // Custom prompt for communication phase
}

// Individual firm configuration (for N-firm oligopoly)
export interface FirmConfig {
  id: number;
  linearCost: number;      // c_i
  quadraticCost: number;   // d_i
  model: string;
  info: InformationDisclosure;
}

// Unified Oligopoly Configuration (extends CournotConfig for backward compatibility)
export interface OligopolyConfig {
  // Competition mode
  competitionMode: CompetitionMode;

  // Number of firms (2-10)
  numFirms: number;

  // Inverse demand parameters: P(Q) = a - b*Q (Cournot)
  // Or direct demand with differentiation (Bertrand)
  demandIntercept: number;  // a (or α for differentiated)
  demandSlope: number;      // b

  // Product differentiation parameter (Zanchettin 2006)
  // γ = 0: independent products, γ = 1: homogeneous products
  gamma: number;

  // Firm configurations (array for N firms)
  firms: FirmConfig[];

  // Game settings
  totalRounds: number;
  numReplications: number;

  // Communication settings
  communication: CommunicationSettings;

  // Custom prompts (optional)
  customSystemPrompt?: string;
  customRoundPrompt?: string;

  // Optional: quantity/price constraints
  minQuantity?: number;
  maxQuantity?: number;
  minPrice?: number;
  maxPrice?: number;
}

// Legacy CournotConfig for backward compatibility
export interface CournotConfig {
  // Inverse demand parameters: P(Q) = a - b*Q
  demandIntercept: number;  // a
  demandSlope: number;      // b

  // Cost parameters for firm i: C_i(q_i) = c_i * q_i + d_i * q_i^2
  firm1LinearCost: number;  // c1
  firm1QuadraticCost: number; // d1
  firm2LinearCost: number;  // c2
  firm2QuadraticCost: number; // d2

  // Game settings
  totalRounds: number;
  numReplications: number;            // Number of game replications to run

  // LLM settings
  firm1Model: string;
  firm2Model: string;

  // Information disclosure
  firm1Info: InformationDisclosure;
  firm2Info: InformationDisclosure;

  // Communication settings
  communication: CommunicationSettings;

  // Custom prompts (optional)
  customSystemPrompt?: string;
  customRoundPrompt?: string;

  // Optional: quantity constraints
  minQuantity?: number;
  maxQuantity?: number;

  // New fields for extended functionality (optional for backward compatibility)
  competitionMode?: CompetitionMode;
  numFirms?: number;
  gamma?: number;
  firms?: FirmConfig[];
}

// Communication message between firms
export interface CommunicationMessage {
  firm: number;  // Changed from 1 | 2 to support N firms
  message: string;
}

// Individual firm result in a round (for N-firm support)
export interface FirmRoundResult {
  firmId: number;
  quantity: number;
  price?: number;        // For Bertrand competition
  profit: number;
  reasoning?: string;
  // Prompts sent to LLM (for auditing/debugging)
  systemPrompt?: string;
  roundPrompt?: string;
}

// Result of a single round (extended for N firms)
export interface RoundResult {
  roundNumber: number;
  // Legacy fields for backward compatibility (duopoly)
  firm1Quantity: number;
  firm2Quantity: number;
  totalQuantity: number;
  marketPrice: number;
  firm1Profit: number;
  firm2Profit: number;
  firm1Reasoning?: string;
  firm2Reasoning?: string;
  // New fields for N-firm support
  firmResults?: FirmRoundResult[];
  marketPrices?: number[];  // Array of prices for differentiated Bertrand
  communication?: CommunicationMessage[];
  timestamp: Date;
}

// Nash equilibrium values (legacy duopoly)
export interface NashEquilibrium {
  firm1Quantity: number;
  firm2Quantity: number;
  totalQuantity: number;
  marketPrice: number;
  firm1Profit: number;
  firm2Profit: number;
}

// N-firm equilibrium (extended)
export interface NPolyEquilibrium {
  competitionMode: CompetitionMode;
  firms: {
    firmId: number;
    quantity: number;
    price?: number;    // For Bertrand
    profit: number;
  }[];
  totalQuantity: number;
  marketPrices: number[];  // May differ by firm in differentiated Bertrand
  avgMarketPrice: number;
  totalProfit: number;
}

// Cooperative equilibrium (multiplant monopoly)
export interface CooperativeEquilibrium {
  firm1Quantity: number;
  firm2Quantity: number;
  totalQuantity: number;
  marketPrice: number;
  firm1Profit: number;
  firm2Profit: number;
  totalProfit: number;
}

// Limit-pricing analysis (Zanchettin 2006) - only for duopoly
export interface LimitPricingAnalysis {
  // Asymmetry index: a = (α₁-c₁) - (α₂-c₂)
  asymmetryIndex: number;
  // Lower threshold: 1 - γ/(2-γ²)
  limitPricingThresholdLow: number;
  // Upper threshold: 1 - γ/2
  limitPricingThresholdHigh: number;
  // Current region
  isInLimitPricingRegion: boolean;
  isInMonopolyRegion: boolean;
  dominantFirm?: number;
  analysisMessage: string;
}

// Result of a single replication (one full game)
export interface ReplicationResult {
  replicationNumber: number;
  rounds: RoundResult[];
  summary: {
    totalFirm1Profit: number;
    totalFirm2Profit: number;
    avgFirm1Quantity: number;
    avgFirm2Quantity: number;
    avgMarketPrice: number;
  };
  startedAt: Date;
  completedAt: Date;
}

// Current game state
export interface GameState {
  gameId: string;
  status: 'idle' | 'configuring' | 'running' | 'paused' | 'completed';
  config: CournotConfig;
  currentRound: number;
  currentReplication: number;
  rounds: RoundResult[];  // Current replication's rounds
  replications: ReplicationResult[];  // All completed replications
  nashEquilibrium: NashEquilibrium;
  cooperativeEquilibrium: CooperativeEquilibrium;
  // Extended equilibrium for N-firm support
  nPolyEquilibrium?: NPolyEquilibrium;
  bertrandEquilibrium?: NPolyEquilibrium;
  limitPricingAnalysis?: LimitPricingAnalysis;
  startedAt?: Date;
  completedAt?: Date;
}

// LLM Decision response
export interface LLMDecision {
  quantity: number;
  reasoning?: string;
  rawResponse: string;
  // Prompts used (for auditing)
  systemPrompt?: string;
  roundPrompt?: string;
}

// Socket events from client to server
export interface ClientToServerEvents {
  'configure-game': (config: CournotConfig) => void;
  'start-game': () => void;
  'pause-game': () => void;
  'resume-game': () => void;
  'reset-game': () => void;
}

// Socket events from server to client
export interface ServerToClientEvents {
  'game-state': (state: GameState) => void;
  'replication-started': (data: { replicationNumber: number; totalReplications: number }) => void;
  'replication-complete': (result: ReplicationResult) => void;
  'round-started': (roundNumber: number) => void;
  'communication-started': (roundNumber: number) => void;
  'communication-message': (data: CommunicationMessage) => void;
  'communication-complete': (messages: CommunicationMessage[]) => void;
  'firm-decision': (data: { firm: number; quantity: number; price?: number; reasoning?: string }) => void;
  'round-complete': (result: RoundResult) => void;
  'game-over': (state: GameState) => void;
  'error': (message: string) => void;
  'llm-thinking': (data: { firm: number; status: string }) => void;
}

// Inter-server events (for Socket.io)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data
export interface SocketData {
  sessionId: string;
}

// Game result for MongoDB persistence
export interface GameResultData {
  gameId: string;
  config: CournotConfig;
  rounds: RoundResult[];
  replications: ReplicationResult[];
  nashEquilibrium: NashEquilibrium;
  cooperativeEquilibrium?: CooperativeEquilibrium;
  summary: {
    totalFirm1Profit: number;
    totalFirm2Profit: number;
    avgFirm1Quantity: number;
    avgFirm2Quantity: number;
    avgMarketPrice: number;
    nashDeviation: {
      firm1QuantityDeviation: number;
      firm2QuantityDeviation: number;
    };
  };
  startedAt: Date;
  completedAt: Date;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Admin panel statistics
export interface GameStats {
  totalGames: number;
  avgRoundsPerGame: number;
  avgNashDeviation: number;
  modelPerformance: {
    model: string;
    avgProfit: number;
    avgQuantityDeviation: number;
    gamesPlayed: number;
  }[];
}

// Helper function to migrate legacy CournotConfig to OligopolyConfig
export function migrateLegacyConfig(config: CournotConfig): OligopolyConfig {
  const numFirms = config.numFirms || 2;
  const gamma = config.gamma ?? 1;  // Default to homogeneous products
  const competitionMode = config.competitionMode || 'cournot';

  // Build firms array from legacy config
  const firms: FirmConfig[] = config.firms || [
    {
      id: 1,
      linearCost: config.firm1LinearCost,
      quadraticCost: config.firm1QuadraticCost,
      model: config.firm1Model,
      info: config.firm1Info,
    },
    {
      id: 2,
      linearCost: config.firm2LinearCost,
      quadraticCost: config.firm2QuadraticCost,
      model: config.firm2Model,
      info: config.firm2Info,
    },
  ];

  return {
    competitionMode,
    numFirms,
    demandIntercept: config.demandIntercept,
    demandSlope: config.demandSlope,
    gamma,
    firms,
    totalRounds: config.totalRounds,
    numReplications: config.numReplications,
    communication: config.communication,
    customSystemPrompt: config.customSystemPrompt,
    customRoundPrompt: config.customRoundPrompt,
    minQuantity: config.minQuantity,
    maxQuantity: config.maxQuantity,
  };
}

// Helper function to get firm config from either legacy or new format
export function getFirmConfig(config: CournotConfig, firmId: number): { linearCost: number; quadraticCost: number; model: string; info: InformationDisclosure } {
  // Check if using new firms array
  if (config.firms && config.firms.length >= firmId) {
    const firm = config.firms[firmId - 1];
    return {
      linearCost: firm.linearCost,
      quadraticCost: firm.quadraticCost,
      model: firm.model,
      info: firm.info,
    };
  }

  // Fall back to legacy fields
  if (firmId === 1) {
    return {
      linearCost: config.firm1LinearCost,
      quadraticCost: config.firm1QuadraticCost,
      model: config.firm1Model,
      info: config.firm1Info,
    };
  } else if (firmId === 2) {
    return {
      linearCost: config.firm2LinearCost,
      quadraticCost: config.firm2QuadraticCost,
      model: config.firm2Model,
      info: config.firm2Info,
    };
  }

  throw new Error(`Invalid firm ID: ${firmId}`);
}

// Get number of firms from config
export function getNumFirms(config: CournotConfig): number {
  if (config.numFirms) return config.numFirms;
  if (config.firms) return config.firms.length;
  return 2;  // Default duopoly
}

// Get competition mode from config
export function getCompetitionMode(config: CournotConfig): CompetitionMode {
  return config.competitionMode || 'cournot';
}

// Get gamma (product differentiation) from config
export function getGamma(config: CournotConfig): number {
  return config.gamma ?? 1;  // Default to homogeneous products
}
