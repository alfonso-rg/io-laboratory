import { create } from 'zustand';
import { CournotConfig, GameState, CommunicationMessage, DEFAULT_CONFIG } from '../types/game';

interface FirmThinking {
  firm1: boolean;
  firm2: boolean;
}

interface GameStore {
  // Configuration
  config: CournotConfig;
  setConfig: (config: Partial<CournotConfig>) => void;
  resetConfig: () => void;

  // Game state
  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;

  // UI state
  firmThinking: FirmThinking;
  setFirmThinking: (firm: 1 | 2, thinking: boolean) => void;
  resetFirmThinking: () => void;

  // Latest decisions (for animation)
  latestDecisions: {
    firm1?: { quantity: number; reasoning?: string };
    firm2?: { quantity: number; reasoning?: string };
  };
  setLatestDecision: (firm: 1 | 2, quantity: number, reasoning?: string) => void;
  clearLatestDecisions: () => void;

  // Communication messages (current round)
  currentCommunication: CommunicationMessage[];
  addCommunicationMessage: (message: CommunicationMessage) => void;
  clearCommunication: () => void;

  // Error handling
  error: string | null;
  setError: (error: string | null) => void;

  // Connection status
  connected: boolean;
  setConnected: (connected: boolean) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  // Configuration
  config: DEFAULT_CONFIG,
  setConfig: (newConfig) =>
    set((state) => ({ config: { ...state.config, ...newConfig } })),
  resetConfig: () => set({ config: DEFAULT_CONFIG }),

  // Game state
  gameState: null,
  setGameState: (gameState) => set({ gameState }),

  // UI state
  firmThinking: { firm1: false, firm2: false },
  setFirmThinking: (firm, thinking) =>
    set((state) => ({
      firmThinking: {
        ...state.firmThinking,
        [firm === 1 ? 'firm1' : 'firm2']: thinking,
      },
    })),
  resetFirmThinking: () => set({ firmThinking: { firm1: false, firm2: false } }),

  // Latest decisions
  latestDecisions: {},
  setLatestDecision: (firm, quantity, reasoning) =>
    set((state) => ({
      latestDecisions: {
        ...state.latestDecisions,
        [firm === 1 ? 'firm1' : 'firm2']: { quantity, reasoning },
      },
    })),
  clearLatestDecisions: () => set({ latestDecisions: {} }),

  // Communication messages
  currentCommunication: [],
  addCommunicationMessage: (message) =>
    set((state) => ({
      currentCommunication: [...state.currentCommunication, message],
    })),
  clearCommunication: () => set({ currentCommunication: [] }),

  // Error handling
  error: null,
  setError: (error) => set({ error }),

  // Connection status
  connected: false,
  setConnected: (connected) => set({ connected }),
}));

// Utility function to calculate Nash equilibrium for display
export function calculateNashEquilibrium(config: CournotConfig) {
  const { demandIntercept: a, demandSlope: b } = config;
  const { firm1LinearCost: c1, firm1QuadraticCost: d1 } = config;
  const { firm2LinearCost: c2, firm2QuadraticCost: d2 } = config;

  const alpha1 = a - c1;
  const alpha2 = a - c2;
  const beta1 = 2 * (b + d1);
  const beta2 = 2 * (b + d2);

  const det = beta1 * beta2 - b * b;

  if (det <= 0) {
    return null;
  }

  let q1Star = (alpha1 * beta2 - b * alpha2) / det;
  let q2Star = (alpha2 * beta1 - b * alpha1) / det;

  q1Star = Math.max(0, q1Star);
  q2Star = Math.max(0, q2Star);

  const totalQuantity = q1Star + q2Star;
  const marketPrice = Math.max(0, a - b * totalQuantity);

  const firm1Revenue = marketPrice * q1Star;
  const firm1Cost = c1 * q1Star + d1 * q1Star * q1Star;
  const firm1Profit = firm1Revenue - firm1Cost;

  const firm2Revenue = marketPrice * q2Star;
  const firm2Cost = c2 * q2Star + d2 * q2Star * q2Star;
  const firm2Profit = firm2Revenue - firm2Cost;

  return {
    firm1Quantity: q1Star,
    firm2Quantity: q2Star,
    totalQuantity,
    marketPrice,
    firm1Profit,
    firm2Profit,
  };
}

// Utility function to calculate cooperative equilibrium (multiplant monopoly)
export function calculateCooperativeEquilibrium(config: CournotConfig) {
  const { demandIntercept: a, demandSlope: b } = config;
  const { firm1LinearCost: c1, firm1QuadraticCost: d1 } = config;
  const { firm2LinearCost: c2, firm2QuadraticCost: d2 } = config;

  let q1Coop: number;
  let q2Coop: number;
  let totalQuantity: number;

  // Case 1: Both firms have quadratic costs
  if (d1 > 0 && d2 > 0) {
    const gamma1 = 1 / (2 * d1);
    const gamma2 = 1 / (2 * d2);
    const gammaSum = gamma1 + gamma2;

    totalQuantity = (gammaSum * a - gamma1 * c1 - gamma2 * c2) / (1 + 2 * b * gammaSum);
    totalQuantity = Math.max(0, totalQuantity);

    q1Coop = Math.max(0, (a - 2 * b * totalQuantity - c1) / (2 * d1));
    q2Coop = Math.max(0, (a - 2 * b * totalQuantity - c2) / (2 * d2));
  }
  // Case 2-4: Linear costs (d1 = 0 or d2 = 0)
  else {
    // Monopolist uses only the lower cost plant (or splits if equal)
    if (c1 < c2 || (c1 === c2 && d1 === 0)) {
      totalQuantity = (a - c1) / (2 * b);
      q1Coop = totalQuantity;
      q2Coop = 0;
    } else if (c2 < c1) {
      totalQuantity = (a - c2) / (2 * b);
      q1Coop = 0;
      q2Coop = totalQuantity;
    } else {
      // c1 = c2: split equally
      totalQuantity = (a - c1) / (2 * b);
      q1Coop = totalQuantity / 2;
      q2Coop = totalQuantity / 2;
    }
  }

  totalQuantity = Math.max(0, q1Coop + q2Coop);
  const marketPrice = Math.max(0, a - b * totalQuantity);

  const firm1Revenue = marketPrice * q1Coop;
  const firm1Cost = c1 * q1Coop + d1 * q1Coop * q1Coop;
  const firm1Profit = firm1Revenue - firm1Cost;

  const firm2Revenue = marketPrice * q2Coop;
  const firm2Cost = c2 * q2Coop + d2 * q2Coop * q2Coop;
  const firm2Profit = firm2Revenue - firm2Cost;

  const totalProfit = firm1Profit + firm2Profit;

  return {
    firm1Quantity: q1Coop,
    firm2Quantity: q2Coop,
    totalQuantity,
    marketPrice,
    firm1Profit,
    firm2Profit,
    totalProfit,
  };
}
