import { useState } from 'react';
import { CournotConfig, InformationDisclosure } from '../types/game';

interface AdvancedSettingsProps {
  config: CournotConfig;
  setConfig: (config: Partial<CournotConfig>) => void;
  disabled: boolean;
}

export function AdvancedSettings({ config, setConfig, disabled }: AdvancedSettingsProps) {
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  const updateFirm1Info = (updates: Partial<InformationDisclosure>) => {
    setConfig({
      firm1Info: { ...config.firm1Info, ...updates },
    });
  };

  const updateFirm2Info = (updates: Partial<InformationDisclosure>) => {
    setConfig({
      firm2Info: { ...config.firm2Info, ...updates },
    });
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
        <h2 className="text-xl font-semibold mb-4">Information Disclosure</h2>
        <p className="text-sm text-gray-600 mb-4">
          Control what information each LLM receives about the game
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Firm 1 Info */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-blue-600 mb-3">Firm 1</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm1Info.revealDemandFunction}
                  onChange={(e) => updateFirm1Info({ revealDemandFunction: e.target.checked })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Reveal demand function (P = a - bQ)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm1Info.revealOwnCosts}
                  onChange={(e) => updateFirm1Info({ revealOwnCosts: e.target.checked })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Reveal own cost function</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm1Info.revealRivalCosts}
                  onChange={(e) => updateFirm1Info({ revealRivalCosts: e.target.checked })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Reveal rival's cost function</span>
              </label>
              <hr className="my-2" />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm1Info.revealRivalIsLLM}
                  onChange={(e) => updateFirm1Info({
                    revealRivalIsLLM: e.target.checked,
                    describeRivalAsHuman: e.target.checked ? false : config.firm1Info.describeRivalAsHuman
                  })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Tell that rival is an LLM</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm1Info.describeRivalAsHuman}
                  onChange={(e) => updateFirm1Info({
                    describeRivalAsHuman: e.target.checked,
                    revealRivalIsLLM: e.target.checked ? false : config.firm1Info.revealRivalIsLLM
                  })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Describe rival as human subject</span>
              </label>
            </div>
          </div>

          {/* Firm 2 Info */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-red-600 mb-3">Firm 2</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm2Info.revealDemandFunction}
                  onChange={(e) => updateFirm2Info({ revealDemandFunction: e.target.checked })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Reveal demand function (P = a - bQ)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm2Info.revealOwnCosts}
                  onChange={(e) => updateFirm2Info({ revealOwnCosts: e.target.checked })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Reveal own cost function</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm2Info.revealRivalCosts}
                  onChange={(e) => updateFirm2Info({ revealRivalCosts: e.target.checked })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Reveal rival's cost function</span>
              </label>
              <hr className="my-2" />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm2Info.revealRivalIsLLM}
                  onChange={(e) => updateFirm2Info({
                    revealRivalIsLLM: e.target.checked,
                    describeRivalAsHuman: e.target.checked ? false : config.firm2Info.describeRivalAsHuman
                  })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Tell that rival is an LLM</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.firm2Info.describeRivalAsHuman}
                  onChange={(e) => updateFirm2Info({
                    describeRivalAsHuman: e.target.checked,
                    revealRivalIsLLM: e.target.checked ? false : config.firm2Info.revealRivalIsLLM
                  })}
                  disabled={disabled}
                  className="rounded"
                />
                <span className="text-sm">Describe rival as human subject</span>
              </label>
            </div>
          </div>
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
                  max="10"
                  value={config.communication.messagesPerRound}
                  onChange={(e) => setConfig({
                    communication: { ...config.communication, messagesPerRound: parseInt(e.target.value) || 1 }
                  })}
                  className="w-32 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                  disabled={disabled}
                />
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
              Available variables: {'{firmNumber}'}, {'{totalRounds}'}, {'{demandIntercept}'}, {'{demandSlope}'},
              {'{ownLinearCost}'}, {'{ownQuadraticCost}'}, {'{rivalLinearCost}'}, {'{rivalQuadraticCost}'}
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
