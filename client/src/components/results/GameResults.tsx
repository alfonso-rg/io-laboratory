import { useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useSocket } from '../../hooks/useSocket';
import { QuantityChart } from '../game/QuantityChart';

export function GameResults() {
  const { gameState } = useGameStore();
  const { resetGame } = useSocket();

  const summary = useMemo(() => {
    if (!gameState || gameState.rounds.length === 0) return null;

    const { rounds, nashEquilibrium } = gameState;
    const n = rounds.length;

    const totalFirm1Profit = rounds.reduce((sum, r) => sum + r.firm1Profit, 0);
    const totalFirm2Profit = rounds.reduce((sum, r) => sum + r.firm2Profit, 0);
    const avgFirm1Quantity = rounds.reduce((sum, r) => sum + r.firm1Quantity, 0) / n;
    const avgFirm2Quantity = rounds.reduce((sum, r) => sum + r.firm2Quantity, 0) / n;
    const avgMarketPrice = rounds.reduce((sum, r) => sum + r.marketPrice, 0) / n;

    const firm1QuantityDeviation = Math.abs(avgFirm1Quantity - nashEquilibrium.firm1Quantity);
    const firm2QuantityDeviation = Math.abs(avgFirm2Quantity - nashEquilibrium.firm2Quantity);

    const nashTotalProfit = nashEquilibrium.firm1Profit + nashEquilibrium.firm2Profit;
    const actualTotalProfit = (totalFirm1Profit + totalFirm2Profit) / n;

    return {
      totalFirm1Profit,
      totalFirm2Profit,
      avgFirm1Quantity,
      avgFirm2Quantity,
      avgMarketPrice,
      firm1QuantityDeviation,
      firm2QuantityDeviation,
      nashTotalProfit,
      actualTotalProfit,
      winner:
        totalFirm1Profit > totalFirm2Profit
          ? 'Firm 1'
          : totalFirm1Profit < totalFirm2Profit
          ? 'Firm 2'
          : 'Tie',
    };
  }, [gameState]);

  if (!gameState || gameState.status !== 'completed' || !summary) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-500">No completed game to display</div>
      </div>
    );
  }

  const { config, rounds, nashEquilibrium } = gameState;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Game Results</h1>
        <button
          onClick={resetGame}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          New Game
        </button>
      </div>

      {/* Winner Banner */}
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white p-6 rounded-lg shadow mb-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            {summary.winner === 'Tie' ? 'Tie Game!' : `${summary.winner} Wins!`}
          </h2>
          <p className="text-lg">
            After {rounds.length} rounds of competition
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Firm 1 Summary */}
        <div className="bg-blue-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-blue-800 mb-4">
            Firm 1 ({config.firm1Model})
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Profit:</span>
              <span className="font-bold text-blue-600">{summary.totalFirm1Profit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Average Quantity:</span>
              <span className="font-medium">{summary.avgFirm1Quantity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Nash Quantity:</span>
              <span className="font-medium">{nashEquilibrium.firm1Quantity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Deviation from Nash:</span>
              <span
                className={`font-medium ${
                  summary.firm1QuantityDeviation < 2 ? 'text-green-600' : 'text-orange-600'
                }`}
              >
                {summary.firm1QuantityDeviation.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Firm 2 Summary */}
        <div className="bg-red-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold text-red-800 mb-4">
            Firm 2 ({config.firm2Model})
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Profit:</span>
              <span className="font-bold text-red-600">{summary.totalFirm2Profit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Average Quantity:</span>
              <span className="font-medium">{summary.avgFirm2Quantity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Nash Quantity:</span>
              <span className="font-medium">{nashEquilibrium.firm2Quantity.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Deviation from Nash:</span>
              <span
                className={`font-medium ${
                  summary.firm2QuantityDeviation < 2 ? 'text-green-600' : 'text-orange-600'
                }`}
              >
                {summary.firm2QuantityDeviation.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Market Summary */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Market Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">Avg Market Price</div>
            <div className="text-xl font-bold">{summary.avgMarketPrice.toFixed(2)}</div>
            <div className="text-sm text-gray-500">Nash: {nashEquilibrium.marketPrice.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Nash Profit (per round)</div>
            <div className="text-xl font-bold">{summary.nashTotalProfit.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Actual Avg Profit</div>
            <div className="text-xl font-bold">{summary.actualTotalProfit.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Efficiency</div>
            <div
              className={`text-xl font-bold ${
                summary.actualTotalProfit >= summary.nashTotalProfit
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {((summary.actualTotalProfit / summary.nashTotalProfit) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Quantity Chart */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Quantity Evolution</h2>
        <QuantityChart rounds={rounds} nashEquilibrium={nashEquilibrium} />
      </div>

      {/* Full Results Table */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Detailed Round History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left">Round</th>
                <th className="px-4 py-3 text-right text-blue-600">Firm 1 Qty</th>
                <th className="px-4 py-3 text-right text-red-600">Firm 2 Qty</th>
                <th className="px-4 py-3 text-right">Total Qty</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right text-blue-600">Firm 1 Profit</th>
                <th className="px-4 py-3 text-right text-red-600">Firm 2 Profit</th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.roundNumber} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{round.roundNumber}</td>
                  <td className="px-4 py-2 text-right text-blue-600">
                    {round.firm1Quantity.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-red-600">
                    {round.firm2Quantity.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right">{round.totalQuantity.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{round.marketPrice.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-blue-600">
                    {round.firm1Profit.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-red-600">
                    {round.firm2Profit.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {summary.avgFirm1Quantity.toFixed(2)} avg
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {summary.avgFirm2Quantity.toFixed(2)} avg
                </td>
                <td className="px-4 py-3 text-right">-</td>
                <td className="px-4 py-3 text-right">{summary.avgMarketPrice.toFixed(2)} avg</td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {summary.totalFirm1Profit.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {summary.totalFirm2Profit.toFixed(2)}
                </td>
              </tr>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 font-medium">Nash Eq.</td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {nashEquilibrium.firm1Quantity.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {nashEquilibrium.firm2Quantity.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">{nashEquilibrium.totalQuantity.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{nashEquilibrium.marketPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-blue-600">
                  {nashEquilibrium.firm1Profit.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-red-600">
                  {nashEquilibrium.firm2Profit.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
