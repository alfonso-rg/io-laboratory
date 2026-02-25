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
  getFirmDemand,
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
   * Supports linear, CES, CES, logit, and exponential demand.
   *
   * Linear: P = a - b*Q
   * CES: P = A * Q^(-1/σ)
   * CES: P = A * Q^(-1/σ)
   * Logit: P = a - b * ln(Q)
   * Exponential: P = A * e^(-bQ)
   */
  static calculatePriceWithDemand(
    totalQuantity: number,
    demand: RealizedParameters['demand']
  ): number {
    if (demand.type === 'linear') {
      const a = demand.intercept ?? 100;
      const b = demand.slope ?? 1;
      return Math.max(0, a - b * totalQuantity);
    } else if (demand.type === 'ces') {
      const A = demand.scale ?? 100;
      const sigma = demand.substitutionElasticity ?? 2;
      // P = A * Q^(-1/σ)
      if (totalQuantity <= 0) {
        return A * 1000;
      }
      return A * Math.pow(totalQuantity, -1 / sigma);
    } else if (demand.type === 'logit') {
      const a = demand.intercept ?? 100;
      const b = demand.priceCoefficient ?? 10;
      // P = a - b * ln(Q)
      if (totalQuantity <= 0) {
        return a * 10; // Large price for zero quantity
      }
      return Math.max(0, a - b * Math.log(totalQuantity));
    } else if (demand.type === 'exponential') {
      const A = demand.scale ?? 100;
      const b = demand.decayRate ?? 0.01;
      // P = A * e^(-bQ)
      return A * Math.exp(-b * totalQuantity);
    }
    return 0;
  }

  /**
   * Calculate differentiated market price for firm i using realized parameters.
   * For linear demand: p_i = a - b*(q_i + γ*Σq_j)
   * For CES demand: p_i = A * (q_i + γ*Σq_j)^(-1/σ)
   * For logit demand: p_i = a - b * ln(q_i + γ*Σq_j)
   * For exponential demand: p_i = A * e^(-b*(q_i + γ*Σq_j))
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
    } else if (demand.type === 'ces') {
      const A = demand.scale ?? 100;
      const sigma = demand.substitutionElasticity ?? 2;
      if (effectiveQ <= 0) {
        return A * 1000;
      }
      return A * Math.pow(effectiveQ, -1 / sigma);
    } else if (demand.type === 'logit') {
      const a = demand.intercept ?? 100;
      const b = demand.priceCoefficient ?? 10;
      if (effectiveQ <= 0) {
        return a * 10;
      }
      return Math.max(0, a - b * Math.log(effectiveQ));
    } else if (demand.type === 'exponential') {
      const A = demand.scale ?? 100;
      const b = demand.decayRate ?? 0.01;
      return A * Math.exp(-b * effectiveQ);
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
   * Note: This method only works for linear demand. For CES demand,
   * returns an equilibrium with calculable=false.
   */
  static calculateNashCournotNFirms(
    config: CournotConfig,
    firmDemands?: { firmId: number; intercept?: number; slope?: number }[]
  ): NPolyEquilibrium {
    const demandType = getDemandFunctionType(config);
    const numFirms = getNumFirms(config);

    // For non-linear demand, Nash equilibrium is not analytically calculable
    if (demandType !== 'linear') {
      const demandTypeLabels: Record<string, string> = {
        CES: 'CES',
        ces: 'CES',
        logit: 'logit',
        exponential: 'exponential',
      };
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
        message: `Nash equilibrium not analytically calculable for ${demandTypeLabels[demandType] || demandType} demand`,
      };
    }

    const { demandIntercept: a_default, demandSlope: b_default } = config;
    const gamma = getGamma(config);

    // Build coefficient matrix A and vector B
    // With per-firm demand: p_i = a_i - b_i*(q_i + γ*Σq_j)
    // FOC: (a_i - c_i) = 2*(b_i + d_i)*q_i + γ*b_i*Σq_j
    const Amat: number[][] = [];
    const B: number[] = [];

    for (let i = 0; i < numFirms; i++) {
      const firmConfig = getFirmConfig(config, i + 1);
      const c_i = firmConfig.linearCost;
      const d_i = firmConfig.quadraticCost;

      // Per-firm demand parameters (or shared fallback)
      const fd = firmDemands?.find(d => d.firmId === i + 1);
      const a_i = fd?.intercept ?? a_default;
      const b_i = fd?.slope ?? b_default;

      const alpha_i = a_i - c_i;
      B.push(alpha_i);

      const row: number[] = [];
      for (let j = 0; j < numFirms; j++) {
        if (i === j) {
          row.push(2 * (b_i + d_i));
        } else {
          row.push(gamma * b_i);
        }
      }
      Amat.push(row);
    }

    const solution = this.solveLinearSystem(Amat, B);

    if (!solution) {
      throw new Error('Could not solve N-firm Cournot equilibrium system');
    }

    const quantities = solution.map(q => Math.max(0, q));

    // Calculate prices and profits for each firm
    const firms: NPolyEquilibrium['firms'] = [];
    const marketPrices: number[] = [];
    let totalQuantity = 0;
    let totalProfit = 0;

    for (let i = 0; i < numFirms; i++) {
      const q_i = quantities[i];
      totalQuantity += q_i;

      // Per-firm demand for price calculation
      const fd = firmDemands?.find(d => d.firmId === i + 1);
      const a_i = fd?.intercept ?? a_default;
      const b_i = fd?.slope ?? b_default;

      // p_i = a_i - b_i*(q_i + γ*Σq_j)
      let otherQSum = 0;
      for (let j = 0; j < numFirms; j++) {
        if (j !== i) otherQSum += quantities[j];
      }
      const price_i = Math.max(0, a_i - b_i * (q_i + gamma * otherQSum));
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
   * Note: This method only works for linear demand. For CES demand,
   * returns an equilibrium with calculable=false.
   */
  static calculateNashBertrandNFirms(
    config: CournotConfig,
    firmDemands?: { firmId: number; intercept?: number; slope?: number }[]
  ): NPolyEquilibrium {
    const demandType = getDemandFunctionType(config);
    const numFirms = getNumFirms(config);

    // For non-linear demand, Nash equilibrium is not analytically calculable
    if (demandType !== 'linear') {
      const demandTypeLabels: Record<string, string> = {
        CES: 'CES',
        ces: 'CES',
        logit: 'logit',
        exponential: 'exponential',
      };
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
        message: `Nash equilibrium not analytically calculable for ${demandTypeLabels[demandType] || demandType} demand`,
      };
    }

    const { demandIntercept: a, demandSlope: b } = config;
    const gamma = getGamma(config);

    // For Bertrand with quadratic costs (d_i > 0), the FOC produces a nonlinear system
    // in prices and quantities that cannot be solved analytically with this method.
    // Only d_i = 0 (linear costs) yields a tractable linear system.
    const hasQuadraticCosts = Array.from({ length: numFirms }, (_, i) =>
      getFirmConfig(config, i + 1).quadraticCost
    ).some(d => d > 0);

    if (hasQuadraticCosts) {
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
        message: 'Nash-Bertrand equilibrium is not analytically tractable with quadratic costs (d_i > 0)',
      };
    }

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
    // With per-firm demand p_i = a_i - b_i*(q_i + γ*Σq_j), the FOC gives a linear system in prices.
    // Build M matrix (inverse demand coefficients): M[i][i]=b_i, M[i][j]=γ*b_i
    // Then invert to get demand derivatives, and build FOC system.

    // For shared demand (all b_i equal), the simpler symmetric formula is used.
    // For per-firm demand, we use the general matrix approach.

    const usePerFirm = firmDemands && firmDemands.length > 0;

    if (usePerFirm) {
      // General per-firm Bertrand Nash via matrix inversion
      // Inverse demand: P = A_vec - M*Q where M[i][i]=b_i, M[i][j]=γ*b_i
      // Direct demand: Q = M^{-1} * (A_vec - P)
      // Profit: π_i = (p_i - c_i) * q_i(p) where q_i = Σ_j [M^{-1}]_{ij}*(a_j - p_j)
      // FOC: q_i - [M^{-1}]_{ii} * (p_i - c_i) = 0
      // => Σ_j [M^{-1}]_{ij}*(a_j - p_j) = [M^{-1}]_{ii} * (p_i - c_i)
      // => 2*[M^{-1}]_{ii}*p_i + Σ_{j≠i} [M^{-1}]_{ij}*p_j = Σ_j [M^{-1}]_{ij}*a_j + [M^{-1}]_{ii}*c_i

      // Step 1: Build M matrix
      const M: number[][] = [];
      const A_vec: number[] = [];
      for (let i = 0; i < numFirms; i++) {
        const fd = firmDemands.find(d => d.firmId === i + 1);
        const b_i = fd?.slope ?? b;
        const a_i = fd?.intercept ?? a;
        A_vec.push(a_i);
        const row: number[] = [];
        for (let j = 0; j < numFirms; j++) {
          row.push(i === j ? b_i : gamma * b_i);
        }
        M.push(row);
      }

      // Step 2: Compute M^{-1} by solving M * x_col = e_col for each column
      const Minv: number[][] = Array.from({ length: numFirms }, () => new Array(numFirms).fill(0));
      for (let col = 0; col < numFirms; col++) {
        const e = new Array(numFirms).fill(0);
        e[col] = 1;
        const x = this.solveLinearSystem(M, e);
        if (!x) {
          return {
            competitionMode: 'bertrand', firms: [], totalQuantity: 0,
            marketPrices: [], avgMarketPrice: 0, totalProfit: 0,
            calculable: false, message: 'Could not invert demand matrix for per-firm Bertrand',
          };
        }
        for (let row = 0; row < numFirms; row++) {
          Minv[row][col] = x[row];
        }
      }

      // Step 3: Build FOC linear system in prices
      // 2*Minv[i][i]*p_i + Σ_{j≠i} Minv[i][j]*p_j = Σ_j Minv[i][j]*a_j + Minv[i][i]*c_i
      const Amat: number[][] = [];
      const Bvec: number[] = [];
      for (let i = 0; i < numFirms; i++) {
        const firmConfig = getFirmConfig(config, i + 1);
        const c_i = firmConfig.linearCost;
        let rhs = Minv[i][i] * c_i;
        for (let j = 0; j < numFirms; j++) {
          rhs += Minv[i][j] * A_vec[j];
        }
        Bvec.push(rhs);
        const row: number[] = [];
        for (let j = 0; j < numFirms; j++) {
          row.push(i === j ? 2 * Minv[i][i] : Minv[i][j]);
        }
        Amat.push(row);
      }

      const priceSolution = this.solveLinearSystem(Amat, Bvec);
      if (!priceSolution) {
        return {
          competitionMode: 'bertrand', firms: [], totalQuantity: 0,
          marketPrices: [], avgMarketPrice: 0, totalProfit: 0,
          calculable: false, message: 'Could not solve per-firm Bertrand Nash system',
        };
      }

      const eqPrices = priceSolution.map(p => Math.max(0, p));

      // Step 4: Get quantities from Q = M^{-1} * (A_vec - P)
      const diff = A_vec.map((a_i, i) => a_i - eqPrices[i]);
      const eqQuantities: number[] = [];
      for (let i = 0; i < numFirms; i++) {
        let q_i = 0;
        for (let j = 0; j < numFirms; j++) {
          q_i += Minv[i][j] * diff[j];
        }
        eqQuantities.push(Math.max(0, q_i));
      }

      const firms: NPolyEquilibrium['firms'] = [];
      let totalQuantity = 0;
      let totalProfit = 0;
      for (let i = 0; i < numFirms; i++) {
        const firmConfig = getFirmConfig(config, i + 1);
        const cost_i = this.calculateCost(eqQuantities[i], firmConfig.linearCost, firmConfig.quadraticCost);
        const profit_i = eqPrices[i] * eqQuantities[i] - cost_i;
        totalQuantity += eqQuantities[i];
        totalProfit += profit_i;
        firms.push({ firmId: i + 1, quantity: eqQuantities[i], price: eqPrices[i], profit: profit_i });
      }

      return {
        competitionMode: 'bertrand',
        firms,
        totalQuantity,
        marketPrices: eqPrices,
        avgMarketPrice: eqPrices.reduce((s, p) => s + p, 0) / numFirms,
        totalProfit,
        calculable: true,
      };
    }

    // Shared demand: use simpler symmetric formula
    const Amat: number[][] = [];
    const Bvec: number[] = [];

    const denom = 1 + (numFirms - 2) * gamma;

    for (let i = 0; i < numFirms; i++) {
      const firmConfig = getFirmConfig(config, i + 1);
      const c_i = firmConfig.linearCost;

      Bvec.push(a * (1 - gamma) + c_i * denom);

      const row: number[] = [];
      for (let j = 0; j < numFirms; j++) {
        if (i === j) {
          row.push(2 * denom);
        } else {
          row.push(-gamma);
        }
      }
      Amat.push(row);
    }

    const solution = this.solveLinearSystem(Amat, Bvec);

    if (!solution) {
      throw new Error('Could not solve N-firm Bertrand equilibrium system');
    }

    const prices = solution.map(p => Math.max(0, p));

    const firms: NPolyEquilibrium['firms'] = [];
    let totalQuantity = 0;
    let totalProfit = 0;

    for (let i = 0; i < numFirms; i++) {
      const p_i = prices[i];

      let otherPricesSum = 0;
      for (let j = 0; j < numFirms; j++) {
        if (j !== i) otherPricesSum += prices[j];
      }

      const kappa = 1 + (numFirms - 2) * gamma;
      const demandDenominator = b * (1 - gamma) * (1 + (numFirms - 1) * gamma);
      const q_i = demandDenominator > 1e-10
        ? Math.max(0, (a * (1 - gamma) - p_i * kappa + gamma * otherPricesSum) / demandDenominator)
        : 0;

      totalQuantity += q_i;

      const firmConfig = getFirmConfig(config, i + 1);
      const cost_i = this.calculateCost(q_i, firmConfig.linearCost, firmConfig.quadraticCost);
      const profit_i = p_i * q_i - cost_i;
      totalProfit += profit_i;

      firms.push({
        firmId: i + 1,
        quantity: q_i,
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
  static calculateNPolyEquilibrium(
    config: CournotConfig,
    firmDemands?: { firmId: number; intercept?: number; slope?: number }[]
  ): NPolyEquilibrium {
    const mode = getCompetitionMode(config);

    if (mode === 'bertrand') {
      return this.calculateNashBertrandNFirms(config, firmDemands);
    } else {
      return this.calculateNashCournotNFirms(config, firmDemands);
    }
  }

  /**
   * Calculate round result for N firms.
   * Supports both linear and CES demand functions via realized parameters.
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

      // Get firm-specific demand (per-firm or shared fallback)
      const firmDemand = realizedParams ? getFirmDemand(realizedParams, i + 1) : demand;

      if (mode === 'cournot') {
        q_i = quantities[i];
        // Use demand-aware price calculation with firm-specific demand
        p_i = this.calculateDifferentiatedPriceWithDemand(i, quantities, firmDemand, gamma);
      } else {
        // Bertrand: price is the decision, calculate quantity from demand
        p_i = prices[i] ?? linearCost;  // Default to MC if no price

        // Calculate quantity based on demand type
        if (firmDemand.type === 'linear') {
          const a_i = firmDemand.intercept ?? config.demandIntercept;
          const b_i = firmDemand.slope ?? config.demandSlope;

          if (gamma >= 0.9999) {
            // Homogeneous Bertrand (γ≈1): lowest-price firm(s) get all demand
            const minPrice = Math.min(...prices.filter((p): p is number => p != null));
            if (Math.abs(p_i - minPrice) < 1e-6) {
              const numTied = prices.filter((p): p is number => p != null && Math.abs(p - minPrice) < 1e-6).length;
              const totalQ = Math.max(0, (a_i - minPrice) / b_i);
              q_i = totalQ / numTied;
            } else {
              q_i = 0;
            }
          } else if (realizedParams?.firmDemands) {
            // Per-firm demand with different b_i: use matrix inversion
            // Inverse demand: p_i = a_i - b_i*(q_i + γ*Σq_j)
            // => M*Q = A_vec - P where M[i][i]=b_i, M[i][j]=γ*b_i
            // Solve on last firm iteration (i === numFirms - 1) for all at once
            // For now set to 0, will be overwritten below
            q_i = 0;
          } else {
            // Shared demand: use Singh & Vives closed-form
            let otherPricesSum = 0;
            for (let j = 0; j < numFirms; j++) {
              if (j !== i) otherPricesSum += (prices[j] ?? p_i);
            }
            const kappa = 1 + (numFirms - 2) * gamma;
            const demandDenominator = b_i * (1 - gamma) * (1 + (numFirms - 1) * gamma);
            q_i = demandDenominator > 1e-10
              ? Math.max(0, (a_i * (1 - gamma) - p_i * kappa + gamma * otherPricesSum) / demandDenominator)
              : 0;
          }
        } else {
          // Non-linear: use firm-specific params for approximate demand
          const firmScale = firmDemand.scale ?? 100;
          const firmSigma = firmDemand.substitutionElasticity ?? 2;
          q_i = Math.max(0, Math.pow(p_i / firmScale, -firmSigma));
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

    // For Bertrand with per-firm linear demand: solve quantities via matrix inversion
    if (mode === 'bertrand' && realizedParams?.firmDemands && demand.type === 'linear' && gamma < 0.9999) {
      // Build M matrix: M[i][i] = b_i, M[i][j] = γ*b_i
      // Solve: M*Q = A_vec - P
      const M: number[][] = [];
      const rhs: number[] = [];
      for (let i = 0; i < numFirms; i++) {
        const fd = getFirmDemand(realizedParams, i + 1);
        const a_i = fd.intercept ?? config.demandIntercept;
        const b_i = fd.slope ?? config.demandSlope;
        rhs.push(a_i - (firmResults[i]?.price ?? prices[i] ?? 0));
        const row: number[] = [];
        for (let j = 0; j < numFirms; j++) {
          row.push(i === j ? b_i : gamma * b_i);
        }
        M.push(row);
      }
      const qSolution = this.solveLinearSystem(M, rhs);
      if (qSolution) {
        totalQuantity = 0;
        for (let i = 0; i < numFirms; i++) {
          const q_solved = Math.max(0, qSolution[i]);
          const p_solved = firmResults[i].price ?? marketPrices[i];
          const realizedCost = realizedParams?.firmCosts?.find(c => c.firmId === i + 1);
          const configFirm = getFirmConfig(config, i + 1);
          const lc = realizedCost?.linearCost ?? configFirm.linearCost;
          const qc = realizedCost?.quadraticCost ?? configFirm.quadraticCost;
          const cost = this.calculateCost(q_solved, lc, qc);
          firmResults[i] = {
            ...firmResults[i],
            quantity: q_solved,
            profit: p_solved * q_solved - cost,
          };
          totalQuantity += q_solved;
        }
      }
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
