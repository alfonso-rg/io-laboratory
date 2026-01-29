import {
  CournotConfig,
  NashEquilibrium,
  CooperativeEquilibrium,
  RoundResult,
  NPolyEquilibrium,
  LimitPricingAnalysis,
  FirmRoundResult,
  RealizedParameters,
  DemandFunctionType,
  getNumFirms,
  getGamma,
  getCompetitionMode,
  getFirmConfig,
  getDemandFunctionType,
} from '../types';

export class EconomicsService {
  /**
   * Calculate market price given total quantity
   * P(Q) = a - b*Q
   */
  static calculateMarketPrice(totalQuantity: number, config: CournotConfig): number {
    const price = config.demandIntercept - config.demandSlope * totalQuantity;
    return Math.max(0, price); // Price cannot be negative
  }

  /**
   * Calculate market price with any demand function type using realized parameters.
   * Supports both linear and isoelastic demand.
   *
   * Linear: P = a - b*Q
   * Isoelastic: P = A * Q^(-1/ε)
   */
  static calculatePriceWithDemand(
    totalQuantity: number,
    demand: RealizedParameters['demand']
  ): number {
    if (demand.type === 'linear') {
      const a = demand.intercept ?? 100;
      const b = demand.slope ?? 1;
      return Math.max(0, a - b * totalQuantity);
    } else if (demand.type === 'isoelastic') {
      const A = demand.scale ?? 100;
      const epsilon = demand.elasticity ?? 2;
      // P = A * Q^(-1/ε)
      // When Q = 0, price is undefined (infinity), so return a large value
      if (totalQuantity <= 0) {
        return A * 1000; // Large price for zero quantity
      }
      return A * Math.pow(totalQuantity, -1 / epsilon);
    }
    return 0;
  }

  /**
   * Calculate differentiated market price for firm i using realized parameters.
   * For linear demand: p_i = a - b*(q_i + γ*Σq_j)
   * For isoelastic demand: p_i = A * (q_i + γ*Σq_j)^(-1/ε)
   */
  static calculateDifferentiatedPriceWithDemand(
    firmIndex: number,
    quantities: number[],
    demand: RealizedParameters['demand'],
    gamma: number
  ): number {
    const n = quantities.length;
    const ownQuantity = quantities[firmIndex];
    let otherQuantitiesSum = 0;
    for (let j = 0; j < n; j++) {
      if (j !== firmIndex) {
        otherQuantitiesSum += quantities[j];
      }
    }

    // Effective quantity for this firm's price
    const effectiveQ = ownQuantity + gamma * otherQuantitiesSum;

    if (demand.type === 'linear') {
      const a = demand.intercept ?? 100;
      const b = demand.slope ?? 1;
      return Math.max(0, a - b * effectiveQ);
    } else if (demand.type === 'isoelastic') {
      const A = demand.scale ?? 100;
      const epsilon = demand.elasticity ?? 2;
      if (effectiveQ <= 0) {
        return A * 1000;
      }
      return A * Math.pow(effectiveQ, -1 / epsilon);
    }
    return 0;
  }

  /**
   * Calculate cost for a firm
   * C_i(q_i) = c_i * q_i + d_i * q_i^2
   */
  static calculateCost(
    quantity: number,
    linearCost: number,
    quadraticCost: number
  ): number {
    return linearCost * quantity + quadraticCost * quantity * quantity;
  }

  /**
   * Calculate profit for a firm given quantities
   * π_i = P(Q) * q_i - C_i(q_i)
   */
  static calculateProfit(
    ownQuantity: number,
    totalQuantity: number,
    linearCost: number,
    quadraticCost: number,
    config: CournotConfig
  ): number {
    const price = this.calculateMarketPrice(totalQuantity, config);
    const revenue = price * ownQuantity;
    const cost = this.calculateCost(ownQuantity, linearCost, quadraticCost);
    return revenue - cost;
  }

