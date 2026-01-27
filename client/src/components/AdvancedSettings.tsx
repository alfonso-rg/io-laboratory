import { useState } from 'react';
import {
  CournotConfig,
  InformationDisclosure,
  FIRM_COLORS,
  getNumFirms,
  DEFAULT_INFO_DISCLOSURE,
} from '../types/game';

interface AdvancedSettingsProps {
  config: CournotConfig;
  setConfig: (config: Partial<CournotConfig>) => void;
  disabled: boolean;
}

export function AdvancedSettings({ config, setConfig, disabled }: AdvancedSettingsProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);
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
          <button
            onClick={() => setShowPromptEditor(!showPromptEditor)}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {showPromptEditor ? 'Hide' : 'Show'} Editor
          </button>
        </div>

        {showPromptEditor && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Available variables: {'{firmNumber}'}, {'{numFirms}'}, {'{totalRounds}'}, {'{demandIntercept}'}, {'{demandSlope}'},
              {'{gamma}'}, {'{competitionMode}'}, {'{ownLinearCost}'}, {'{ownQuadraticCost}'}
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">
                Custom System Prompt (leave empty for default)
              </label>
              <textarea
                value={config.customSystemPrompt || ''}
                onChange={(e) => setConfig({ customSystemPrompt: e.target.value || undefined })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={10}
                placeholder="Leave empty to use the default prompt with information disclosure settings..."
                disabled={disabled}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
