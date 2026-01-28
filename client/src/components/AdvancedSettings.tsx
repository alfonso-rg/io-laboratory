import { useState } from 'react';
import {
  CournotConfig,
  InformationDisclosure,
  FIRM_COLORS,
  getNumFirms,
  getGamma,
  getCompetitionMode,
  getFirmConfig,
  DEFAULT_INFO_DISCLOSURE,
} from '../types/game';

interface AdvancedSettingsProps {
  config: CournotConfig;
  setConfig: (config: Partial<CournotConfig>) => void;
  disabled: boolean;
}

// Generate the default system prompt (mirrors server logic)
function generateDefaultPrompt(config: CournotConfig, firmNumber: number): string {
  const numFirms = getNumFirms(config);
  const gamma = getGamma(config);
  const mode = getCompetitionMode(config);
  const firmConfig = getFirmConfig(config, firmNumber);
  const info = firmConfig.info;
  const ownLinearCost = firmConfig.linearCost;
  const ownQuadraticCost = firmConfig.quadraticCost;
  const rivalLinearCost = numFirms === 2 ? getFirmConfig(config, firmNumber === 1 ? 2 : 1).linearCost : 0;
  const rivalQuadraticCost = numFirms === 2 ? getFirmConfig(config, firmNumber === 1 ? 2 : 1).quadraticCost : 0;

  const isBertrand = mode === 'bertrand';
  const competitionType = isBertrand ? 'price' : 'quantity';
  const decisionVar = isBertrand ? 'price' : 'production quantity';
  const rivalTerm = numFirms === 2 ? 'another firm' : `${numFirms - 1} other firms`;

  let prompt = `You are Firm ${firmNumber} in a ${competitionType} competition game.\n\n`;
  prompt += 'GAME RULES:\n';
  prompt += `- You compete with ${rivalTerm} in the same market\n`;
  prompt += `- Each round, all firms simultaneously choose their ${decisionVar}\n`;

  if (info.revealDemandFunction) {
    if (isBertrand) {
      if (gamma < 1) {
        prompt += `- Products are differentiated (γ = ${gamma.toFixed(2)}). Your demand depends on your price and competitors' prices.\n`;
        prompt += `- Base demand: approximately q = (${config.demandIntercept} - your_price + ${gamma.toFixed(2)} × avg_competitor_price_diff) / ${config.demandSlope}\n`;
      } else {
        prompt += `- Products are homogeneous. Market demand: Q = (${config.demandIntercept} - P) / ${config.demandSlope}\n`;
        prompt += '- The firm with the lowest price captures most/all of the market.\n';
      }
    } else {
      if (gamma < 1) {
        prompt += `- Products are differentiated (γ = ${gamma.toFixed(2)}). Your price depends on your quantity and competitors' quantities.\n`;
        prompt += `- Your price: p = ${config.demandIntercept} - ${config.demandSlope} × (your_q + ${gamma.toFixed(2)} × sum_of_others_q)\n`;
      } else {
        if (numFirms === 2) {
          prompt += `- Market price is determined by total quantity: P = ${config.demandIntercept} - ${config.demandSlope} × (q1 + q2)\n`;
        } else {
          prompt += `- Market price is determined by total quantity: P = ${config.demandIntercept} - ${config.demandSlope} × (q1 + q2 + ... + q${numFirms})\n`;
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
    let costDescription = `C(q) = ${ownLinearCost} × q`;
    if (ownQuadraticCost > 0) {
      costDescription += ` + ${ownQuadraticCost} × q²`;
    }
    prompt += `- Your cost function: ${costDescription}\n`;
    if (isBertrand) {
      prompt += `- Your marginal cost starts at ${ownLinearCost}\n`;
    }
  } else {
    prompt += '- You have production costs that increase with quantity\n';
  }

  if (info.revealRivalCosts && numFirms === 2) {
    let rivalCostDescription = `C(q) = ${rivalLinearCost} × q`;
    if (rivalQuadraticCost > 0) {
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

  prompt += 'Example response:\n';
  prompt += isBertrand ? '45.0\n' : '25.5\n';
  prompt += `I chose this ${isBertrand ? 'price' : 'quantity'} because...`;

  return prompt;
}

export function AdvancedSettings({ config, setConfig, disabled }: AdvancedSettingsProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const [previewFirm, setPreviewFirm] = useState(1);
  const numFirms = getNumFirms(config);

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
