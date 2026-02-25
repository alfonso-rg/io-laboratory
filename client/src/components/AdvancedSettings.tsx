import { useState } from 'react';
import {
  CournotConfig,
  InformationDisclosure,
  ParameterSpec,
  DistributionType,
  ParameterVariation,
  FirmDemandSpec,
  FIRM_COLORS,
  getNumFirms,
  getGamma,
  getCompetitionMode,
  getFirmConfig,
  getDemandFunctionType,
  fixedParam,
  DEFAULT_INFO_DISCLOSURE,
} from '../types/game';

interface AdvancedSettingsProps {
  config: CournotConfig;
  setConfig: (config: Partial<CournotConfig>) => void;
  disabled: boolean;
}

// Helper to describe a ParameterSpec value for preview purposes
function specToPreviewString(spec: ParameterSpec | undefined, fixedFallback: number): string {
  if (!spec || spec.type === 'fixed') return String(fixedFallback);
  if (spec.type === 'uniform') return `[random ~ Uniform(${spec.min ?? 0}, ${spec.max ?? 1})]`;
  if (spec.type === 'normal') return `[random ~ N(${spec.mean ?? 0}, ${spec.stdDev ?? 1})]`;
  if (spec.type === 'lognormal') return `[random ~ LogN(${spec.mean ?? 1}, ${spec.stdDev ?? 0.5})]`;
  return String(fixedFallback);
}

