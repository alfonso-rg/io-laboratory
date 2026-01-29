// Competition mode type
export type CompetitionMode = 'cournot' | 'bertrand';

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

// Individual firm configuration (for N-firm oligopoly)
export interface FirmConfig {
  id: number;
  linearCost: number;      // c_i
  quadraticCost: number;   // d_i
  model: string;
  info: InformationDisclosure;
}

// Cournot Game Configuration (extended for N-poly and Bertrand)
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
  // New fields for extended functionality
  competitionMode?: CompetitionMode;
  numFirms?: number;           // 2-10
  gamma?: number;              // 0=independent, 1=homogeneous
  firms?: FirmConfig[];
  minPrice?: number;
  maxPrice?: number;
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
  price?: number;
  profit: number;
  reasoning?: string;
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
  marketPrices?: number[];
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
    price?: number;
    profit: number;
  }[];
  totalQuantity: number;
  marketPrices: number[];
  avgMarketPrice: number;
  totalProfit: number;
}

// Limit-pricing analysis (Zanchettin 2006) - only for duopoly
export interface LimitPricingAnalysis {
  asymmetryIndex: number;
  limitPricingThresholdLow: number;
  limitPricingThresholdHigh: number;
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
  // Extended equilibrium for N-firm support
  nPolyEquilibrium?: NPolyEquilibrium;
  bertrandEquilibrium?: NPolyEquilibrium;
  limitPricingAnalysis?: LimitPricingAnalysis;
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
  'communication-started': (roundNumber: number) => void;
  'communication-message': (data: CommunicationMessage) => void;
  'communication-complete': (messages: CommunicationMessage[]) => void;
  'firm-decision': (data: { firm: number; quantity: number; price?: number; reasoning?: string }) => void;
  'round-complete': (result: RoundResult) => void;
  'game-over': (state: GameState) => void;
  'error': (message: string) => void;
  'llm-thinking': (data: { firm: number; status: string }) => void;
}

// Available LLM models with pricing (per 1M tokens)
// GPT-5.2 models support configurable reasoning effort levels: none, low, medium, high, xhigh
// GPT-5-nano and GPT-5-mini have FIXED built-in reasoning that cannot be disabled
export const AVAILABLE_MODELS = [
  // GPT-4 series - No reasoning, fastest responses
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', inputPrice: 0.15, outputPrice: 0.60, description: 'Fast, no reasoning' },
  { value: 'gpt-4o', label: 'GPT-4o', inputPrice: 2.50, outputPrice: 10.00, description: 'Previous flagship, no reasoning' },
  // GPT-5.2 series - Configurable reasoning
  { value: 'gpt-5.2:none', label: 'GPT-5.2 (No reasoning)', inputPrice: 1.75, outputPrice: 14.00, description: 'Fast, reasoning disabled' },
  { value: 'gpt-5.2:low', label: 'GPT-5.2 (Low reasoning)', inputPrice: 1.75, outputPrice: 14.00, description: 'Light reasoning ~1.5x tokens' },
  { value: 'gpt-5.2:medium', label: 'GPT-5.2 (Medium reasoning)', inputPrice: 1.75, outputPrice: 14.00, description: 'Balanced ~2.5x tokens' },
  { value: 'gpt-5.2:high', label: 'GPT-5.2 (High reasoning)', inputPrice: 1.75, outputPrice: 14.00, description: 'Deep reasoning ~4x tokens' },
  { value: 'gpt-5.2:xhigh', label: 'GPT-5.2 (XHigh reasoning)', inputPrice: 1.75, outputPrice: 14.00, description: 'Maximum reasoning ~8x tokens' },
  { value: 'gpt-5.2-pro', label: 'GPT-5.2 Pro', inputPrice: 3.50, outputPrice: 28.00, description: 'Hardest problems' },
  // GPT-5 legacy - FIXED reasoning (cannot be disabled)
  { value: 'gpt-5-nano', label: 'GPT-5 Nano (Fixed avg reasoning)', inputPrice: 0.05, outputPrice: 0.40, description: 'Cheap but slower than expected' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini (Fixed high reasoning)', inputPrice: 0.25, outputPrice: 2.00, description: 'Built-in high reasoning' },
];

// Competition modes
export const COMPETITION_MODES: { value: CompetitionMode; label: string; description: string }[] = [
  { value: 'cournot', label: 'Cournot (Quantity)', description: 'Firms compete by choosing production quantities' },
  { value: 'bertrand', label: 'Bertrand (Price)', description: 'Firms compete by setting prices' },
];

// Firm colors for visualization (supports up to 10 firms)
export const FIRM_COLORS = [
  '#3b82f6', // blue-500 - Firm 1
  '#ef4444', // red-500 - Firm 2
  '#10b981', // emerald-500 - Firm 3
  '#f59e0b', // amber-500 - Firm 4
  '#8b5cf6', // violet-500 - Firm 5
  '#ec4899', // pink-500 - Firm 6
  '#06b6d4', // cyan-500 - Firm 7
  '#84cc16', // lime-500 - Firm 8
  '#f97316', // orange-500 - Firm 9
  '#6366f1', // indigo-500 - Firm 10
];

// Firm color classes for Tailwind (text and background variants)
export const FIRM_COLOR_CLASSES = [
  { text: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-500' },
  { text: 'text-red-600', bg: 'bg-red-100', border: 'border-red-500' },
  { text: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-500' },
  { text: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-500' },
  { text: 'text-violet-600', bg: 'bg-violet-100', border: 'border-violet-500' },
  { text: 'text-pink-600', bg: 'bg-pink-100', border: 'border-pink-500' },
  { text: 'text-cyan-600', bg: 'bg-cyan-100', border: 'border-cyan-500' },
  { text: 'text-lime-600', bg: 'bg-lime-100', border: 'border-lime-500' },
  { text: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-500' },
  { text: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-500' },
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
  // New extended fields with defaults
  competitionMode: 'cournot',
  numFirms: 2,
  gamma: 1,  // Homogeneous products by default
};

// Helper function to get number of firms from config
export function getNumFirms(config: CournotConfig): number {
  if (config.numFirms) return config.numFirms;
  if (config.firms) return config.firms.length;
  return 2;
}

// Helper function to get gamma from config
export function getGamma(config: CournotConfig): number {
  return config.gamma ?? 1;
}

// Helper function to get competition mode from config
export function getCompetitionMode(config: CournotConfig): CompetitionMode {
  return config.competitionMode || 'cournot';
}

// Helper function to get firm config
export function getFirmConfig(config: CournotConfig, firmId: number): {
  linearCost: number;
  quadraticCost: number;
  model: string;
  info: InformationDisclosure;
} {
  if (config.firms && config.firms.length >= firmId) {
    const firm = config.firms[firmId - 1];
    return {
      linearCost: firm.linearCost,
      quadraticCost: firm.quadraticCost,
      model: firm.model,
      info: firm.info,
    };
  }

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

  // Default for firms 3+
  return {
    linearCost: 10,
    quadraticCost: 0,
    model: 'gpt-4o-mini',
    info: { ...DEFAULT_INFO_DISCLOSURE },
  };
}

// Helper to create default firms array
export function createDefaultFirms(numFirms: number, baseConfig: CournotConfig): FirmConfig[] {
  const firms: FirmConfig[] = [];
  for (let i = 1; i <= numFirms; i++) {
    const existing = getFirmConfig(baseConfig, i);
    firms.push({
      id: i,
      linearCost: existing.linearCost,
      quadraticCost: existing.quadraticCost,
      model: existing.model,
      info: { ...existing.info },
    });
  }
  return firms;
}
