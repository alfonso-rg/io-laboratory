import { useGameStore } from '../../stores/gameStore';
import { useSocket } from '../../hooks/useSocket';
import { QuantityChart } from './QuantityChart';

export function GameBoard() {
  const { gameState, firmThinking, latestDecisions, currentCommunication } = useGameStore();
  const { pauseGame, resumeGame, resetGame } = useSocket();

  if (!gameState) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-500">No game in progress</div>
      </div>
    );
  }

  const { config, rounds, nashEquilibrium, currentRound, currentReplication, replications, status } = gameState;
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const numReplications = config.numReplications || 1;
  const hasCommunication = config.communication?.allowCommunication;

  // Calculate cumulative profits
  const cumulativeProfits = rounds.reduce(
    (acc, round) => ({
      firm1: acc.firm1 + round.firm1Profit,
      firm2: acc.firm2 + round.firm2Profit,
    }),
    { firm1: 0, firm2: 0 }
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Cournot Competition</h1>
          <p className="text-gray-600">
            {numReplications > 1 && (
              <span className="font-medium">Replication {currentReplication} of {numReplications} - </span>
            )}
            Round {currentRound} of {config.totalRounds}
          </p>
        </div>

        <div className="flex gap-2">
          {isRunning && (
            <button
              onClick={pauseGame}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Pause
            </button>
          )}
          {isPaused && (
            <button
              onClick={resumeGame}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Resume
            </button>
          )}
          <button
            onClick={resetGame}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mb-4">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            isRunning
              ? 'bg-green-100 text-green-800'
              : isPaused
              ? 'bg-yellow-100 text-yellow-800'
              : isCompleted
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Firm Status Cards */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Firm 1 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-blue-600">Firm 1</h2>
            <span className="text-sm text-gray-500">{config.firm1Model}</span>
          </div>

          {firmThinking.firm1 ? (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              Thinking...
            </div>
          ) : latestDecisions.firm1 ? (
            <div>
              <div className="text-3xl font-bold text-blue-600">
                q = {latestDecisions.firm1.quantity.toFixed(2)}
              </div>
              {latestDecisions.firm1.reasoning && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                  {latestDecisions.firm1.reasoning}
                </p>
              )}
            </div>
          ) : (
            <div className="text-gray-400">Waiting...</div>
          )}

          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Nash Quantity:</span>
              <span className="font-medium">{nashEquilibrium.firm1Quantity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cumulative Profit:</span>
              <span className="font-medium">{cumulativeProfits.firm1.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Firm 2 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-red-600">Firm 2</h2>
            <span className="text-sm text-gray-500">{config.firm2Model}</span>
          </div>

          {firmThinking.firm2 ? (
            <div className="flex items-center gap-2 text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
              Thinking...
            </div>
          ) : latestDecisions.firm2 ? (
            <div>
              <div className="text-3xl font-bold text-red-600">
                q = {latestDecisions.firm2.quantity.toFixed(2)}
              </div>
              {latestDecisions.firm2.reasoning && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                  {latestDecisions.firm2.reasoning}
                </p>
              )}
            </div>
          ) : (
            <div className="text-gray-400">Waiting...</div>
          )}

          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Nash Quantity:</span>
              <span className="font-medium">{nashEquilibrium.firm2Quantity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Cumulative Profit:</span>
              <span className="font-medium">{cumulativeProfits.firm2.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Communication Panel */}
      {hasCommunication && currentCommunication.length > 0 && (
        <div className="bg-purple-50 p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4 text-purple-800">Communication (Round {currentRound})</h2>
          <div className="space-y-2">
            {currentCommunication.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg ${
                  msg.firm === 1
                    ? 'bg-blue-100 ml-0 mr-12'
                    : 'bg-red-100 ml-12 mr-0'
                }`}
              >
                <span className={`font-semibold ${msg.firm === 1 ? 'text-blue-600' : 'text-red-600'}`}>
                  Firm {msg.firm}:
                </span>
                <span className="ml-2">{msg.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart */}
      {rounds.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Quantity History</h2>
          <QuantityChart rounds={rounds} nashEquilibrium={nashEquilibrium} />
        </div>
      )}

      {/* Results Table */}
      {rounds.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Round Results</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Round</th>
                  <th className="px-4 py-2 text-right text-blue-600">q1</th>
                  <th className="px-4 py-2 text-right text-red-600">q2</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right text-blue-600">Profit 1</th>
                  <th className="px-4 py-2 text-right text-red-600">Profit 2</th>
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr key={round.roundNumber} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{round.roundNumber}</td>
                    <td className="px-4 py-2 text-right text-blue-600">
                      {round.firm1Quantity.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {round.firm2Quantity.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">{round.marketPrice.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-blue-600">
                      {round.firm1Profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {round.firm2Profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {/* Nash reference row */}
                <tr className="bg-gray-100 font-medium">
                  <td className="px-4 py-2">Nash</td>
                  <td className="px-4 py-2 text-right text-blue-600">
                    {nashEquilibrium.firm1Quantity.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-red-600">
                    {nashEquilibrium.firm2Quantity.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right">{nashEquilibrium.marketPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-blue-600">
                    {nashEquilibrium.firm1Profit.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-red-600">
                    {nashEquilibrium.firm2Profit.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Completed Replications Summary */}
      {replications && replications.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mt-6">
          <h2 className="text-xl font-semibold mb-4">Completed Replications</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Rep #</th>
                  <th className="px-4 py-2 text-right text-blue-600">Avg q1</th>
                  <th className="px-4 py-2 text-right text-red-600">Avg q2</th>
                  <th className="px-4 py-2 text-right">Avg Price</th>
                  <th className="px-4 py-2 text-right text-blue-600">Total Profit 1</th>
                  <th className="px-4 py-2 text-right text-red-600">Total Profit 2</th>
                </tr>
              </thead>
              <tbody>
                {replications.map((rep) => (
                  <tr key={rep.replicationNumber} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">{rep.replicationNumber}</td>
                    <td className="px-4 py-2 text-right text-blue-600">
                      {rep.summary.avgFirm1Quantity.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {rep.summary.avgFirm2Quantity.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">{rep.summary.avgMarketPrice.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-blue-600">
                      {rep.summary.totalFirm1Profit.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right text-red-600">
                      {rep.summary.totalFirm2Profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
