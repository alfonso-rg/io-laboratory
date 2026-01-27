// Cournot Game Configuration
export interface CournotConfig {
  demandIntercept: number;  // a
  demandSlope: number;      // b
  firm1LinearCost: number;  // c1
  firm1QuadraticCost: number; // d1
  firm2LinearCost: number;  // c2
  firm2QuadraticCost: number; // d2
  totalRounds: number;
  firm1Model: string;
  firm2Model: string;
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

// Available LLM models
export const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

// Default configuration
export const DEFAULT_CONFIG: CournotConfig = {
  demandIntercept: 100,  // a
  demandSlope: 1,        // b
  firm1LinearCost: 10,   // c1
  firm1QuadraticCost: 0, // d1
  firm2LinearCost: 10,   // c2
  firm2QuadraticCost: 0, // d2
  totalRounds: 10,
  firm1Model: 'gpt-4o-mini',
  firm2Model: 'gpt-4o-mini',
};
