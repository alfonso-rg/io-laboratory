import { useMemo, useState } from 'react';
import {
  useGameStore,
  calculateCooperativeEquilibrium,
  calculateNPolyCournotEquilibrium,
  calculateLimitPricingAnalysis,
} from '../stores/gameStore';
import { useSocket } from '../hooks/useSocket';
import {
  AVAILABLE_MODELS,
  COMPETITION_MODES,
  FIRM_COLOR_CLASSES,
  getNumFirms,
  getGamma,
  getCompetitionMode,
  getFirmConfig,
  createDefaultFirms,
  getDemandFunctionType,
  fixedParam,
  CournotConfig,
  FirmConfig,
  FirmDemandSpec,
  DemandFunctionType,
} from '../types/game';
import { AdvancedSettings } from './AdvancedSettings';

export function HomePage() {
  const { config, setConfig, gameState, connected, error } = useGameStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { configureGame, startGame } = useSocket();

  const numFirms = getNumFirms(config);
  const gamma = getGamma(config);
  const competitionMode = getCompetitionMode(config);
  const demandFunctionType = getDemandFunctionType(config);

  // Handle demand function type change
  const handleDemandTypeChange = (newType: DemandFunctionType) => {
    const updates: Partial<CournotConfig> = {};
    let defaultSpec: FirmDemandSpec = {};

    switch (newType) {
      case 'linear':
        updates.demandFunction = {
          type: 'linear',
          intercept: fixedParam(config.demandIntercept),
          slope: fixedParam(config.demandSlope),
        };
        defaultSpec = { intercept: fixedParam(config.demandIntercept), slope: fixedParam(config.demandSlope) };
        break;
      case 'ces':
        updates.demandFunction = {
          type: 'ces',
          scale: fixedParam(100),
          substitutionElasticity: fixedParam(2),
        };
        defaultSpec = { scale: fixedParam(100), substitutionElasticity: fixedParam(2) };
        break;
      case 'logit':
        updates.demandFunction = {
          type: 'logit',
          intercept: fixedParam(100),
          priceCoefficient: fixedParam(10),
        };
        defaultSpec = { intercept: fixedParam(100), priceCoefficient: fixedParam(10) };
        break;
      case 'exponential':
        updates.demandFunction = {
          type: 'exponential',
          scale: fixedParam(100),
          decayRate: fixedParam(0.01),
        };
        defaultSpec = { scale: fixedParam(100), decayRate: fixedParam(0.01) };
        break;
    }

    if (config.usePerFirmDemand) {
      updates.firmDemandSpecs = Array.from({ length: numFirms }, () => ({ ...defaultSpec }));
    }

    setConfig(updates);
  };

  // Get CES parameters from config
  const cesScale = config.demandFunction?.type === 'ces'
    ? (config.demandFunction.scale.value ?? 100)
    : 100;
  const cesSubstitutionElasticity = config.demandFunction?.type === 'ces'
    ? (config.demandFunction.substitutionElasticity.value ?? 2)
    : 2;

  // Get Logit parameters from config
  const logitIntercept = config.demandFunction?.type === 'logit'
    ? (config.demandFunction.intercept.value ?? 100)
    : 100;
  const logitPriceCoefficient = config.demandFunction?.type === 'logit'
    ? (config.demandFunction.priceCoefficient.value ?? 10)
    : 10;

  // Get Exponential parameters from config
  const exponentialScale = config.demandFunction?.type === 'exponential'
    ? (config.demandFunction.scale.value ?? 100)
    : 100;
  const exponentialDecayRate = config.demandFunction?.type === 'exponential'
    ? (config.demandFunction.decayRate.value ?? 0.01)
    : 0.01;

  // Helper: get default FirmDemandSpec for current demand type
  const getDefaultFirmDemandSpec = (): FirmDemandSpec => {
    switch (demandFunctionType) {
      case 'linear':
        return { intercept: fixedParam(config.demandIntercept), slope: fixedParam(config.demandSlope) };
      case 'ces':
        return { scale: fixedParam(cesScale), substitutionElasticity: fixedParam(cesSubstitutionElasticity) };
      case 'logit':
        return { intercept: fixedParam(logitIntercept), priceCoefficient: fixedParam(logitPriceCoefficient) };
      case 'exponential':
        return { scale: fixedParam(exponentialScale), decayRate: fixedParam(exponentialDecayRate) };
      default:
        return { intercept: fixedParam(config.demandIntercept), slope: fixedParam(config.demandSlope) };
    }
  };

  // Get firm demand parameter value for display in firm cards
  const getFirmDemandParamValue = (firmIndex: number, param: keyof FirmDemandSpec, fallback: number): number => {
    const spec = config.firmDemandSpecs?.[firmIndex]?.[param];
    if (!spec) return fallback;
    return spec.value ?? spec.mean ?? fallback;
  };

  // Handle per-firm demand toggle
  const handlePerFirmDemandToggle = (enabled: boolean) => {
    if (enabled) {
      const specs: FirmDemandSpec[] = [];
      for (let i = 0; i < numFirms; i++) {
        specs.push(getDefaultFirmDemandSpec());
      }
      setConfig({ usePerFirmDemand: true, firmDemandSpecs: specs });
    } else {
      setConfig({ usePerFirmDemand: false, firmDemandSpecs: undefined });
    }
  };

  // Handle firm demand parameter change (from firm card inputs)
  const handleFirmDemandChange = (firmIndex: number, param: keyof FirmDemandSpec, value: number) => {
    const newSpecs = [...(config.firmDemandSpecs ?? [])];
    while (newSpecs.length <= firmIndex) {
      newSpecs.push(getDefaultFirmDemandSpec());
    }
    newSpecs[firmIndex] = {
      ...newSpecs[firmIndex],
      [param]: fixedParam(value),
    };
    setConfig({ firmDemandSpecs: newSpecs });
  };

  // Legacy equilibrium (for duopoly backward compatibility)
  const cooperativeEquilibrium = useMemo(() => calculateCooperativeEquilibrium(config), [config]);

  // Extended N-poly equilibrium
  const nPolyEquilibrium = useMemo(() => calculateNPolyCournotEquilibrium(config), [config]);
  const limitPricingAnalysis = useMemo(() => calculateLimitPricingAnalysis(config), [config]);

  const handleConfigureAndStart = () => {
    configureGame(config);
    setTimeout(() => {
      startGame();
    }, 100);
  };

  // Handle number of firms change
  const handleNumFirmsChange = (newNumFirms: number) => {
    const firms = createDefaultFirms(newNumFirms, config);
    const updates: Partial<CournotConfig> = { numFirms: newNumFirms, firms };

    if (config.usePerFirmDemand) {
      const currentSpecs = config.firmDemandSpecs ?? [];
      const newSpecs: FirmDemandSpec[] = [];
      for (let i = 0; i < newNumFirms; i++) {
        newSpecs.push(currentSpecs[i] ?? getDefaultFirmDemandSpec());
      }
      updates.firmDemandSpecs = newSpecs;
    }

    setConfig(updates);
  };

  // Handle individual firm config change
  const handleFirmConfigChange = (firmId: number, updates: Partial<FirmConfig>) => {
    const currentFirms = config.firms || createDefaultFirms(numFirms, config);
    const updatedFirms = currentFirms.map(f =>
      f.id === firmId ? { ...f, ...updates } : f
    );
    setConfig({ firms: updatedFirms });

    // Also update legacy fields for backward compatibility
    if (firmId === 1) {
      if (updates.linearCost !== undefined) setConfig({ firm1LinearCost: updates.linearCost });
      if (updates.quadraticCost !== undefined) setConfig({ firm1QuadraticCost: updates.quadraticCost });
      if (updates.model !== undefined) setConfig({ firm1Model: updates.model });
    } else if (firmId === 2) {
      if (updates.linearCost !== undefined) setConfig({ firm2LinearCost: updates.linearCost });
      if (updates.quadraticCost !== undefined) setConfig({ firm2QuadraticCost: updates.quadraticCost });
      if (updates.model !== undefined) setConfig({ firm2Model: updates.model });
    }
  };

  const isRunning = gameState?.status === 'running';
  const canStart = connected && !isRunning;

  // Reasoning effort multipliers for output tokens (approximate)
  // Higher reasoning = more reasoning tokens generated (billed as output)
  const getReasoningMultiplier = (modelName: string): { multiplier: number; level: string | null } => {
    if (modelName.startsWith('gpt-5.2:')) {
      const level = modelName.split(':')[1];
      switch (level) {
        case 'none': return { multiplier: 1, level };
        case 'low': return { multiplier: 1.5, level };
        case 'medium': return { multiplier: 2.5, level };
        case 'high': return { multiplier: 4, level };
        case 'xhigh': return { multiplier: 8, level };
        default: return { multiplier: 1, level: null };
      }
    }
    return { multiplier: 1, level: null };
  };

  // Cost estimation calculation
  const costEstimate = useMemo(() => {
    const totalRounds = config.totalRounds || 10;
    const numReps = config.numReplications || 1;
    const hasCommunication = config.communication?.allowCommunication || false;
    const messagesPerRound = config.communication?.messagesPerRound || 2;

    // Token estimates (approximate)
    const systemPromptTokens = 400; // ~400 tokens for system prompt
    const baseRoundPromptTokens = 150; // Base round prompt
    const historyTokensPerRound = 50; // ~50 tokens per round in history
    const outputTokensPerDecision = 100; // ~100 tokens for response
    const communicationInputTokens = 200; // Per message
    const communicationOutputTokens = 50; // Per message

    // Calculate average history size across all rounds
    const avgHistoryRounds = (totalRounds - 1) / 2;
    const avgInputTokensPerRound = systemPromptTokens + baseRoundPromptTokens + (avgHistoryRounds * historyTokensPerRound);

    // Per-firm tokens per round (base)
    let inputPerFirmPerRound = avgInputTokensPerRound;
    let outputPerFirmPerRound = outputTokensPerDecision;

    // Add communication tokens if enabled
    if (hasCommunication) {
      const messagesPerFirm = Math.ceil(messagesPerRound / numFirms);
      inputPerFirmPerRound += communicationInputTokens * messagesPerFirm;
      outputPerFirmPerRound += communicationOutputTokens * messagesPerFirm;
    }

    // Calculate cost for each unique model used
    const firmModels: string[] = [];
    for (let i = 1; i <= numFirms; i++) {
      firmModels.push(getFirmConfig(config, i).model);
    }

    // Get unique models and their counts
    const modelCounts: Record<string, number> = {};
    firmModels.forEach(m => {
      modelCounts[m] = (modelCounts[m] || 0) + 1;
    });

    // Calculate weighted cost with reasoning multipliers
    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let hasReasoningModels = false;
    const reasoningLevels: string[] = [];

    Object.entries(modelCounts).forEach(([modelName, count]) => {
      const modelInfo = AVAILABLE_MODELS.find(m => m.value === modelName);
      const { multiplier, level } = getReasoningMultiplier(modelName);

      if (level) {
        hasReasoningModels = true;
        if (!reasoningLevels.includes(level)) reasoningLevels.push(level);
      }

      if (modelInfo) {
        const firmInputTokens = inputPerFirmPerRound * count * totalRounds * numReps;
        // Apply reasoning multiplier to output tokens
        const firmOutputTokens = outputPerFirmPerRound * count * totalRounds * numReps * multiplier;

        totalInputTokens += firmInputTokens;
        totalOutputTokens += firmOutputTokens;

        const inputCost = (firmInputTokens / 1_000_000) * modelInfo.inputPrice;
        const outputCost = (firmOutputTokens / 1_000_000) * modelInfo.outputPrice;
        totalCost += inputCost + outputCost;
      }
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost: totalCost,
      hasReasoningModels,
      reasoningLevels,
      modelBreakdown: Object.entries(modelCounts).map(([model, count]) => ({
        model,
        count,
        modelInfo: AVAILABLE_MODELS.find(m => m.value === model),
        reasoningMultiplier: getReasoningMultiplier(model).multiplier,
      })),
    };
  }, [config, numFirms]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">IO Laboratory - Cournot Competition</h1>

      {!connected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Connecting to server...
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Competition Mode & Market Structure */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Competition Mode & Market Structure</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Competition Mode */}
          <div>
            <label className="block text-sm font-medium mb-2">Competition Type</label>
            <div className="flex gap-4">
              {COMPETITION_MODES.map((mode) => (
                <label key={mode.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="competitionMode"
                    value={mode.value}
                    checked={competitionMode === mode.value}
                    onChange={() => setConfig({ competitionMode: mode.value })}
                    disabled={isRunning}
                    className="text-blue-600"
                  />
                  <span className="text-sm">{mode.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {COMPETITION_MODES.find(m => m.value === competitionMode)?.description}
            </p>
          </div>

          {/* Number of Firms */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Number of Firms: <span className="font-bold text-blue-600">{numFirms}</span>
            </label>
            <input
              type="range"
              min="2"
              max="10"
              value={numFirms}
              onChange={(e) => handleNumFirmsChange(parseInt(e.target.value))}
              className="w-full"
              disabled={isRunning}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>2 (Duopoly)</span>
              <span>10 (Decapoly)</span>
            </div>
          </div>

          {/* Product Differentiation (Gamma) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Product Differentiation (γ): <span className="font-bold text-blue-600">{gamma.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={gamma}
              onChange={(e) => setConfig({ gamma: parseFloat(e.target.value) })}
              className="w-full"
              disabled={isRunning}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0 (Independent)</span>
              <span>1 (Homogeneous)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Demand Parameters */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Demand Function</h2>

          {/* Demand Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Function Type</label>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="demandType"
                  value="linear"
                  checked={demandFunctionType === 'linear'}
                  onChange={() => handleDemandTypeChange('linear')}
                  disabled={isRunning}
                  className="text-blue-600"
                />
                <span className="text-sm">Linear</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="demandType"
                  value="ces"
                  checked={demandFunctionType === 'ces'}
                  onChange={() => handleDemandTypeChange('ces')}
                  disabled={isRunning}
                  className="text-blue-600"
                />
                <span className="text-sm">CES</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="demandType"
                  value="logit"
                  checked={demandFunctionType === 'logit'}
                  onChange={() => handleDemandTypeChange('logit')}
                  disabled={isRunning}
                  className="text-blue-600"
                />
                <span className="text-sm">Logit</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="demandType"
                  value="exponential"
                  checked={demandFunctionType === 'exponential'}
                  onChange={() => handleDemandTypeChange('exponential')}
                  disabled={isRunning}
                  className="text-blue-600"
                />
                <span className="text-sm">Exponential</span>
              </label>
            </div>
          </div>

          {/* Formula Display */}
          <p className="text-sm text-gray-600 mb-4 font-mono bg-gray-50 p-2 rounded">
            {competitionMode === 'bertrand' ? (
              <>
                {demandFunctionType === 'linear' && (gamma < 1
                  ? (() => {
                      const aCoeff = (1 - gamma);
                      const ownCoeff = 1 + (numFirms - 2) * gamma;
                      const crossCoeff = gamma;
                      const denomCoeff = (1 - gamma) * (1 + (numFirms - 1) * gamma);
                      const pOwn = Math.abs(ownCoeff - 1) < 0.001 ? 'p_i' : `${ownCoeff.toFixed(2)}×p_i`;
                      const pOther = numFirms === 2 ? `${crossCoeff.toFixed(2)}×p_j` : `${crossCoeff.toFixed(2)}×Σp_j`;
                      return `q_i = (${aCoeff.toFixed(2)}×a - ${pOwn} + ${pOther}) / (${denomCoeff.toFixed(2)}×b)`;
                    })()
                  : 'Q(P) = (a - P) / b')}
                {demandFunctionType === 'ces' && (gamma < 1
                  ? `q_i + ${gamma.toFixed(2)}×Σq_j = (p_i / A)^(-σ)`
                  : 'Q(P) = (P / A)^(-σ)')}
                {demandFunctionType === 'logit' && (gamma < 1
                  ? `q_i + ${gamma.toFixed(2)}×Σq_j = e^((a - p_i) / b)`
                  : 'Q(P) = e^((a - P) / b)')}
                {demandFunctionType === 'exponential' && (gamma < 1
                  ? `q_i + ${gamma.toFixed(2)}×Σq_j = ln(A / p_i) / b`
                  : 'Q(P) = ln(A / P) / b')}
              </>
            ) : (
              <>
                {demandFunctionType === 'linear' && (gamma < 1
                  ? `p_i = a - b×(q_i + ${gamma.toFixed(2)}×Σq_j)`
                  : 'P(Q) = a - b × Q')}
                {demandFunctionType === 'ces' && (gamma < 1
                  ? `p_i = A × (q_i + ${gamma.toFixed(2)}×Σq_j)^(-1/σ)`
                  : 'P(Q) = A × Q^(-1/σ)')}
                {demandFunctionType === 'logit' && (gamma < 1
                  ? `p_i = a - b × ln(q_i + ${gamma.toFixed(2)}×Σq_j)`
                  : 'P(Q) = a - b × ln(Q)')}
                {demandFunctionType === 'exponential' && (gamma < 1
                  ? `p_i = A × e^(-b×(q_i + ${gamma.toFixed(2)}×Σq_j))`
                  : 'P(Q) = A × e^(-bQ)')}
              </>
            )}
          </p>

          {/* Per-Firm Demand Toggle */}
          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={config.usePerFirmDemand || false}
              onChange={(e) => handlePerFirmDemandToggle(e.target.checked)}
              disabled={isRunning}
              className="rounded"
            />
            <span className="text-sm font-medium">Per-firm demand parameters</span>
          </label>
          {config.usePerFirmDemand && (
            <p className="text-xs text-gray-500 mb-3 -mt-1">
              Each firm has its own demand parameters. Edit in firm cards below.
            </p>
          )}

          <div className="space-y-4">
            {/* Linear Demand Inputs */}
            {demandFunctionType === 'linear' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Demand Intercept (a)
                  </label>
                  <input
                    type="number"
                    value={config.demandIntercept}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig({
                        demandIntercept: val,
                        demandFunction: {
                          type: 'linear',
                          intercept: fixedParam(val),
                          slope: fixedParam(config.demandSlope),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Demand Slope (b)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={config.demandSlope}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setConfig({
                        demandSlope: val,
                        demandFunction: {
                          type: 'linear',
                          intercept: fixedParam(config.demandIntercept),
                          slope: fixedParam(val),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                </div>
              </>
            )}

            {/* CES Demand Inputs */}
            {demandFunctionType === 'ces' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Scale Parameter (A)
                  </label>
                  <input
                    type="number"
                    value={cesScale}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 100;
                      setConfig({
                        demandFunction: {
                          type: 'ces',
                          scale: fixedParam(val),
                          substitutionElasticity: fixedParam(cesSubstitutionElasticity),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-gray-500 mt-1">Scales the price level</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Substitution Elasticity (σ)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={cesSubstitutionElasticity}
                    onChange={(e) => {
                      const val = Math.max(0.1, parseFloat(e.target.value) || 2);
                      setConfig({
                        demandFunction: {
                          type: 'ces',
                          scale: fixedParam(cesScale),
                          substitutionElasticity: fixedParam(val),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    σ &gt; 1: substitutes, σ &lt; 1: complements
                  </p>
                </div>
              </>
            )}

            {/* Logit Demand Inputs */}
            {demandFunctionType === 'logit' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Intercept (a)
                  </label>
                  <input
                    type="number"
                    value={logitIntercept}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 100;
                      setConfig({
                        demandFunction: {
                          type: 'logit',
                          intercept: fixedParam(val),
                          priceCoefficient: fixedParam(logitPriceCoefficient),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-gray-500 mt-1">Base price level at Q=1</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Price Coefficient (b)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={logitPriceCoefficient}
                    onChange={(e) => {
                      const val = Math.max(0.1, parseFloat(e.target.value) || 10);
                      setConfig({
                        demandFunction: {
                          type: 'logit',
                          intercept: fixedParam(logitIntercept),
                          priceCoefficient: fixedParam(val),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How fast price drops as ln(Q) increases
                  </p>
                </div>
              </>
            )}

            {/* Exponential Demand Inputs */}
            {demandFunctionType === 'exponential' && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Scale Parameter (A)
                  </label>
                  <input
                    type="number"
                    value={exponentialScale}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 100;
                      setConfig({
                        demandFunction: {
                          type: 'exponential',
                          scale: fixedParam(val),
                          decayRate: fixedParam(exponentialDecayRate),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum price (at Q=0)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Decay Rate (b)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={exponentialDecayRate}
                    onChange={(e) => {
                      const val = Math.max(0.001, parseFloat(e.target.value) || 0.01);
                      setConfig({
                        demandFunction: {
                          type: 'exponential',
                          scale: fixedParam(exponentialScale),
                          decayRate: fixedParam(val),
                        },
                      });
                    }}
                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                    disabled={isRunning}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    How fast price decays with quantity
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Game Settings */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Game Settings</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Number of Rounds
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={config.totalRounds}
                onChange={(e) => setConfig({ totalRounds: parseInt(e.target.value) || 1 })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Firm Cards */}
      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-4">Firm Configuration</h2>
        <div className={`grid gap-4 ${numFirms <= 2 ? 'grid-cols-1 md:grid-cols-2' : numFirms <= 4 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
          {Array.from({ length: numFirms }, (_, i) => {
            const firmId = i + 1;
            const firmData = getFirmConfig(config, firmId);
            const colorClass = FIRM_COLOR_CLASSES[i] || FIRM_COLOR_CLASSES[0];

            return (
              <div key={firmId} className={`bg-white p-4 rounded-lg shadow border-l-4 ${colorClass.border}`}>
                <h3 className={`font-semibold mb-3 ${colorClass.text}`}>Firm {firmId}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Linear Cost (c)</label>
                    <input
                      type="number"
                      value={firmData.linearCost}
                      onChange={(e) => handleFirmConfigChange(firmId, { linearCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Quadratic Cost (d)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={firmData.quadraticCost}
                      onChange={(e) => handleFirmConfigChange(firmId, { quadraticCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning}
                    />
                  </div>
                  {/* Per-firm demand parameters (when enabled) */}
                  {config.usePerFirmDemand && (
                    <div className="border-t pt-2 mt-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Demand</p>
                      {demandFunctionType === 'linear' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium mb-1">Intercept (a)</label>
                            <input
                              type="number"
                              value={getFirmDemandParamValue(i, 'intercept', config.demandIntercept)}
                              onChange={(e) => handleFirmDemandChange(i, 'intercept', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Slope (b)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={getFirmDemandParamValue(i, 'slope', config.demandSlope)}
                              onChange={(e) => handleFirmDemandChange(i, 'slope', parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                        </>
                      )}
                      {demandFunctionType === 'ces' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium mb-1">Scale (A)</label>
                            <input
                              type="number"
                              value={getFirmDemandParamValue(i, 'scale', cesScale)}
                              onChange={(e) => handleFirmDemandChange(i, 'scale', parseFloat(e.target.value) || 100)}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Elast. (σ)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={getFirmDemandParamValue(i, 'substitutionElasticity', cesSubstitutionElasticity)}
                              onChange={(e) => handleFirmDemandChange(i, 'substitutionElasticity', Math.max(0.1, parseFloat(e.target.value) || 2))}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                        </>
                      )}
                      {demandFunctionType === 'logit' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium mb-1">Intercept (a)</label>
                            <input
                              type="number"
                              value={getFirmDemandParamValue(i, 'intercept', logitIntercept)}
                              onChange={(e) => handleFirmDemandChange(i, 'intercept', parseFloat(e.target.value) || 100)}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Price Coeff. (b)</label>
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              value={getFirmDemandParamValue(i, 'priceCoefficient', logitPriceCoefficient)}
                              onChange={(e) => handleFirmDemandChange(i, 'priceCoefficient', Math.max(0.1, parseFloat(e.target.value) || 10))}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                        </>
                      )}
                      {demandFunctionType === 'exponential' && (
                        <>
                          <div>
                            <label className="block text-xs font-medium mb-1">Scale (A)</label>
                            <input
                              type="number"
                              value={getFirmDemandParamValue(i, 'scale', exponentialScale)}
                              onChange={(e) => handleFirmDemandChange(i, 'scale', parseFloat(e.target.value) || 100)}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Decay (b)</label>
                            <input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={getFirmDemandParamValue(i, 'decayRate', exponentialDecayRate)}
                              onChange={(e) => handleFirmDemandChange(i, 'decayRate', Math.max(0.001, parseFloat(e.target.value) || 0.01))}
                              className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                              disabled={isRunning}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium mb-1">LLM Model</label>
                    <select
                      value={firmData.model}
                      onChange={(e) => handleFirmConfigChange(firmId, { model: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500"
                      disabled={isRunning}
                    >
                      {AVAILABLE_MODELS.map((model) => (
                        <option key={model.value} value={model.value}>
                          {model.label} (${model.inputPrice}/${model.outputPrice})
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      {AVAILABLE_MODELS.find(m => m.value === firmData.model)?.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Settings Toggle */}
      <div className="mt-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          disabled={isRunning}
        >
          <span>{showAdvanced ? '▼' : '▶'}</span>
          Advanced Settings
        </button>
      </div>

      {/* Advanced Settings Panel */}
      {showAdvanced && (
        <AdvancedSettings
          config={config}
          setConfig={setConfig}
          disabled={isRunning}
        />
      )}

      {/* Theoretical Equilibria */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* N-Poly Nash Equilibrium */}
        {nPolyEquilibrium && (
          <div className="bg-blue-50 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-blue-800">
              Nash {competitionMode === 'bertrand' ? 'Bertrand' : 'Cournot'} Equilibrium
            </h2>
            {nPolyEquilibrium.calculable === false ? (
              <div className="text-center py-4">
                <p className="text-gray-500 italic">N/A</p>
                <p className="text-xs text-gray-400 mt-2">
                  {nPolyEquilibrium.message || 'Nash equilibrium not analytically calculable for non-linear demand'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {nPolyEquilibrium.firms.map((firm, i) => (
                  <div key={firm.firmId} className="flex justify-between items-center">
                    <span className={FIRM_COLOR_CLASSES[i]?.text || 'text-gray-600'}>
                      Firm {firm.firmId}:
                    </span>
                    <span className="font-bold">
                      q={firm.quantity.toFixed(2)}, π={firm.profit.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t mt-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Quantity:</span>
                    <span className="font-bold">{nPolyEquilibrium.totalQuantity.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Avg Price:</span>
                    <span className="font-bold">{nPolyEquilibrium.avgMarketPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Profit:</span>
                    <span className="font-bold">{nPolyEquilibrium.totalProfit.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cooperative Equilibrium (only show for duopoly) */}
        {numFirms === 2 && cooperativeEquilibrium && (
          <div className="bg-green-50 p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4 text-green-800">Cooperative Equilibrium (Monopoly)</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Firm 1 Quantity:</span>
                <span className="block text-lg font-bold">{cooperativeEquilibrium.firm1Quantity.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Firm 2 Quantity:</span>
                <span className="block text-lg font-bold">{cooperativeEquilibrium.firm2Quantity.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Total Quantity:</span>
                <span className="block text-lg font-bold">{cooperativeEquilibrium.totalQuantity.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Market Price:</span>
                <span className="block text-lg font-bold">{cooperativeEquilibrium.marketPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Firm 1 Profit:</span>
                <span className="block text-lg font-bold">{cooperativeEquilibrium.firm1Profit.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-600">Firm 2 Profit:</span>
                <span className="block text-lg font-bold">{cooperativeEquilibrium.firm2Profit.toFixed(2)}</span>
              </div>
              <div className="col-span-2 pt-2 border-t">
                <span className="text-gray-600">Total Profit:</span>
                <span className="block text-lg font-bold text-green-700">{cooperativeEquilibrium.totalProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Limit-Pricing Analysis (only for duopoly with gamma < 1) */}
        {numFirms === 2 && limitPricingAnalysis && gamma < 1 && (
          <div className={`p-6 rounded-lg shadow ${
            limitPricingAnalysis.isInMonopolyRegion
              ? 'bg-red-50'
              : limitPricingAnalysis.isInLimitPricingRegion
              ? 'bg-yellow-50'
              : 'bg-green-50'
          }`}>
            <h2 className={`text-xl font-semibold mb-4 ${
              limitPricingAnalysis.isInMonopolyRegion
                ? 'text-red-800'
                : limitPricingAnalysis.isInLimitPricingRegion
                ? 'text-yellow-800'
                : 'text-green-800'
            }`}>
              Limit-Pricing Analysis (Zanchettin 2006)
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Asymmetry Index (a):</span>
                <span className="font-bold">{limitPricingAnalysis.asymmetryIndex.toFixed(3)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Limit-pricing threshold:</span>
                <span className="font-mono text-xs">
                  [{limitPricingAnalysis.limitPricingThresholdLow.toFixed(3)}, {limitPricingAnalysis.limitPricingThresholdHigh.toFixed(3)})
                </span>
              </div>
              <div className="pt-2 border-t mt-2">
                <p className={`font-medium ${
                  limitPricingAnalysis.isInMonopolyRegion
                    ? 'text-red-700'
                    : limitPricingAnalysis.isInLimitPricingRegion
                    ? 'text-yellow-700'
                    : 'text-green-700'
                }`}>
                  {limitPricingAnalysis.analysisMessage}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cost Estimation */}
      <div className="mt-6 bg-amber-50 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4 text-amber-800">Estimated Experiment Cost</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-2xl font-bold text-amber-600">
              ${costEstimate.estimatedCost.toFixed(4)}
            </div>
            <div className="text-sm text-gray-600">Estimated Total Cost</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-lg font-bold text-gray-700">
              {(costEstimate.totalInputTokens / 1000).toFixed(1)}K / {(costEstimate.totalOutputTokens / 1000).toFixed(1)}K
            </div>
            <div className="text-sm text-gray-600">Input / Output Tokens</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg">
            <div className="text-lg font-bold text-gray-700">
              {config.totalRounds} × {config.numReplications || 1} × {numFirms}
            </div>
            <div className="text-sm text-gray-600">Rounds × Replications × Firms</div>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          <strong>Models:</strong>{' '}
          {costEstimate.modelBreakdown.map((mb, i) => (
            <span key={mb.model}>
              {i > 0 && ', '}
              {mb.model} (×{mb.count}, ${mb.modelInfo?.inputPrice ?? '?'}/${mb.modelInfo?.outputPrice ?? '?'}/M
              {mb.reasoningMultiplier > 1 && (
                <span className="text-orange-600"> ×{mb.reasoningMultiplier} reasoning</span>
              )}
              )
            </span>
          ))}
          {config.communication?.allowCommunication && (
            <span className="ml-2 text-amber-600">
              +Communication ({config.communication.messagesPerRound} msgs/round)
            </span>
          )}
        </div>
        {costEstimate.hasReasoningModels && (
          <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg text-xs text-orange-800">
            <strong>⚠️ Reasoning Cost Warning:</strong> Models with reasoning ({costEstimate.reasoningLevels.join(', ')}) generate additional "reasoning tokens" that are billed as output tokens.
            The multipliers shown ({costEstimate.reasoningLevels.map(l => {
              const mult = l === 'none' ? '1×' : l === 'low' ? '1.5×' : l === 'medium' ? '2.5×' : l === 'high' ? '4×' : '8×';
              return `${l}: ${mult}`;
            }).join(', ')}) are <strong>approximate estimates</strong>. Actual costs may vary significantly depending on task complexity.
          </div>
        )}
      </div>

      {/* Start Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={handleConfigureAndStart}
          disabled={!canStart}
          className={`px-8 py-3 rounded-lg text-white font-semibold ${
            canStart
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isRunning ? 'Game Running...' : `Start Game (~$${costEstimate.estimatedCost.toFixed(4)})`}
        </button>
      </div>
    </div>
  );
}
