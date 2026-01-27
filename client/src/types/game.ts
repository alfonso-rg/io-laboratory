// Information disclosure options for LLMs
export interface InformationDisclosure {
  revealDemandFunction: boolean;
  revealOwnCosts: boolean;
  revealRivalCosts: boolean;
  revealRivalIsLLM: boolean;
  describeRivalAsHuman: boolean;
}

// Communication settings between LLMs
export interface CommunicationSettings {
  allowCommunication: boolean;
  messagesPerRound: number;
  communicationPrompt?: string;
}

// Cournot Game Configuration
export interface CournotConfig {
  demandIntercept: number;  // a
  demandSlope: number;      // b
  firm1LinearCost: number;  // c1
  firm1QuadraticCost: number; // d1
  firm2LinearCost: number;  // c2
  firm2QuadraticCost: number; // d2
  totalRounds: number;
  numReplications: number;
  firm1Model: string;
  firm2Model: string;
  firm1Info: InformationDisclosure;
  firm2Info: InformationDisclosure;
  communication: CommunicationSettings;
  customSystemPrompt?: string;
  customRoundPrompt?: string;
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
  currentReplication: number;
  rounds: RoundResult[];
  replications: ReplicationResult[];
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
  'replication-started': (data: { replicationNumber: number; totalReplications: number }) => void;
  'replication-complete': (result: ReplicationResult) => void;
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

// Default information disclosure (full information)
export const DEFAULT_INFO_DISCLOSURE: InformationDisclosure = {
  revealDemandFunction: true,
  revealOwnCosts: true,
  revealRivalCosts: false,
  revealRivalIsLLM: true,
  describeRivalAsHuman: false,
};

// Default communication settings (no communication)
export const DEFAULT_COMMUNICATION: CommunicationSettings = {
  allowCommunication: false,
  messagesPerRound: 0,
};

// Default configuration
export const DEFAULT_CONFIG: CournotConfig = {
  demandIntercept: 100,  // a
  demandSlope: 1,        // b
  firm1LinearCost: 10,   // c1
  firm1QuadraticCost: 0, // d1
  firm2LinearCost: 10,   // c2
  firm2QuadraticCost: 0, // d2
  totalRounds: 10,
  numReplications: 1,
  firm1Model: 'gpt-4o-mini',
  firm2Model: 'gpt-4o-mini',
  firm1Info: { ...DEFAULT_INFO_DISCLOSURE },
  firm2Info: { ...DEFAULT_INFO_DISCLOSURE },
  communication: { ...DEFAULT_COMMUNICATION },
};
