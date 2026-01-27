import { create } from 'zustand';
import { CournotConfig, GameState, DEFAULT_CONFIG } from '../types/game';

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