// Generate the default system prompt (mirrors server logic)
function generateDefaultPrompt(config: CournotConfig, firmNumber: number): string {
  const numFirms = getNumFirms(config);
  const mode = getCompetitionMode(config);
  const firmConfig = getFirmConfig(config, firmNumber);
  const info = firmConfig.info;

  // Costs: use firmCostSpecs if present (random), else fixed config values
  const firmCostSpec = config.firmCostSpecs?.[firmNumber - 1];
  const ownLinearCost = specToPreviewString(firmCostSpec?.linearCost, firmConfig.linearCost);
  const ownQuadraticCost = specToPreviewString(firmCostSpec?.quadraticCost, firmConfig.quadraticCost);
  const rivalFirmIndex = firmNumber === 1 ? 1 : 0;
  const rivalCostSpec = config.firmCostSpecs?.[rivalFirmIndex];
  const rivalFirmConfig = numFirms === 2 ? getFirmConfig(config, firmNumber === 1 ? 2 : 1) : null;
  const rivalLinearCost = specToPreviewString(rivalCostSpec?.linearCost, rivalFirmConfig?.linearCost ?? 0);
  const rivalQuadraticCost = specToPreviewString(rivalCostSpec?.quadraticCost, rivalFirmConfig?.quadraticCost ?? 0);

  // Gamma: use gammaSpec if present (random), else fixed config value
  const gammaRaw = getGamma(config);
  const gammaStr = specToPreviewString(config.gammaSpec, gammaRaw);
  const gammaIsRandom = config.gammaSpec && config.gammaSpec.type !== 'fixed';
  // For structural decisions (e.g. differentiation branch) use the fixed fallback
  const gamma = gammaRaw;

  // Demand parameters based on type
  const demandFunction = config.demandFunction;
  const demandType = getDemandFunctionType(config);
  let demandInterceptStr = String(config.demandIntercept);
  let demandSlopeStr = String(config.demandSlope);
  let demandScaleStr = '100';
  let demandSubElasticityStr = '2';
  let demandPriceCoeffStr = '10';
  let demandDecayRateStr = '0.01';

  if (demandFunction?.type === 'linear') {
    demandInterceptStr = specToPreviewString(demandFunction.intercept, config.demandIntercept);
    demandSlopeStr = specToPreviewString(demandFunction.slope, config.demandSlope);
  } else if (demandFunction?.type === 'ces') {
    demandScaleStr = specToPreviewString(demandFunction.scale, 100);
    demandSubElasticityStr = specToPreviewString(demandFunction.substitutionElasticity, 2);
  } else if (demandFunction?.type === 'logit') {
    demandInterceptStr = specToPreviewString(demandFunction.intercept, config.demandIntercept);
    demandPriceCoeffStr = specToPreviewString(demandFunction.priceCoefficient, 10);
  } else if (demandFunction?.type === 'exponential') {
    demandScaleStr = specToPreviewString(demandFunction.scale, 100);
    demandDecayRateStr = specToPreviewString(demandFunction.decayRate, 0.01);
  }

  // Per-firm demand override (if enabled)
  if (config.usePerFirmDemand && config.firmDemandSpecs?.[firmNumber - 1]) {
    const firmDemandSpec = config.firmDemandSpecs[firmNumber - 1];
    if (demandType === 'linear' || !demandFunction) {
      if (firmDemandSpec.intercept) demandInterceptStr = specToPreviewString(firmDemandSpec.intercept, config.demandIntercept);
      if (firmDemandSpec.slope) demandSlopeStr = specToPreviewString(firmDemandSpec.slope, config.demandSlope);
    } else if (demandType === 'ces') {
      if (firmDemandSpec.scale) demandScaleStr = specToPreviewString(firmDemandSpec.scale, 100);
      if (firmDemandSpec.substitutionElasticity) demandSubElasticityStr = specToPreviewString(firmDemandSpec.substitutionElasticity, 2);
    } else if (demandType === 'logit') {
      if (firmDemandSpec.intercept) demandInterceptStr = specToPreviewString(firmDemandSpec.intercept, config.demandIntercept);
      if (firmDemandSpec.priceCoefficient) demandPriceCoeffStr = specToPreviewString(firmDemandSpec.priceCoefficient, 10);
    } else if (demandType === 'exponential') {
      if (firmDemandSpec.scale) demandScaleStr = specToPreviewString(firmDemandSpec.scale, 100);
      if (firmDemandSpec.decayRate) demandDecayRateStr = specToPreviewString(firmDemandSpec.decayRate, 0.01);
    }
  }

  const isBertrand = mode === 'bertrand';
  const competitionType = isBertrand ? 'price' : 'quantity';
  const decisionVar = isBertrand ? 'price' : 'production quantity';
  const rivalTerm = numFirms === 2 ? 'another firm' : `${numFirms - 1} other firms`;

  let prompt = `You are Firm ${firmNumber} in a ${competitionType} competition game.\n\n`;
  prompt += 'GAME RULES:\n';
  prompt += `- You compete with ${rivalTerm} in the same market\n`;
  prompt += `- Each round, all firms simultaneously choose their ${decisionVar}\n`;

  if (info.revealDemandFunction) {
    const gammaDisplay = gammaIsRandom ? gammaStr : gamma.toFixed(2);

    if (demandType === 'ces') {
      prompt += `- Demand follows CES (Constant Elasticity of Substitution) form\n`;
      prompt += `- Substitution elasticity: σ = ${demandSubElasticityStr}\n`;
      if (isBertrand) {
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gammaDisplay}). Your demand depends on your price and competitors' prices.\n`;
          prompt += `- Your effective demand: q_you + ${gammaDisplay} × sum_of_others_q = (your_price / ${demandScaleStr})^(-${demandSubElasticityStr})\n`;
          prompt += `- Lower prices lead to higher demand for your product\n`;
        } else {
          prompt += `- Products are homogeneous. Market demand: Q = (P / ${demandScaleStr})^(-${demandSubElasticityStr})\n`;
          prompt += '- The firm with the lowest price captures most/all of the market.\n';
        }
      } else {
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gammaDisplay}). Your price depends on your quantity and competitors' quantities.\n`;
          prompt += `- Your price: p = ${demandScaleStr} × (your_q + ${gammaDisplay} × sum_of_others_q)^(-1/${demandSubElasticityStr})\n`;
        } else {
          prompt += `- Market price function: P = ${demandScaleStr} × Q^(-1/${demandSubElasticityStr})\n`;
        }
      }
    } else if (demandType === 'logit') {
      prompt += `- Demand follows a logit-like form with logarithmic price sensitivity\n`;
      if (isBertrand) {
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gammaDisplay}). Your demand depends on your price and competitors' prices.\n`;
          prompt += `- Your effective demand: q_you + ${gammaDisplay} × sum_of_others_q = e^((${demandInterceptStr} - your_price) / ${demandPriceCoeffStr})\n`;
          prompt += `- Lower prices lead to higher demand for your product\n`;
        } else {
          prompt += `- Products are homogeneous. Market demand: Q = e^((${demandInterceptStr} - P) / ${demandPriceCoeffStr})\n`;
          prompt += '- The firm with the lowest price captures most/all of the market.\n';
        }
      } else {
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gammaDisplay}). Your price depends on your quantity and competitors' quantities.\n`;
          prompt += `- Your price: p = ${demandInterceptStr} - ${demandPriceCoeffStr} × ln(your_q + ${gammaDisplay} × sum_of_others_q)\n`;
        } else {
          prompt += `- Market price function: P = ${demandInterceptStr} - ${demandPriceCoeffStr} × ln(Q)\n`;
          prompt += `- Price decreases logarithmically as quantity increases\n`;
        }
      }
    } else if (demandType === 'exponential') {
      prompt += `- Demand follows an exponential decay form\n`;
      if (isBertrand) {
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gammaDisplay}). Your demand depends on your price and competitors' prices.\n`;
          prompt += `- Your effective demand: q_you + ${gammaDisplay} × sum_of_others_q = ln(${demandScaleStr} / your_price) / ${demandDecayRateStr}\n`;
          prompt += `- Lower prices lead to higher demand for your product\n`;
        } else {
          prompt += `- Products are homogeneous. Market demand: Q = ln(${demandScaleStr} / P) / ${demandDecayRateStr}\n`;
          prompt += '- The firm with the lowest price captures most/all of the market.\n';
        }
      } else {
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gammaDisplay}). Your price depends on your quantity and competitors' quantities.\n`;
          prompt += `- Your price: p = ${demandScaleStr} × e^(-${demandDecayRateStr} × (your_q + ${gammaDisplay} × sum_of_others_q))\n`;
        } else {
          prompt += `- Market price function: P = ${demandScaleStr} × e^(-${demandDecayRateStr} × Q)\n`;
          prompt += `- Price decays exponentially as quantity increases\n`;
        }
      }
    } else {
      // Linear demand (default)
      if (isBertrand) {
        if (gamma < 1) {
          // Exact Singh & Vives direct demand formula
          if (gammaIsRandom) {
            prompt += `- Products are differentiated (γ = ${gammaStr}). Your demand depends on your price and competitors' prices.\n`;
            prompt += `- Your demand: q = (a(1-γ) - (1+(n-2)γ)×your_price + γ×sum_of_others_prices) / (b(1-γ)(1+(n-1)γ))\n`;
          } else {
            const aCoeff = (config.demandIntercept * (1 - gamma)).toFixed(2);
            const ownCoeff = 1 + (numFirms - 2) * gamma;
            const crossCoeff = gamma.toFixed(2);
            const denomCoeff = (config.demandSlope * (1 - gamma) * (1 + (numFirms - 1) * gamma)).toFixed(2);
            const ownStr = Math.abs(ownCoeff - 1) < 0.001 ? 'your_price' : `${ownCoeff.toFixed(2)} × your_price`;
            const othersStr = numFirms === 2 ? `${crossCoeff} × rival_price` : `${crossCoeff} × sum_of_others_prices`;
            prompt += `- Products are differentiated (γ = ${gamma.toFixed(2)}). Your demand depends on your price and competitors' prices.\n`;
            prompt += `- Your demand: q = (${aCoeff} - ${ownStr} + ${othersStr}) / ${denomCoeff}\n`;
          }
        } else {
          prompt += `- Products are homogeneous. Market demand: Q = (${demandInterceptStr} - P) / ${demandSlopeStr}\n`;
          prompt += '- The firm with the lowest price captures most/all of the market.\n';
        }
      } else {
        // Cournot
        if (gamma < 1) {
          prompt += `- Products are differentiated (γ = ${gammaDisplay}). Your price depends on your quantity and competitors' quantities.\n`;
          prompt += `- Your price: p = ${demandInterceptStr} - ${demandSlopeStr} × (your_q + ${gammaDisplay} × sum_of_others_q)\n`;
        } else {
          if (numFirms === 2) {
            prompt += `- Market price is determined by total quantity: P = ${demandInterceptStr} - ${demandSlopeStr} × (q1 + q2)\n`;
          } else {
            prompt += `- Market price is determined by total quantity: P = ${demandInterceptStr} - ${demandSlopeStr} × (q1 + q2 + ... + q${numFirms})\n`;
          }
        }
      }
    }
  } else {
    if (isBertrand) {
      prompt += '- Your sales depend on your price relative to competitors\n';
    } else {
      prompt += '- Market price decreases as total quantity increases\n';
    }
  }

  if (info.revealOwnCosts) {
    const ownLinearCostIsRandom = firmCostSpec && firmCostSpec.linearCost.type !== 'fixed';
    const ownQuadraticCostIsRandom = firmCostSpec && firmCostSpec.quadraticCost.type !== 'fixed';
    let costDescription = `C(q) = ${ownLinearCost} × q`;
    if (ownQuadraticCostIsRandom || firmConfig.quadraticCost > 0) {
      costDescription += ` + ${ownQuadraticCost} × q²`;
    }
    prompt += `- Your cost function: ${costDescription}\n`;
    if (isBertrand) {
      prompt += `- Your marginal cost starts at ${ownLinearCost}${ownLinearCostIsRandom ? ' (drawn each game)' : ''}\n`;
    }
  } else {
    prompt += '- You have production costs that increase with quantity\n';
  }

  if (info.revealRivalCosts && numFirms === 2) {
    const rivalQuadraticCostIsRandom = rivalCostSpec && rivalCostSpec.quadraticCost.type !== 'fixed';
    let rivalCostDescription = `C(q) = ${rivalLinearCost} × q`;
    if (rivalQuadraticCostIsRandom || (rivalFirmConfig?.quadraticCost ?? 0) > 0) {
      rivalCostDescription += ` + ${rivalQuadraticCost} × q²`;
    }
    prompt += `- Your rival's cost function: ${rivalCostDescription}\n`;
  }

  if (isBertrand) {
    prompt += '- Your profit = (Your Price - Marginal Cost) × Your Sales Quantity\n\n';
  } else {
    prompt += '- Your profit = (Market Price × Your Quantity) - Your Cost\n\n';
  }

  prompt += 'YOUR OBJECTIVE:\n';
  prompt += `Maximize your total profit over ${config.totalRounds} rounds.\n\n`;

  prompt += 'STRATEGY CONSIDERATIONS:\n';
  if (isBertrand) {
    prompt += '- If you set a lower price, you may capture more market share\n';
    prompt += '- If you set a higher price, you earn more per unit but may lose customers\n';
    if (gamma < 1) {
      prompt += "- Product differentiation means you won't lose all customers if your price is slightly higher\n";
    }
  } else {
    prompt += '- If you produce more, market price falls (affecting all firms)\n';
    prompt += '- If you produce less, you earn less revenue but keep price higher\n';
  }

  if (info.describeRivalAsHuman) {
    prompt += `- The other firm${numFirms > 2 ? 's are' : ' is'} controlled by human participant${numFirms > 2 ? 's' : ''} in an experiment\n`;
  } else if (info.revealRivalIsLLM) {
    prompt += `- The other firm${numFirms > 2 ? 's are' : ' is'} also AI${numFirms > 2 ? 's' : ''} trying to maximize profit\n`;
  } else {
    prompt += `- The other firm${numFirms > 2 ? 's are' : ' is'} also trying to maximize profit\n`;
  }

  prompt += '- Past behavior of competitors may inform your expectations\n\n';

  prompt += 'RESPONSE FORMAT:\n';
  if (isBertrand) {
    prompt += '- First line: ONLY the price you want to set (a non-negative number)\n';
  } else {
    prompt += '- First line: ONLY the quantity you want to produce (a non-negative number)\n';
  }
  prompt += '- Following lines (optional): Your reasoning\n\n';

  prompt += 'Example response format:\n';
  prompt += `[your chosen ${isBertrand ? 'price' : 'quantity'}]\n`;
  prompt += `I chose this ${isBertrand ? 'price' : 'quantity'} because...`;

  return prompt;
}