  /**
   * Calculate Nash equilibrium for asymmetric Cournot duopoly with quadratic costs
   *
   * Given:
   * - Demand: P = a - b*Q where Q = q1 + q2
   * - Costs: C_i = c_i * q_i + d_i * q_i^2
   *
   * FOC for firm 1: a - c1 - 2*(b + d1)*q1 - b*q2 = 0
   * FOC for firm 2: a - c2 - 2*(b + d2)*q2 - b*q1 = 0
   *
   * Solution:
   * q1* = (α1*β2 - b*α2) / (β1*β2 - b²)
   * q2* = (α2*β1 - b*α1) / (β1*β2 - b²)
   *
   * where: α_i = a - c_i, β_i = 2*(b + d_i)
   */
  static calculateNashEquilibrium(config: CournotConfig): NashEquilibrium {
    const { demandIntercept: a, demandSlope: b } = config;
    const { firm1LinearCost: c1, firm1QuadraticCost: d1 } = config;
    const { firm2LinearCost: c2, firm2QuadraticCost: d2 } = config;

    // Calculate intermediate values
    const alpha1 = a - c1;
    const alpha2 = a - c2;
    const beta1 = 2 * (b + d1);
    const beta2 = 2 * (b + d2);

    // Calculate determinant
    const det = beta1 * beta2 - b * b;

    if (det <= 0) {
      throw new Error('Invalid parameters: determinant is non-positive');
    }

    // Calculate Nash equilibrium quantities
    let q1Star = (alpha1 * beta2 - b * alpha2) / det;
    let q2Star = (alpha2 * beta1 - b * alpha1) / det;

    // Ensure non-negative quantities
    q1Star = Math.max(0, q1Star);
    q2Star = Math.max(0, q2Star);

    // Calculate equilibrium outcomes
    const totalQuantity = q1Star + q2Star;
    const marketPrice = this.calculateMarketPrice(totalQuantity, config);
    const firm1Profit = this.calculateProfit(q1Star, totalQuantity, c1, d1, config);
    const firm2Profit = this.calculateProfit(q2Star, totalQuantity, c2, d2, config);

    return {
      firm1Quantity: q1Star,
      firm2Quantity: q2Star,
      totalQuantity,
      marketPrice,
      firm1Profit,
      firm2Profit,
    };
  }

