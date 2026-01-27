import { useMemo, useState } from 'react';
import {
  useGameStore,
  calculateNashEquilibrium,
  calculateCooperativeEquilibrium,
  calculateNPolyCournotEquilibrium,
  calculateLimitPricingAnalysis,
} from '../stores/gameStore';
import { useSocket } from '../hooks/useSocket';
import {
  AVAILABLE_MODELS,
  COMPETITION_MODES,
  FIRM_COLORS,
  FIRM_COLOR_CLASSES,
  DEFAULT_INFO_DISCLOSURE,
  getNumFirms,
  getGamma,
  getCompetitionMode,
  getFirmConfig,
  createDefaultFirms,
  FirmConfig,
} from '../types/game';
import { AdvancedSettings } from './AdvancedSettings';

export function HomePage() {
  const { config, setConfig, gameState, connected, error } = useGameStore();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { configureGame, startGame } = useSocket();

  const numFirms = getNumFirms(config);
  const gamma = getGamma(config);
  const competitionMode = getCompetitionMode(config);

  // Legacy equilibrium (for duopoly backward compatibility)
  const nashEquilibrium = useMemo(() => calculateNashEquilibrium(config), [config]);
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
    setConfig({ numFirms: newNumFirms, firms });
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

    // Per-firm tokens per round
    let inputPerFirmPerRound = avgInputTokensPerRound;
    let outputPerFirmPerRound = outputTokensPerDecision;

    // Add communication tokens if enabled
    if (hasCommunication) {
      const messagesPerFirm = Math.ceil(messagesPerRound / numFirms);
      inputPerFirmPerRound += communicationInputTokens * messagesPerFirm;
      outputPerFirmPerRound += communicationOutputTokens * messagesPerFirm;
    }

    // Total tokens
    const totalInputTokens = inputPerFirmPerRound * numFirms * totalRounds * numReps;
    const totalOutputTokens = outputPerFirmPerRound * numFirms * totalRounds * numReps;

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

    // Calculate weighted average cost
    let totalCost = 0;
    Object.entries(modelCounts).forEach(([modelName, count]) => {
      const modelInfo = AVAILABLE_MODELS.find(m => m.value === modelName);
      if (modelInfo) {
        const firmFraction = count / numFirms;
        const inputCost = (totalInputTokens * firmFraction / 1_000_000) * modelInfo.inputPrice;
        const outputCost = (totalOutputTokens * firmFraction / 1_000_000) * modelInfo.outputPrice;
        totalCost += inputCost + outputCost;
      }
    });

    return {
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost: totalCost,
      modelBreakdown: Object.entries(modelCounts).map(([model, count]) => ({
        model,
        count,
        modelInfo: AVAILABLE_MODELS.find(m => m.value === model),
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
          <p className="text-sm text-gray-600 mb-4">
            {gamma < 1
              ? `p_i = a - b×(q_i + ${gamma.toFixed(2)}×Σq_j)`
              : 'P(Q) = a - b × Q'}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Demand Intercept (a)
              </label>
              <input
                type="number"
                value={config.demandIntercept}
                onChange={(e) => setConfig({ demandIntercept: parseFloat(e.target.value) || 0 })}
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
                onChange={(e) => setConfig({ demandSlope: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
            </div>
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
              {mb.model} (×{mb.count}, ${mb.modelInfo?.inputPrice ?? '?'}/${mb.modelInfo?.outputPrice ?? '?'}/M)
            </span>
          ))}
          {config.communication?.allowCommunication && (
            <span className="ml-2 text-amber-600">
              +Communication ({config.communication.messagesPerRound} msgs/round)
            </span>
          )}
        </div>
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
