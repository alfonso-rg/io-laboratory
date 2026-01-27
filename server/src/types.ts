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

// Cournot Game Configuration
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
}

// Result of a single round
export interface RoundResult {
  roundNumber: number;
  firm1Quantity: number;
  firm2Quantity: number;
  totalQuantity: number;
  marketPrice: number;
  firm1Profit: number;
  firm2Profit: number;
  firm1Reasoning?: string;
  firm2Reasoning?: string;
  timestamp: Date;
}

// Nash equilibrium values
export interface NashEquilibrium {
  firm1Quantity: number;
  firm2Quantity: number;
  totalQuantity: number;
  marketPrice: number;
  firm1Profit: number;
  firm2Profit: number;
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

// Current game state
export interface GameState {
  gameId: string;
  status: 'idle' | 'configuring' | 'running' | 'paused' | 'completed';
  config: CournotConfig;
  currentRound: number;
  rounds: RoundResult[];
  nashEquilibrium: NashEquilibrium;
  cooperativeEquilibrium: CooperativeEquilibrium;
  startedAt?: Date;
  completedAt?: Date;
}

// LLM Decision response
export interface LLMDecision {
  quantity: number;
  reasoning?: string;
  rawResponse: string;
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
  'round-started': (roundNumber: number) => void;
  'firm-decision': (data: { firm: 1 | 2; quantity: number; reasoning?: string }) => void;
  'round-complete': (result: RoundResult) => void;
  'game-over': (state: GameState) => void;
  'error': (message: string) => void;
  'llm-thinking': (data: { firm: 1 | 2; status: string }) => void;
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
  nashEquilibrium: NashEquilibrium;
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