  /**
   * Calculate cooperative equilibrium (multiplant monopoly)
   *
   * The monopolist maximizes total profit:
   * π = (a - b*Q)*Q - C_1(q_1) - C_2(q_2)
   *
   * FOC: MR = MC_1 = MC_2
   * a - 2b*Q = c_1 + 2*d_1*q_1 = c_2 + 2*d_2*q_2
   */
  static calculateCooperativeEquilibrium(config: CournotConfig): CooperativeEquilibrium {
    const { demandIntercept: a, demandSlope: b } = config;
    const { firm1LinearCost: c1, firm1QuadraticCost: d1 } = config;
    const { firm2LinearCost: c2, firm2QuadraticCost: d2 } = config;

    let q1Coop: number;
    let q2Coop: number;
    let totalQuantity: number;

    // Case 1: Both firms have quadratic costs (d1 > 0 and d2 > 0)
    if (d1 > 0 && d2 > 0) {
      const gamma1 = 1 / (2 * d1);
      const gamma2 = 1 / (2 * d2);
      const gammaSum = gamma1 + gamma2;

      // Q = [(γ1 + γ2)*a - γ1*c1 - γ2*c2] / [1 + 2b*(γ1 + γ2)]
      totalQuantity = (gammaSum * a - gamma1 * c1 - gamma2 * c2) / (1 + 2 * b * gammaSum);
      totalQuantity = Math.max(0, totalQuantity);

      // q_i = (a - 2b*Q - c_i) / (2*d_i)
      q1Coop = Math.max(0, (a - 2 * b * totalQuantity - c1) / (2 * d1));
      q2Coop = Math.max(0, (a - 2 * b * totalQuantity - c2) / (2 * d2));
    }
    // Case 2: Only firm 1 has quadratic costs
    else if (d1 > 0 && d2 === 0) {
      // Firm 2 has constant MC = c2
      // If c2 < a - 2b*Q at optimum, firm 2 produces everything
      // Otherwise, use firm 1
      const q2Only = (a - c2) / (2 * b);
      const mc2AtQ2Only = c2;
      const mrAtQ2Only = a - 2 * b * q2Only;

      if (mrAtQ2Only >= c1) {
        // Use both firms or just firm 2
        q2Coop = q2Only;
        q1Coop = 0;
        totalQuantity = q2Coop;
      } else {
        // Mixed solution - complex, approximate with firm 1 only for simplicity
        totalQuantity = (a - c1) / (2 * (b + d1));
        q1Coop = totalQuantity;
        q2Coop = 0;
      }
    }
    // Case 3: Only firm 2 has quadratic costs
    else if (d1 === 0 && d2 > 0) {
      const q1Only = (a - c1) / (2 * b);
      const mrAtQ1Only = a - 2 * b * q1Only;

      if (mrAtQ1Only >= c2) {
        q1Coop = q1Only;
        q2Coop = 0;
        totalQuantity = q1Coop;
      } else {
        totalQuantity = (a - c2) / (2 * (b + d2));
        q2Coop = totalQuantity;
        q1Coop = 0;
      }
    }
    // Case 4: Both firms have linear costs only (d1 = d2 = 0)
    else {
      // Monopolist uses only the lower cost plant
      if (c1 < c2) {
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
    const marketPrice = this.calculateMarketPrice(totalQuantity, config);
    const firm1Profit = this.calculateProfit(q1Coop, totalQuantity, c1, d1, config);
    const firm2Profit = this.calculateProfit(q2Coop, totalQuantity, c2, d2, config);
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

  /**
   * Calculate round results given firm decisions
   */
  static calculateRoundResult(
    roundNumber: number,
    firm1Quantity: number,
    firm2Quantity: number,
    config: CournotConfig,
    firm1Reasoning?: string,
    firm2Reasoning?: string
  ): RoundResult {
    // Apply quantity constraints if specified
    let q1 = firm1Quantity;
    let q2 = firm2Quantity;

    if (config.minQuantity !== undefined) {
      q1 = Math.max(config.minQuantity, q1);
      q2 = Math.max(config.minQuantity, q2);
    }
    if (config.maxQuantity !== undefined) {
      q1 = Math.min(config.maxQuantity, q1);
      q2 = Math.min(config.maxQuantity, q2);
    }

    const totalQuantity = q1 + q2;
    const marketPrice = this.calculateMarketPrice(totalQuantity, config);
    const firm1Profit = this.calculateProfit(
      q1,
      totalQuantity,
      config.firm1LinearCost,
      config.firm1QuadraticCost,
      config
    );
    const firm2Profit = this.calculateProfit(
      q2,
      totalQuantity,
      config.firm2LinearCost,
      config.firm2QuadraticCost,
      config
    );

    return {
      roundNumber,
      firm1Quantity: q1,
      firm2Quantity: q2,
      totalQuantity,
      marketPrice,
      firm1Profit,
      firm2Profit,
      firm1Reasoning,
      firm2Reasoning,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate summary statistics for a completed game
   */
  static calculateGameSummary(rounds: RoundResult[], nash: NashEquilibrium) {
    const n = rounds.length;
    if (n === 0) {
      return {
        totalFirm1Profit: 0,
        totalFirm2Profit: 0,
        avgFirm1Quantity: 0,
        avgFirm2Quantity: 0,
        avgMarketPrice: 0,
        nashDeviation: {
          firm1QuantityDeviation: 0,
          firm2QuantityDeviation: 0,
        },
      };
    }

    const totalFirm1Profit = rounds.reduce((sum, r) => sum + r.firm1Profit, 0);
    const totalFirm2Profit = rounds.reduce((sum, r) => sum + r.firm2Profit, 0);
    const avgFirm1Quantity = rounds.reduce((sum, r) => sum + r.firm1Quantity, 0) / n;
    const avgFirm2Quantity = rounds.reduce((sum, r) => sum + r.firm2Quantity, 0) / n;
    const avgMarketPrice = rounds.reduce((sum, r) => sum + r.marketPrice, 0) / n;

    // Calculate average deviation from Nash equilibrium
    const firm1QuantityDeviation = Math.abs(avgFirm1Quantity - nash.firm1Quantity);
    const firm2QuantityDeviation = Math.abs(avgFirm2Quantity - nash.firm2Quantity);

    return {
      totalFirm1Profit,
      totalFirm2Profit,
      avgFirm1Quantity,
      avgFirm2Quantity,
      avgMarketPrice,
      nashDeviation: {
        firm1QuantityDeviation,
        firm2QuantityDeviation,
      },
    };
  }

  /**
   * Calculate best response quantity for a firm given opponent's quantity
   * Used for analysis and comparison
   */
  static calculateBestResponse(
    opponentQuantity: number,
    linearCost: number,
    quadraticCost: number,
    config: CournotConfig
  ): number {
    const { demandIntercept: a, demandSlope: b } = config;

    // Best response: q_i = (a - c_i - b*q_j) / (2*(b + d_i))
    const numerator = a - linearCost - b * opponentQuantity;
    const denominator = 2 * (b + quadraticCost);

    return Math.max(0, numerator / denominator);
  }

  // ============================================
  // N-FIRM OLIGOPOLY METHODS (Zanchettin 2006)
  // ============================================

  /**
   * Solve a linear system Ax = b using Gaussian elimination with partial pivoting
   * Returns the solution vector x, or null if no unique solution exists
   */
  static solveLinearSystem(A: number[][], b: number[]): number[] | null {
    const n = A.length;

    // Create augmented matrix [A|b]
    const aug: number[][] = A.map((row, i) => [...row, b[i]]);

    // Forward elimination with partial pivoting
    for (let col = 0; col < n; col++) {
      // Find pivot
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
          maxRow = row;
        }
      }

      // Swap rows
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

      // Check for singular matrix
      if (Math.abs(aug[col][col]) < 1e-10) {
        return null;
      }

      // Eliminate column
      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }

    // Back substitution
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
   * Calculate differentiated market price for firm i (Singh & Vives model)
   * p_i = α - q_i - γ * Σ(q_j, j≠i)
   *
   * With homogeneous products (γ=1), this reduces to p = α - Q
   */
  static calculateDifferentiatedPrice(
    firmIndex: number,
    quantities: number[],
    config: CournotConfig
  ): number {
    const { demandIntercept: a, demandSlope: b } = config;
    const gamma = getGamma(config);
    const n = quantities.length;

    const ownQuantity = quantities[firmIndex];
    let otherQuantitiesSum = 0;
    for (let j = 0; j < n; j++) {
      if (j !== firmIndex) {
        otherQuantitiesSum += quantities[j];
      }
    }

    // p_i = a - b*(q_i + γ*Σq_j)
    const price = a - b * (ownQuantity + gamma * otherQuantitiesSum);
    return Math.max(0, price);
  }

  /**
   * Calculate Nash-Cournot equilibrium for N firms with product differentiation
   *
   * FOC for firm i: ∂π_i/∂q_i = α - c_i - 2(b + d_i)q_i - γb*Σq_j = 0
   *
   * This forms a linear system: A*q = B
   * where A[i][i] = 2(b + d_i) and A[i][j] = γb for i≠j
   *
   * Note: This method only works for linear demand. For isoelastic demand,
   * returns an equilibrium with calculable=false.
   */
  static calculateNashCournotNFirms(config: CournotConfig): NPolyEquilibrium {
    const demandType = getDemandFunctionType(config);
    const numFirms = getNumFirms(config);

    // For isoelastic demand, Nash equilibrium is not analytically calculable
    if (demandType === 'isoelastic') {
      return {
        competitionMode: 'cournot',
        firms: Array.from({ length: numFirms }, (_, i) => ({
          firmId: i + 1,
          quantity: NaN,
          profit: NaN,
        })),
        totalQuantity: NaN,
        marketPrices: [],
        avgMarketPrice: NaN,
        totalProfit: NaN,
        calculable: false,
        message: 'Nash equilibrium not analytically calculable for isoelastic demand',
      };
    }

    const { demandIntercept: a, demandSlope: b } = config;
    const gamma = getGamma(config);

    // Build coefficient matrix A and vector B
    const A: number[][] = [];
    const B: number[] = [];

    for (let i = 0; i < numFirms; i++) {
      const firmConfig = getFirmConfig(config, i + 1);
      const c_i = firmConfig.linearCost;
      const d_i = firmConfig.quadraticCost;

      // α_i = a - c_i (effective demand intercept for firm i)
      const alpha_i = a - c_i;
      B.push(alpha_i);

      // Build row i of matrix A
      const row: number[] = [];
      for (let j = 0; j < numFirms; j++) {
        if (i === j) {
          // Diagonal: 2(b + d_i)
          row.push(2 * (b + d_i));
        } else {
          // Off-diagonal: γb
          row.push(gamma * b);
        }
      }
      A.push(row);
    }

    // Solve the system
    const solution = this.solveLinearSystem(A, B);

    if (!solution) {
      throw new Error('Could not solve N-firm Cournot equilibrium system');
    }

    // Ensure non-negative quantities
    const quantities = solution.map(q => Math.max(0, q));

    // Calculate prices and profits for each firm
    const firms: NPolyEquilibrium['firms'] = [];
    const marketPrices: number[] = [];
    let totalQuantity = 0;
    let totalProfit = 0;

    for (let i = 0; i < numFirms; i++) {
      const q_i = quantities[i];
      totalQuantity += q_i;

      const price_i = this.calculateDifferentiatedPrice(i, quantities, config);
      marketPrices.push(price_i);

      const firmConfig = getFirmConfig(config, i + 1);
      const cost_i = this.calculateCost(q_i, firmConfig.linearCost, firmConfig.quadraticCost);
      const profit_i = price_i * q_i - cost_i;
      totalProfit += profit_i;

      firms.push({
        firmId: i + 1,
        quantity: q_i,
        profit: profit_i,
      });
    }

    const avgMarketPrice = marketPrices.reduce((sum, p) => sum + p, 0) / numFirms;

    return {
      competitionMode: 'cournot',
      firms,
      totalQuantity,
      marketPrices,
      avgMarketPrice,
      totalProfit,
      calculable: true,
    };
  }

  /**
   * Calculate Nash-Bertrand equilibrium for N firms with differentiated products
   *
   * Direct demand: q_i = (1/(1+(n-1)γ)) * [a(1-γ) + γΣα_j - (1+(n-2)γ)p_i + γΣp_j] / b
   * (Simplified for symmetric α case)
   *
   * FOC: ∂π_i/∂p_i = q_i + (p_i - MC_i) * ∂q_i/∂p_i = 0
   *
   * Note: This method only works for linear demand. For isoelastic demand,
   * returns an equilibrium with calculable=false.
   */
  static calculateNashBertrandNFirms(config: CournotConfig): NPolyEquilibrium {
    const demandType = getDemandFunctionType(config);
    const numFirms = getNumFirms(config);

    // For isoelastic demand, Nash equilibrium is not analytically calculable
    if (demandType === 'isoelastic') {
      return {
        competitionMode: 'bertrand',
        firms: Array.from({ length: numFirms }, (_, i) => ({
          firmId: i + 1,
          quantity: NaN,
          price: NaN,
          profit: NaN,
        })),
        totalQuantity: NaN,
        marketPrices: [],
        avgMarketPrice: NaN,
        totalProfit: NaN,
        calculable: false,
        message: 'Nash equilibrium not analytically calculable for isoelastic demand',
      };
    }

    const { demandIntercept: a, demandSlope: b } = config;
    const gamma = getGamma(config);

    // For Bertrand with differentiation, we need γ < 1 for interior solution
    // With γ = 1 (homogeneous), Bertrand leads to p = MC (perfect competition)

    if (gamma >= 0.9999) {
      // Homogeneous Bertrand: price = lowest marginal cost
      let minMC = Infinity;
      let minMCFirmIndex = 0;

      for (let i = 0; i < numFirms; i++) {
        const firmConfig = getFirmConfig(config, i + 1);
        // MC at q=0 is just c_i (for linear cost portion)
        if (firmConfig.linearCost < minMC) {
          minMC = firmConfig.linearCost;
          minMCFirmIndex = i;
        }
      }

      // All firms price at minMC, demand split (or all goes to lowest cost)
      const firms: NPolyEquilibrium['firms'] = [];
      const marketPrices: number[] = [];
      const price = minMC;
      const totalQ = (a - price) / b;

      for (let i = 0; i < numFirms; i++) {
        const firmConfig = getFirmConfig(config, i + 1);
        // In perfect Bertrand, typically lowest cost firm gets all demand
        // For simulation purposes, we'll split equally if costs are equal
        const isLowestCost = firmConfig.linearCost === minMC;
        const numLowest = Array.from({ length: numFirms }, (_, j) =>
          getFirmConfig(config, j + 1).linearCost === minMC ? 1 : 0
        ).reduce((a: number, b: number) => a + b, 0);

        const q_i = isLowestCost ? totalQ / numLowest : 0;
        const profit_i = (price - firmConfig.linearCost) * q_i - firmConfig.quadraticCost * q_i * q_i;

        firms.push({
          firmId: i + 1,
          quantity: q_i,
          price: price,
          profit: profit_i,
        });
        marketPrices.push(price);
      }

      return {
        competitionMode: 'bertrand',
        firms,
        totalQuantity: totalQ,
        marketPrices,
        avgMarketPrice: price,
        totalProfit: firms.reduce((sum, f) => sum + f.profit, 0),
        calculable: true,
      };
    }

    // Differentiated Bertrand: Build and solve the FOC system
    // For firm i: p_i = (a(1-γ) + c_i*(1+(n-2)γ) + γΣp_j) / (2*(1+(n-2)γ))
    // This forms a linear system in prices

    const A: number[][] = [];
    const B: number[] = [];

    const denom = 1 + (numFirms - 2) * gamma;

    for (let i = 0; i < numFirms; i++) {
      const firmConfig = getFirmConfig(config, i + 1);
      const c_i = firmConfig.linearCost;

      // RHS: a(1-γ) + c_i*(1+(n-2)γ)
      B.push(a * (1 - gamma) + c_i * denom);

      // Build row
      const row: number[] = [];
      for (let j = 0; j < numFirms; j++) {
        if (i === j) {
          row.push(2 * denom);
        } else {
          row.push(-gamma);
        }
      }
      A.push(row);
    }

    const solution = this.solveLinearSystem(A, B);

    if (!solution) {
      throw new Error('Could not solve N-firm Bertrand equilibrium system');
    }

    // Prices
    const prices = solution.map(p => Math.max(0, p));

    // Calculate quantities from prices using direct demand
    const firms: NPolyEquilibrium['firms'] = [];
    let totalQuantity = 0;
    let totalProfit = 0;

    for (let i = 0; i < numFirms; i++) {
      const p_i = prices[i];

      // Direct demand with differentiation
      let otherPricesSum = 0;
      for (let j = 0; j < numFirms; j++) {
        if (j !== i) otherPricesSum += prices[j];
      }

      // q_i = [a - p_i + γ/(1-γ) * (avg_p_j - p_i)] / b  (simplified)
      // More precisely: q_i = (a - p_i - γ*(a - p̄)) / (b*(1-γ²)) where p̄ = avg other prices
      const avgOtherPrice = numFirms > 1 ? otherPricesSum / (numFirms - 1) : p_i;
      const q_i = Math.max(0, (a * (1 - gamma) - p_i * (1 - gamma * gamma / (numFirms > 1 ? 1 : 1)) + gamma * (avgOtherPrice - p_i * gamma)) / (b * (1 - gamma * gamma)));

      // Simpler formula for symmetric case: q_i = (a - p_i - γ*(n-1)*(p̄ - p_i)/(n-1)) / b
      // Let's use a cleaner formulation
      const q_i_clean = Math.max(0, (a - p_i - gamma * (otherPricesSum - (numFirms - 1) * p_i) / (numFirms > 1 ? numFirms - 1 : 1)) / b);

      totalQuantity += q_i_clean;

      const firmConfig = getFirmConfig(config, i + 1);
      const cost_i = this.calculateCost(q_i_clean, firmConfig.linearCost, firmConfig.quadraticCost);
      const profit_i = p_i * q_i_clean - cost_i;
      totalProfit += profit_i;

      firms.push({
        firmId: i + 1,
        quantity: q_i_clean,
        price: p_i,
        profit: profit_i,
      });
    }

    return {
      competitionMode: 'bertrand',
      firms,
      totalQuantity,
      marketPrices: prices,
      avgMarketPrice: prices.reduce((sum, p) => sum + p, 0) / numFirms,
      totalProfit,
      calculable: true,
    };
  }

  /**
   * Analyze limit-pricing regions (Zanchettin 2006)
   * Only applicable for duopoly (n=2)
   *
   * Asymmetry index: a = (α₁-c₁) - (α₂-c₂) normalized by demand
   * Limit-pricing region: 1 - γ/(2-γ²) ≤ a < 1 - γ/2
   * Monopoly region: a ≥ 1 - γ/2
   */
  static analyzeLimitPricing(config: CournotConfig): LimitPricingAnalysis {
    const { demandIntercept: a } = config;
    const gamma = getGamma(config);
    const numFirms = getNumFirms(config);

    if (numFirms !== 2) {
      return {
        asymmetryIndex: 0,
        limitPricingThresholdLow: 0,
        limitPricingThresholdHigh: 0,
        isInLimitPricingRegion: false,
        isInMonopolyRegion: false,
        analysisMessage: 'Limit-pricing analysis only applicable for duopoly (n=2)',
      };
    }

    const firm1 = getFirmConfig(config, 1);
    const firm2 = getFirmConfig(config, 2);

    // Effective demand intercepts
    const alpha1 = a - firm1.linearCost;
    const alpha2 = a - firm2.linearCost;

    // Normalize asymmetry by one firm's effective demand (using firm 2 as reference)
    // a = (α₁ - α₂) / α₂ = (c₂ - c₁) / (a - c₂)
    const asymmetryIndex = alpha2 !== 0 ? (alpha1 - alpha2) / alpha2 : 0;

    // Thresholds from Zanchettin (2006)
    // Lower: 1 - γ/(2-γ²)
    const limitPricingThresholdLow = 1 - gamma / (2 - gamma * gamma);
    // Upper: 1 - γ/2
    const limitPricingThresholdHigh = 1 - gamma / 2;

    const isInLimitPricingRegion =
      asymmetryIndex >= limitPricingThresholdLow &&
      asymmetryIndex < limitPricingThresholdHigh;

    const isInMonopolyRegion = asymmetryIndex >= limitPricingThresholdHigh;

    let dominantFirm: number | undefined;
    let analysisMessage: string;

    if (isInMonopolyRegion) {
      dominantFirm = alpha1 > alpha2 ? 1 : 2;
      analysisMessage = `Monopoly region: Firm ${dominantFirm} has sufficient cost advantage to monopolize the market (weak firm exits).`;
    } else if (isInLimitPricingRegion) {
      dominantFirm = alpha1 > alpha2 ? 1 : 2;
      analysisMessage = `Limit-pricing region: Firm ${dominantFirm} can engage in limit pricing to constrain Firm ${dominantFirm === 1 ? 2 : 1}.`;
    } else {
      analysisMessage = 'Interior duopoly region: Both firms compete actively in the market.';
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

  /**
   * Calculate N-poly equilibrium based on competition mode
   */
  static calculateNPolyEquilibrium(config: CournotConfig): NPolyEquilibrium {
    const mode = getCompetitionMode(config);

    if (mode === 'bertrand') {
      return this.calculateNashBertrandNFirms(config);
    } else {
      return this.calculateNashCournotNFirms(config);
    }
  }

  /**
   * Calculate round result for N firms.
   * Supports both linear and isoelastic demand functions via realized parameters.
   */
  static calculateNPolyRoundResult(
    roundNumber: number,
    decisions: { firmId: number; quantity?: number; price?: number; reasoning?: string; systemPrompt?: string; roundPrompt?: string }[],
    config: CournotConfig,
    realizedParams?: RealizedParameters
  ): RoundResult {
    const numFirms = getNumFirms(config);
    const mode = getCompetitionMode(config);

    // Use realized parameters if provided, otherwise fall back to config
    const gamma = realizedParams?.gamma ?? getGamma(config);
    const demand = realizedParams?.demand ?? {
      type: 'linear' as DemandFunctionType,
      intercept: config.demandIntercept,
      slope: config.demandSlope,
    };

    const firmResults: FirmRoundResult[] = [];
    const quantities: number[] = [];
    const prices: number[] = [];

    // First pass: collect all quantities/prices
    for (let i = 0; i < numFirms; i++) {
      const decision = decisions.find(d => d.firmId === i + 1) || { firmId: i + 1, quantity: 0 };

      let q = decision.quantity ?? 0;
      let p = decision.price;

      // Apply constraints
      if (config.minQuantity !== undefined) q = Math.max(config.minQuantity, q);
      if (config.maxQuantity !== undefined) q = Math.min(config.maxQuantity, q);
      if (p !== undefined) {
        if (config.minPrice !== undefined) p = Math.max(config.minPrice, p);
        if (config.maxPrice !== undefined) p = Math.min(config.maxPrice, p);
      }

      quantities.push(q);
      if (p !== undefined) prices.push(p);
    }

    // Second pass: calculate prices (if Cournot) or quantities (if Bertrand) and profits
    const marketPrices: number[] = [];
    let totalQuantity = 0;

    for (let i = 0; i < numFirms; i++) {
      // Get costs from realized params or config
      const realizedCost = realizedParams?.firmCosts?.find(c => c.firmId === i + 1);
      const configFirm = getFirmConfig(config, i + 1);
      const linearCost = realizedCost?.linearCost ?? configFirm.linearCost;
      const quadraticCost = realizedCost?.quadraticCost ?? configFirm.quadraticCost;

      const decision = decisions.find(d => d.firmId === i + 1);

      let q_i: number;
      let p_i: number;

      if (mode === 'cournot') {
        q_i = quantities[i];
        // Use demand-aware price calculation
        p_i = this.calculateDifferentiatedPriceWithDemand(i, quantities, demand, gamma);
      } else {
        // Bertrand: price is the decision, calculate quantity from demand
        p_i = prices[i] ?? linearCost;  // Default to MC if no price

        // Calculate quantity from demand function with differentiation
        let otherPricesSum = 0;
        for (let j = 0; j < numFirms; j++) {
          if (j !== i) otherPricesSum += (prices[j] ?? p_i);
        }
        const avgOtherPrice = numFirms > 1 ? otherPricesSum / (numFirms - 1) : p_i;

        // Calculate quantity based on demand type
        if (demand.type === 'linear') {
          const a = demand.intercept ?? config.demandIntercept;
          const b = demand.slope ?? config.demandSlope;
          q_i = Math.max(0, (a - p_i + gamma * (avgOtherPrice - p_i)) / b);
        } else {
          // Isoelastic: P = A * Q^(-1/ε), so Q = (P/A)^(-ε)
          const A = demand.scale ?? 100;
          const epsilon = demand.elasticity ?? 2;
          // Approximate demand for Bertrand with isoelastic demand
          q_i = Math.max(0, Math.pow(p_i / A, -epsilon));
        }
      }

      totalQuantity += q_i;
      marketPrices.push(p_i);

      const cost_i = this.calculateCost(q_i, linearCost, quadraticCost);
      const profit_i = p_i * q_i - cost_i;

      firmResults.push({
        firmId: i + 1,
        quantity: q_i,
        price: mode === 'bertrand' ? p_i : undefined,
        profit: profit_i,
        reasoning: decision?.reasoning,
        systemPrompt: decision?.systemPrompt,
        roundPrompt: decision?.roundPrompt,
      });
    }

    // Build legacy-compatible result (for duopoly)
    const avgPrice = marketPrices.reduce((sum, p) => sum + p, 0) / numFirms;

    return {
      roundNumber,
      // Legacy fields (use first two firms for backward compatibility)
      firm1Quantity: firmResults[0]?.quantity ?? 0,
      firm2Quantity: firmResults[1]?.quantity ?? 0,
      totalQuantity,
      marketPrice: avgPrice,
      firm1Profit: firmResults[0]?.profit ?? 0,
      firm2Profit: firmResults[1]?.profit ?? 0,
      firm1Reasoning: firmResults[0]?.reasoning,
      firm2Reasoning: firmResults[1]?.reasoning,
      // Extended fields
      firmResults,
      marketPrices,
      timestamp: new Date(),
    };
  }
}