// Helper component for parameter specification input
function ParameterInput({
  label,
  spec,
  onChange,
  disabled,
  min,
  step = 0.1,
}: {
  label: string;
  spec: ParameterSpec;
  onChange: (newSpec: ParameterSpec) => void;
  disabled: boolean;
  min?: number;
  step?: number;
}) {
  const distributionTypes: { value: DistributionType; label: string }[] = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'uniform', label: 'Uniform' },
    { value: 'normal', label: 'Normal' },
    { value: 'lognormal', label: 'Log-normal' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <label className="w-32 text-sm font-medium text-gray-700">{label}</label>
      <select
        value={spec.type}
        onChange={(e) => {
          const newType = e.target.value as DistributionType;
          if (newType === 'fixed') {
            onChange({ type: 'fixed', value: spec.value ?? spec.mean ?? 0 });
          } else if (newType === 'uniform') {
            onChange({ type: 'uniform', min: spec.value ?? 0, max: (spec.value ?? 0) * 1.5 || 100 });
          } else if (newType === 'normal') {
            onChange({ type: 'normal', mean: spec.value ?? spec.mean ?? 0, stdDev: spec.stdDev ?? 10 });
          } else {
            onChange({ type: 'lognormal', mean: spec.value ?? spec.mean ?? 10, stdDev: spec.stdDev ?? 2 });
          }
        }}
        className="w-28 px-2 py-1 border rounded text-sm"
        disabled={disabled}
      >
        {distributionTypes.map((dt) => (
          <option key={dt.value} value={dt.value}>{dt.label}</option>
        ))}
      </select>

      {spec.type === 'fixed' && (
        <input
          type="number"
          value={spec.value ?? 0}
          onChange={(e) => onChange({ ...spec, value: parseFloat(e.target.value) || 0 })}
          className="w-20 px-2 py-1 border rounded text-sm"
          disabled={disabled}
          min={min}
          step={step}
        />
      )}

      {spec.type === 'uniform' && (
        <>
          <input
            type="number"
            placeholder="Min"
            value={spec.min ?? 0}
            onChange={(e) => onChange({ ...spec, min: parseFloat(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border rounded text-sm"
            disabled={disabled}
            min={min}
            step={step}
          />
          <span className="text-gray-500">-</span>
          <input
            type="number"
            placeholder="Max"
            value={spec.max ?? 100}
            onChange={(e) => onChange({ ...spec, max: parseFloat(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border rounded text-sm"
            disabled={disabled}
            step={step}
          />
        </>
      )}

      {(spec.type === 'normal' || spec.type === 'lognormal') && (
        <>
          <input
            type="number"
            placeholder="Mean"
            value={spec.mean ?? 0}
            onChange={(e) => onChange({ ...spec, mean: parseFloat(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border rounded text-sm"
            disabled={disabled}
            step={step}
          />
          <span className="text-gray-500">±</span>
          <input
            type="number"
            placeholder="StdDev"
            value={spec.stdDev ?? 1}
            onChange={(e) => onChange({ ...spec, stdDev: parseFloat(e.target.value) || 0 })}
            className="w-20 px-2 py-1 border rounded text-sm"
            disabled={disabled}
            min={0}
            step={step}
          />
        </>
      )}
    </div>
  );
}

export function AdvancedSettings({ config, setConfig, disabled }: AdvancedSettingsProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const [previewFirm, setPreviewFirm] = useState(1);
  const [showRandomization, setShowRandomization] = useState(false);
  const numFirms = getNumFirms(config);
  const demandType = getDemandFunctionType(config);
  const parameterVariation = config.parameterVariation || 'fixed';

  // Update firm info - works for both legacy (firm 1, 2) and new (firms array) format
  const updateFirmInfo = (firmId: number, updates: Partial<InformationDisclosure>) => {
    if (firmId === 1) {
      setConfig({
        firm1Info: { ...config.firm1Info, ...updates },
      });
    } else if (firmId === 2) {
      setConfig({
        firm2Info: { ...config.firm2Info, ...updates },
      });
    }

    // Also update in firms array if it exists
    if (config.firms && config.firms.length >= firmId) {
      const updatedFirms = [...config.firms];
      updatedFirms[firmId - 1] = {
        ...updatedFirms[firmId - 1],
        info: { ...updatedFirms[firmId - 1].info, ...updates },
      };
      setConfig({ firms: updatedFirms });
    }
  };

  // Get firm info for display
  const getFirmInfo = (firmId: number): InformationDisclosure => {
    if (config.firms && config.firms.length >= firmId) {
      return config.firms[firmId - 1].info;
    }
    if (firmId === 1) return config.firm1Info;
    if (firmId === 2) return config.firm2Info;
    return DEFAULT_INFO_DISCLOSURE;
  };

  // Render info disclosure checkboxes for a single firm
  const renderFirmInfoDisclosure = (firmId: number) => {
    const firmInfo = getFirmInfo(firmId);
    const firmColor = FIRM_COLORS[firmId - 1];

    return (
      <div key={firmId} className="border rounded-lg p-4" style={{ borderColor: firmColor }}>
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: firmColor }}
          ></div>
          <h3 className="font-semibold" style={{ color: firmColor }}>
            Firm {firmId}
          </h3>
        </div>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={firmInfo.revealDemandFunction}
              onChange={(e) => updateFirmInfo(firmId, { revealDemandFunction: e.target.checked })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Reveal demand function (P = a - bQ)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={firmInfo.revealOwnCosts}
              onChange={(e) => updateFirmInfo(firmId, { revealOwnCosts: e.target.checked })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Reveal own cost function</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={firmInfo.revealRivalCosts}
              onChange={(e) => updateFirmInfo(firmId, { revealRivalCosts: e.target.checked })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Reveal rivals' cost functions</span>
          </label>
          <hr className="my-2" />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={firmInfo.revealRivalIsLLM}
              onChange={(e) => updateFirmInfo(firmId, {
                revealRivalIsLLM: e.target.checked,
                describeRivalAsHuman: e.target.checked ? false : firmInfo.describeRivalAsHuman
              })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Tell that rivals are LLMs</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={firmInfo.describeRivalAsHuman}
              onChange={(e) => updateFirmInfo(firmId, {
                describeRivalAsHuman: e.target.checked,
                revealRivalIsLLM: e.target.checked ? false : firmInfo.revealRivalIsLLM
              })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm">Describe rivals as human subjects</span>
          </label>
        </div>
      </div>
    );
  };

  // Apply same settings to all firms
  const applyToAllFirms = (sourceInfo: InformationDisclosure) => {
    // Update legacy fields
    setConfig({
      firm1Info: { ...sourceInfo },
      firm2Info: { ...sourceInfo },
    });

    // Update firms array if exists
    if (config.firms && config.firms.length > 0) {
      const updatedFirms = config.firms.map(firm => ({
        ...firm,
        info: { ...sourceInfo },
      }));
      setConfig({ firms: updatedFirms });
    }
  };

  return (
    <div className="mt-6 space-y-6">
      {/* Replications */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Experiment Settings</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Number of Replications
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={config.numReplications}
              onChange={(e) => setConfig({ numReplications: parseInt(e.target.value) || 1 })}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              disabled={disabled}
            />
            <p className="text-xs text-gray-500 mt-1">
              Run multiple independent games with the same configuration
            </p>
          </div>
        </div>
      </div>

      {/* Parameter Randomization */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Parameter Randomization</h2>
            <p className="text-sm text-gray-600">
              Configure random variation in demand and cost parameters
            </p>
          </div>
          <button
            onClick={() => setShowRandomization(!showRandomization)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {showRandomization ? 'Hide' : 'Show'} Settings
          </button>
        </div>

        {showRandomization && (
          <div className="space-y-6">
            {/* Parameter Variation Mode */}
            <div>
              <label className="block text-sm font-medium mb-2">Parameter Variation</label>
              <select
                value={parameterVariation}
                onChange={(e) => setConfig({ parameterVariation: e.target.value as ParameterVariation })}
                className="w-full md:w-64 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={disabled}
              >
                <option value="fixed">Fixed (same for all rounds)</option>
                <option value="per-replication">Re-draw each replication</option>
                <option value="per-round">Re-draw each round</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {parameterVariation === 'fixed' && 'Parameters are drawn once and stay constant'}
                {parameterVariation === 'per-replication' && 'New random draw at the start of each replication'}
                {parameterVariation === 'per-round' && 'New random draw every round (most variation)'}
              </p>
            </div>

            {/* Demand Parameters */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3">Demand Parameters</h3>
              {config.usePerFirmDemand ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 mb-2">Per-firm demand randomization (each firm has independent parameters)</p>
                  {Array.from({ length: numFirms }, (_, i) => {
                    const firmId = i + 1;
                    const firmColor = FIRM_COLORS[i];
                    const firmDemandSpec: FirmDemandSpec = config.firmDemandSpecs?.[i] ?? {};

                    const updateFirmDemandSpec = (param: string, newSpec: ParameterSpec) => {
                      const newFirmDemandSpecs = [...(config.firmDemandSpecs ?? [])];
                      while (newFirmDemandSpecs.length < numFirms) {
                        newFirmDemandSpecs.push({});
                      }
                      newFirmDemandSpecs[i] = { ...newFirmDemandSpecs[i], [param]: newSpec };
                      setConfig({ firmDemandSpecs: newFirmDemandSpecs });
                    };

                    return (
                      <div key={firmId} className="border-l-4 pl-3" style={{ borderColor: firmColor }}>
                        <h4 className="font-medium text-sm mb-2" style={{ color: firmColor }}>
                          Firm {firmId}
                        </h4>
                        {demandType === 'linear' && (
                          <>
                            <ParameterInput
                              label="Intercept (a)"
                              spec={firmDemandSpec.intercept ?? (config.demandFunction?.type === 'linear' ? config.demandFunction.intercept : fixedParam(config.demandIntercept))}
                              onChange={(s) => updateFirmDemandSpec('intercept', s)}
                              disabled={disabled}
                            />
                            <ParameterInput
                              label="Slope (b)"
                              spec={firmDemandSpec.slope ?? (config.demandFunction?.type === 'linear' ? config.demandFunction.slope : fixedParam(config.demandSlope))}
                              onChange={(s) => updateFirmDemandSpec('slope', s)}
                              disabled={disabled}
                              min={0.01}
                            />
                          </>
                        )}
                        {demandType === 'ces' && (
                          <>
                            <ParameterInput
                              label="Scale (A)"
                              spec={firmDemandSpec.scale ?? (config.demandFunction?.type === 'ces' ? config.demandFunction.scale : fixedParam(100))}
                              onChange={(s) => updateFirmDemandSpec('scale', s)}
                              disabled={disabled}
                              min={0.01}
                            />
                            <ParameterInput
                              label="Subst. Elast. (σ)"
                              spec={firmDemandSpec.substitutionElasticity ?? (config.demandFunction?.type === 'ces' ? config.demandFunction.substitutionElasticity : fixedParam(2))}
                              onChange={(s) => updateFirmDemandSpec('substitutionElasticity', s)}
                              disabled={disabled}
                              min={0.1}
                            />
                          </>
                        )}
                        {demandType === 'logit' && (
                          <>
                            <ParameterInput
                              label="Intercept (a)"
                              spec={firmDemandSpec.intercept ?? (config.demandFunction?.type === 'logit' ? config.demandFunction.intercept : fixedParam(100))}
                              onChange={(s) => updateFirmDemandSpec('intercept', s)}
                              disabled={disabled}
                            />
                            <ParameterInput
                              label="Price Coeff. (b)"
                              spec={firmDemandSpec.priceCoefficient ?? (config.demandFunction?.type === 'logit' ? config.demandFunction.priceCoefficient : fixedParam(10))}
                              onChange={(s) => updateFirmDemandSpec('priceCoefficient', s)}
                              disabled={disabled}
                              min={0.1}
                            />
                          </>
                        )}
                        {demandType === 'exponential' && (
                          <>
                            <ParameterInput
                              label="Scale (A)"
                              spec={firmDemandSpec.scale ?? (config.demandFunction?.type === 'exponential' ? config.demandFunction.scale : fixedParam(100))}
                              onChange={(s) => updateFirmDemandSpec('scale', s)}
                              disabled={disabled}
                              min={0.01}
                            />
                            <ParameterInput
                              label="Decay Rate (b)"
                              spec={firmDemandSpec.decayRate ?? (config.demandFunction?.type === 'exponential' ? config.demandFunction.decayRate : fixedParam(0.01))}
                              onChange={(s) => updateFirmDemandSpec('decayRate', s)}
                              disabled={disabled}
                              min={0.001}
                              step={0.001}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {demandType === 'linear' && (
                    <>
                      <ParameterInput
                        label="Intercept (a)"
                        spec={config.demandFunction?.type === 'linear'
                          ? config.demandFunction.intercept
                          : fixedParam(config.demandIntercept)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'linear',
                              intercept: newSpec,
                              slope: config.demandFunction?.type === 'linear'
                                ? config.demandFunction.slope
                                : fixedParam(config.demandSlope),
                            },
                            demandIntercept: newSpec.type === 'fixed' ? (newSpec.value ?? 100) : config.demandIntercept,
                          });
                        }}
                        disabled={disabled}
                      />
                      <ParameterInput
                        label="Slope (b)"
                        spec={config.demandFunction?.type === 'linear'
                          ? config.demandFunction.slope
                          : fixedParam(config.demandSlope)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'linear',
                              intercept: config.demandFunction?.type === 'linear'
                                ? config.demandFunction.intercept
                                : fixedParam(config.demandIntercept),
                              slope: newSpec,
                            },
                            demandSlope: newSpec.type === 'fixed' ? (newSpec.value ?? 1) : config.demandSlope,
                          });
                        }}
                        disabled={disabled}
                        min={0.01}
                      />
                    </>
                  )}
                  {demandType === 'ces' && (
                    <>
                      <ParameterInput
                        label="Scale (A)"
                        spec={config.demandFunction?.type === 'ces'
                          ? config.demandFunction.scale
                          : fixedParam(100)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'ces',
                              scale: newSpec,
                              substitutionElasticity: config.demandFunction?.type === 'ces'
                                ? config.demandFunction.substitutionElasticity
                                : fixedParam(2),
                            },
                          });
                        }}
                        disabled={disabled}
                        min={0.01}
                      />
                      <ParameterInput
                        label="Substitution Elasticity (σ)"
                        spec={config.demandFunction?.type === 'ces'
                          ? config.demandFunction.substitutionElasticity
                          : fixedParam(2)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'ces',
                              scale: config.demandFunction?.type === 'ces'
                                ? config.demandFunction.scale
                                : fixedParam(100),
                              substitutionElasticity: newSpec,
                            },
                          });
                        }}
                        disabled={disabled}
                        min={0.1}
                      />
                    </>
                  )}
                  {demandType === 'logit' && (
                    <>
                      <ParameterInput
                        label="Intercept (a)"
                        spec={config.demandFunction?.type === 'logit'
                          ? config.demandFunction.intercept
                          : fixedParam(100)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'logit',
                              intercept: newSpec,
                              priceCoefficient: config.demandFunction?.type === 'logit'
                                ? config.demandFunction.priceCoefficient
                                : fixedParam(10),
                            },
                          });
                        }}
                        disabled={disabled}
                      />
                      <ParameterInput
                        label="Price Coefficient (b)"
                        spec={config.demandFunction?.type === 'logit'
                          ? config.demandFunction.priceCoefficient
                          : fixedParam(10)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'logit',
                              intercept: config.demandFunction?.type === 'logit'
                                ? config.demandFunction.intercept
                                : fixedParam(100),
                              priceCoefficient: newSpec,
                            },
                          });
                        }}
                        disabled={disabled}
                        min={0.1}
                      />
                    </>
                  )}
                  {demandType === 'exponential' && (
                    <>
                      <ParameterInput
                        label="Scale (A)"
                        spec={config.demandFunction?.type === 'exponential'
                          ? config.demandFunction.scale
                          : fixedParam(100)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'exponential',
                              scale: newSpec,
                              decayRate: config.demandFunction?.type === 'exponential'
                                ? config.demandFunction.decayRate
                                : fixedParam(0.01),
                            },
                          });
                        }}
                        disabled={disabled}
                        min={0.01}
                      />
                      <ParameterInput
                        label="Decay Rate (b)"
                        spec={config.demandFunction?.type === 'exponential'
                          ? config.demandFunction.decayRate
                          : fixedParam(0.01)}
                        onChange={(newSpec) => {
                          setConfig({
                            demandFunction: {
                              type: 'exponential',
                              scale: config.demandFunction?.type === 'exponential'
                                ? config.demandFunction.scale
                                : fixedParam(100),
                              decayRate: newSpec,
                            },
                          });
                        }}
                        disabled={disabled}
                        min={0.001}
                        step={0.001}
                      />
                    </>
                  )}
                </>
              )}
            </div>

            {/* Gamma (Product Differentiation) */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3">Product Differentiation</h3>
              <ParameterInput
                label="Gamma (γ)"
                spec={config.gammaSpec ?? fixedParam(config.gamma ?? 1)}
                onChange={(newSpec) => {
                  setConfig({
                    gammaSpec: newSpec,
                    gamma: newSpec.type === 'fixed' ? (newSpec.value ?? 1) : config.gamma,
                  });
                }}
                disabled={disabled}
                min={0}
                step={0.05}
              />
              <p className="text-xs text-gray-500 mt-1">
                γ = 0 (independent products) to γ = 1 (homogeneous products)
              </p>
            </div>

            {/* Firm Costs */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-3">Firm Costs</h3>
              <div className="space-y-4">
                {Array.from({ length: numFirms }, (_, i) => {
                  const firmId = i + 1;
                  const firmConfig = getFirmConfig(config, firmId);
                  const firmCostSpec = config.firmCostSpecs?.[i] ?? {
                    linearCost: fixedParam(firmConfig.linearCost),
                    quadraticCost: fixedParam(firmConfig.quadraticCost),
                  };
                  const firmColor = FIRM_COLORS[i];

                  return (
                    <div key={firmId} className="border-l-4 pl-3" style={{ borderColor: firmColor }}>
                      <h4 className="font-medium text-sm mb-2" style={{ color: firmColor }}>
                        Firm {firmId}
                      </h4>
                      <ParameterInput
                        label="Linear Cost (c)"
                        spec={firmCostSpec.linearCost}
                        onChange={(newSpec) => {
                          const newFirmCostSpecs = [...(config.firmCostSpecs ?? [])];
                          // Ensure array is long enough
                          while (newFirmCostSpecs.length < numFirms) {
                            const fc = getFirmConfig(config, newFirmCostSpecs.length + 1);
                            newFirmCostSpecs.push({
                              linearCost: fixedParam(fc.linearCost),
                              quadraticCost: fixedParam(fc.quadraticCost),
                            });
                          }
                          newFirmCostSpecs[i] = {
                            ...newFirmCostSpecs[i],
                            linearCost: newSpec,
                          };
                          setConfig({ firmCostSpecs: newFirmCostSpecs });
                        }}
                        disabled={disabled}
                        min={0}
                      />
                      <ParameterInput
                        label="Quadratic (d)"
                        spec={firmCostSpec.quadraticCost}
                        onChange={(newSpec) => {
                          const newFirmCostSpecs = [...(config.firmCostSpecs ?? [])];
                          while (newFirmCostSpecs.length < numFirms) {
                            const fc = getFirmConfig(config, newFirmCostSpecs.length + 1);
                            newFirmCostSpecs.push({
                              linearCost: fixedParam(fc.linearCost),
                              quadraticCost: fixedParam(fc.quadraticCost),
                            });
                          }
                          newFirmCostSpecs[i] = {
                            ...newFirmCostSpecs[i],
                            quadraticCost: newSpec,
                          };
                          setConfig({ firmCostSpecs: newFirmCostSpecs });
                        }}
                        disabled={disabled}
                        min={0}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Information Disclosure */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">Information Disclosure</h2>
            <p className="text-sm text-gray-600">
              Control what information each LLM receives about the game
            </p>
          </div>
          {numFirms > 1 && (
            <button
              onClick={() => applyToAllFirms(getFirmInfo(1))}
              disabled={disabled}
              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50"
            >
              Apply Firm 1 settings to all
            </button>
          )}
        </div>

        <div className={`grid gap-4 ${
          numFirms <= 2 ? 'grid-cols-1 md:grid-cols-2' :
          numFirms <= 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        }`}>
          {Array.from({ length: numFirms }, (_, i) => i + 1).map(firmId =>
            renderFirmInfoDisclosure(firmId)
          )}
        </div>
      </div>

      {/* Communication Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Communication Between Firms</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.communication.allowCommunication}
              onChange={(e) => setConfig({
                communication: { ...config.communication, allowCommunication: e.target.checked }
              })}
              disabled={disabled}
              className="rounded"
            />
            <span className="text-sm font-medium">Allow pre-round communication</span>
          </label>

          {config.communication.allowCommunication && (
            <div className="ml-6 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Messages per round
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={config.communication.messagesPerRound}
                  onChange={(e) => setConfig({
                    communication: { ...config.communication, messagesPerRound: parseInt(e.target.value) || 1 }
                  })}
                  className="w-32 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  disabled={disabled}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Messages cycle through firms: 1, 2, ..., {numFirms}, 1, 2, ...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Prompt Editor */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Custom Prompts</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDefaultPrompt(!showDefaultPrompt)}
              className="text-green-600 hover:text-green-800 text-sm"
            >
              {showDefaultPrompt ? 'Hide' : 'View'} Default Prompt
            </button>
            <button
              onClick={() => setShowPromptEditor(!showPromptEditor)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              {showPromptEditor ? 'Hide' : 'Show'} Editor
            </button>
          </div>
        </div>

        {/* Default Prompt Preview */}
        {showDefaultPrompt && (
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium">Preview for Firm:</label>
              <select
                value={previewFirm}
                onChange={(e) => setPreviewFirm(parseInt(e.target.value))}
                className="px-2 py-1 border rounded text-sm"
              >
                {Array.from({ length: numFirms }, (_, i) => i + 1).map(firmId => (
                  <option key={firmId} value={firmId}>Firm {firmId}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                (This is the prompt that will be sent to the LLM based on current settings)
              </span>
            </div>
            <div className="bg-gray-50 border rounded-lg p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700 max-h-96 overflow-y-auto">
                {generateDefaultPrompt(config, previewFirm)}
              </pre>
            </div>
            <button
              onClick={() => {
                setConfig({ customSystemPrompt: generateDefaultPrompt(config, previewFirm) });
                setShowPromptEditor(true);
                setShowDefaultPrompt(false);
              }}
              className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
              disabled={disabled}
            >
              Copy to Editor (for Firm {previewFirm})
            </button>
          </div>
        )}

        {showPromptEditor && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Available variables: {'{firmNumber}'}, {'{numFirms}'}, {'{totalRounds}'}, {'{demandIntercept}'}, {'{demandSlope}'},
              {'{gamma}'}, {'{competitionMode}'}, {'{ownLinearCost}'}, {'{ownQuadraticCost}'}, {'{rivalLinearCost}'}, {'{rivalQuadraticCost}'}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">
                Custom System Prompt (leave empty for default)
              </label>
              <textarea
                value={config.customSystemPrompt || ''}
                onChange={(e) => setConfig({ customSystemPrompt: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={12}
                placeholder="Leave empty to use the default prompt with information disclosure settings..."
                disabled={disabled}
              />
            </div>
            {config.customSystemPrompt && (
              <button
                onClick={() => setConfig({ customSystemPrompt: undefined })}
                className="text-sm px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded"
                disabled={disabled}
              >
                Clear Custom Prompt (use default)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
