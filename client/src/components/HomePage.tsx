import { useMemo } from 'react';
import { useGameStore, calculateNashEquilibrium } from '../stores/gameStore';
import { useSocket } from '../hooks/useSocket';
import { AVAILABLE_MODELS } from '../types/game';

export function HomePage() {
  const { config, setConfig, gameState, connected, error } = useGameStore();
  const { configureGame, startGame } = useSocket();

  const nashEquilibrium = useMemo(() => calculateNashEquilibrium(config), [config]);

  const handleConfigureAndStart = () => {
    configureGame(config);
    // Small delay to ensure configuration is processed
    setTimeout(() => {
      startGame();
    }, 100);
  };

  const isRunning = gameState?.status === 'running';
  const canStart = connected && !isRunning;

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Demand Parameters */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Demand Function</h2>
          <p className="text-sm text-gray-600 mb-4">P(Q) = a - b * Q</p>

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

        {/* Firm 1 Costs */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Firm 1 Costs</h2>
          <p className="text-sm text-gray-600 mb-4">C(q) = c * q + d * q^2</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Linear Cost (c1)
              </label>
              <input
                type="number"
                value={config.firm1LinearCost}
                onChange={(e) => setConfig({ firm1LinearCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Quadratic Cost (d1)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.firm1QuadraticCost}
                onChange={(e) => setConfig({ firm1QuadraticCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">LLM Model</label>
              <select
                value={config.firm1Model}
                onChange={(e) => setConfig({ firm1Model: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Firm 2 Costs */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Firm 2 Costs</h2>
          <p className="text-sm text-gray-600 mb-4">C(q) = c * q + d * q^2</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Linear Cost (c2)
              </label>
              <input
                type="number"
                value={config.firm2LinearCost}
                onChange={(e) => setConfig({ firm2LinearCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Quadratic Cost (d2)
              </label>
              <input
                type="number"
                step="0.1"
                value={config.firm2QuadraticCost}
                onChange={(e) => setConfig({ firm2QuadraticCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">LLM Model</label>
              <select
                value={config.firm2Model}
                onChange={(e) => setConfig({ firm2Model: e.target.value })}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
                disabled={isRunning}
              >
                {AVAILABLE_MODELS.map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
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

      {/* Nash Equilibrium Display */}
      {nashEquilibrium && (
        <div className="mt-6 bg-blue-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Theoretical Nash Equilibrium</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm text-gray-600">Firm 1 Quantity:</span>
              <span className="block text-lg font-bold">{nashEquilibrium.firm1Quantity.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Firm 2 Quantity:</span>
              <span className="block text-lg font-bold">{nashEquilibrium.firm2Quantity.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Market Price:</span>
              <span className="block text-lg font-bold">{nashEquilibrium.marketPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Firm 1 Profit:</span>
              <span className="block text-lg font-bold">{nashEquilibrium.firm1Profit.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Firm 2 Profit:</span>
              <span className="block text-lg font-bold">{nashEquilibrium.firm2Profit.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">Total Quantity:</span>
              <span className="block text-lg font-bold">{nashEquilibrium.totalQuantity.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

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
          {isRunning ? 'Game Running...' : 'Start Game'}
        </button>
      </div>
    </div>
  );
}
