import {
  ParameterSpec,
  DemandConfig,
  RealizedParameters,
  CournotConfig,
  DemandFunctionType,
  getNumFirms,
  getGamma,
  getFirmConfig,
} from '../types';

/**
 * Service for generating random parameter values from various distributions.
 * Used for implementing random parameters in experiments.
 */
export class ParameterService {
  /**
   * Draw a random value from a standard normal distribution (mean=0, stdDev=1)
   * using the Box-Muller transform.
   */
  private static drawStandardNormal(): number {
    let u1 = 0;
    let u2 = 0;
    // Ensure u1 is not 0 to avoid log(0)
    while (u1 === 0) u1 = Math.random();
    while (u2 === 0) u2 = Math.random();

    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return z;
  }

  /**
   * Draw a value from a normal distribution with given mean and standard deviation.
   */
  private static drawNormal(mean: number, stdDev: number): number {
    return mean + stdDev * this.drawStandardNormal();
  }

  /**
   * Draw a value from a log-normal distribution.
   * The parameters mean and stdDev are the desired mean and stdDev of the
   * log-normal distribution (not the underlying normal).
   */
  private static drawLogNormal(mean: number, stdDev: number): number {
    // Convert log-normal mean/stdDev to underlying normal parameters
    // Using: E[X] = exp(mu + sigma^2/2) and Var[X] = (exp(sigma^2) - 1) * exp(2*mu + sigma^2)
    const variance = stdDev * stdDev;
    const meanSquared = mean * mean;

    const sigma2 = Math.log(1 + variance / meanSquared);
    const mu = Math.log(mean) - sigma2 / 2;
    const sigma = Math.sqrt(sigma2);

    return Math.exp(this.drawNormal(mu, sigma));
  }

  /**
   * Draw a single parameter value based on its specification.
   */
  static drawParameter(spec: ParameterSpec): number {
    switch (spec.type) {
      case 'fixed':
        return spec.value ?? 0;

      case 'uniform':
        const min = spec.min ?? 0;
        const max = spec.max ?? 1;
        return min + Math.random() * (max - min);

      case 'normal':
        const normalMean = spec.mean ?? 0;
        const normalStdDev = spec.stdDev ?? 1;
        return this.drawNormal(normalMean, normalStdDev);

      case 'lognormal':
        const lnMean = spec.mean ?? 1;
        const lnStdDev = spec.stdDev ?? 0.5;
        return this.drawLogNormal(lnMean, lnStdDev);

      default:
        return spec.value ?? 0;
    }
  }

  /**
   * Generate all realized parameters for a round/replication based on config.
   */
  static drawAllParameters(config: CournotConfig): RealizedParameters {
    const numFirms = getNumFirms(config);

    // Realize demand parameters
    let demand: RealizedParameters['demand'];

    if (config.demandFunction) {
      switch (config.demandFunction.type) {
        case 'linear':
          demand = {
            type: 'linear',
            intercept: this.drawParameter(config.demandFunction.intercept),
            slope: this.drawParameter(config.demandFunction.slope),
          };
          break;
        case 'ces':
          demand = {
            type: 'ces',
            scale: this.drawParameter(config.demandFunction.scale),
            substitutionElasticity: this.drawParameter(config.demandFunction.substitutionElasticity),
          };
          break;
        case 'logit':
          demand = {
            type: 'logit',
            intercept: this.drawParameter(config.demandFunction.intercept),
            priceCoefficient: this.drawParameter(config.demandFunction.priceCoefficient),
          };
          break;
        case 'exponential':
          demand = {
            type: 'exponential',
            scale: this.drawParameter(config.demandFunction.scale),
            decayRate: this.drawParameter(config.demandFunction.decayRate),
          };
          break;
        default:
          // Fallback to linear
          demand = {
            type: 'linear',
            intercept: config.demandIntercept,
            slope: config.demandSlope,
          };
      }
    } else {
      // Legacy: use fixed values from demandIntercept and demandSlope
      demand = {
        type: 'linear',
        intercept: config.demandIntercept,
        slope: config.demandSlope,
      };
    }

    // Realize gamma
    let gamma: number | undefined;
    if (config.gammaSpec) {
      gamma = this.drawParameter(config.gammaSpec);
      // Clamp gamma to [0, 1]
      gamma = Math.max(0, Math.min(1, gamma));
    } else {
      gamma = getGamma(config);
    }

    // Realize firm costs
    const firmCosts: RealizedParameters['firmCosts'] = [];

    for (let i = 0; i < numFirms; i++) {
      const firmId = i + 1;

      if (config.firmCostSpecs && config.firmCostSpecs[i]) {
        // Use random cost specs
        firmCosts.push({
          firmId,
          linearCost: Math.max(0, this.drawParameter(config.firmCostSpecs[i].linearCost)),
          quadraticCost: Math.max(0, this.drawParameter(config.firmCostSpecs[i].quadraticCost)),
        });
      } else {
        // Use fixed values from config
        const firmConfig = getFirmConfig(config, firmId);
        firmCosts.push({
          firmId,
          linearCost: firmConfig.linearCost,
          quadraticCost: firmConfig.quadraticCost,
        });
      }
    }

    return {
      demand,
      gamma,
      firmCosts,
    };
  }

  /**
   * Check if config has any random parameters (non-fixed specs).
   */
  static hasRandomParameters(config: CournotConfig): boolean {
    // Check demand function
    if (config.demandFunction) {
      switch (config.demandFunction.type) {
        case 'linear':
          if (config.demandFunction.intercept.type !== 'fixed') return true;
          if (config.demandFunction.slope.type !== 'fixed') return true;
          break;
        case 'ces':
          if (config.demandFunction.scale.type !== 'fixed') return true;
          if (config.demandFunction.substitutionElasticity.type !== 'fixed') return true;
          break;
        case 'logit':
          if (config.demandFunction.intercept.type !== 'fixed') return true;
          if (config.demandFunction.priceCoefficient.type !== 'fixed') return true;
          break;
        case 'exponential':
          if (config.demandFunction.scale.type !== 'fixed') return true;
          if (config.demandFunction.decayRate.type !== 'fixed') return true;
          break;
      }
    }

    // Check gamma
    if (config.gammaSpec && config.gammaSpec.type !== 'fixed') return true;

    // Check firm costs
    if (config.firmCostSpecs) {
      for (const spec of config.firmCostSpecs) {
        if (spec.linearCost.type !== 'fixed') return true;
        if (spec.quadraticCost.type !== 'fixed') return true;
      }
    }

    return false;
  }

  /**
   * Get the demand function type from config.
   */
  static getDemandFunctionType(config: CournotConfig): DemandFunctionType {
    return config.demandFunction?.type || 'linear';
  }
}
