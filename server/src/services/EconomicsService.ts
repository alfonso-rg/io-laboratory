import { CournotConfig, NashEquilibrium, CooperativeEquilibrium, RoundResult } from '../types';

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
}
