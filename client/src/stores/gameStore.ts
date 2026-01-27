import { create } from 'zustand';
import {
  CournotConfig,
  GameState,
  CommunicationMessage,
  DEFAULT_CONFIG,
  NPolyEquilibrium,
  LimitPricingAnalysis,
  getNumFirms,
  getGamma,
  getFirmConfig,
} from '../types/game';

// Dynamic firm thinking state (supports up to 10 firms)
type FirmThinking = Record<string, boolean>;

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
  setFirmThinking: (firm: number, thinking: boolean) => void;
  resetFirmThinking: () => void;

  // Latest decisions (for animation) - supports N firms
  latestDecisions: Record<string, { quantity: number; price?: number; reasoning?: string }>;
  setLatestDecision: (firm: number, quantity: number, price?: number, reasoning?: string) => void;
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

  // UI state - supports N firms
  firmThinking: {},
  setFirmThinking: (firm, thinking) =>
    set((state) => ({
      firmThinking: {
        ...state.firmThinking,
        [`firm${firm}`]: thinking,
      },
    })),
  resetFirmThinking: () => set({ firmThinking: {} }),

  // Latest decisions - supports N firms
  latestDecisions: {},
  setLatestDecision: (firm, quantity, price, reasoning) =>
    set((state) => ({
      latestDecisions: {
        ...state.latestDecisions,
        [`firm${firm}`]: { quantity, price, reasoning },
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

// ============================================
// N-FIRM EQUILIBRIUM CALCULATIONS
// ============================================

/**
 * Solve a linear system Ax = b using Gaussian elimination
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    if (Math.abs(aug[col][col]) < 1e-10) return null;

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= aug[i][j] * x[j];
    }
    x[i] /= aug[i][i];
  }

  return x;
}

/**
 * Calculate N-poly Cournot equilibrium
 */
export function calculateNPolyCournotEquilibrium(config: CournotConfig): NPolyEquilibrium | null {
  const { demandIntercept: a, demandSlope: b } = config;
  const gamma = getGamma(config);
  const numFirms = getNumFirms(config);

  const A: number[][] = [];
  const B: number[] = [];

  for (let i = 0; i < numFirms; i++) {
    const firmConfig = getFirmConfig(config, i + 1);
    const c_i = firmConfig.linearCost;
    const d_i = firmConfig.quadraticCost;
    const alpha_i = a - c_i;
    B.push(alpha_i);

    const row: number[] = [];
    for (let j = 0; j < numFirms; j++) {
      if (i === j) {
        row.push(2 * (b + d_i));
      } else {
        row.push(gamma * b);
      }
    }
    A.push(row);
  }

  const solution = solveLinearSystem(A, B);
  if (!solution) return null;

  const quantities = solution.map(q => Math.max(0, q));
  const firms: NPolyEquilibrium['firms'] = [];
  const marketPrices: number[] = [];
  let totalQuantity = 0;
  let totalProfit = 0;

  for (let i = 0; i < numFirms; i++) {
    const q_i = quantities[i];
    totalQuantity += q_i;

    let otherQSum = 0;
    for (let j = 0; j < numFirms; j++) {
      if (j !== i) otherQSum += quantities[j];
    }
    const price_i = Math.max(0, a - b * (q_i + gamma * otherQSum));
    marketPrices.push(price_i);

    const firmConfig = getFirmConfig(config, i + 1);
    const cost_i = firmConfig.linearCost * q_i + firmConfig.quadraticCost * q_i * q_i;
    const profit_i = price_i * q_i - cost_i;
    totalProfit += profit_i;

    firms.push({ firmId: i + 1, quantity: q_i, profit: profit_i });
  }

  return {
    competitionMode: 'cournot',
    firms,
    totalQuantity,
    marketPrices,
    avgMarketPrice: marketPrices.reduce((s, p) => s + p, 0) / numFirms,
    totalProfit,
  };
}

/**
 * Calculate limit-pricing analysis (duopoly only)
 */
export function calculateLimitPricingAnalysis(config: CournotConfig): LimitPricingAnalysis | null {
  const numFirms = getNumFirms(config);
  if (numFirms !== 2) return null;

  const { demandIntercept: a } = config;
  const gamma = getGamma(config);

  const firm1 = getFirmConfig(config, 1);
  const firm2 = getFirmConfig(config, 2);

  const alpha1 = a - firm1.linearCost;
  const alpha2 = a - firm2.linearCost;

  const asymmetryIndex = alpha2 !== 0 ? (alpha1 - alpha2) / alpha2 : 0;
  const limitPricingThresholdLow = 1 - gamma / (2 - gamma * gamma);
  const limitPricingThresholdHigh = 1 - gamma / 2;

  const isInLimitPricingRegion =
    asymmetryIndex >= limitPricingThresholdLow &&
    asymmetryIndex < limitPricingThresholdHigh;
  const isInMonopolyRegion = asymmetryIndex >= limitPricingThresholdHigh;

  let dominantFirm: number | undefined;
  let analysisMessage: string;

  if (isInMonopolyRegion) {
    dominantFirm = alpha1 > alpha2 ? 1 : 2;
    analysisMessage = `Monopoly region: Firm ${dominantFirm} can monopolize.`;
  } else if (isInLimitPricingRegion) {
    dominantFirm = alpha1 > alpha2 ? 1 : 2;
    analysisMessage = `Limit-pricing region: Firm ${dominantFirm} can engage in limit pricing.`;
  } else {
    analysisMessage = 'Interior duopoly: Both firms compete actively.';
  }

  return {
    asymmetryIndex,
    limitPricingThresholdLow,
    limitPricingThresholdHigh,
    isInLimitPricingRegion,
    isInMonopolyRegion,
    dominantFirm,
    analysisMessage,
  };
}
