import { CournotConfig, NashEquilibrium, RoundResult } from '../types';

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
}
