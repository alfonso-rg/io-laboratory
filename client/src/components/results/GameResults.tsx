import { useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useSocket } from '../../hooks/useSocket';
import { QuantityChart } from '../game/QuantityChart';
import {
  FIRM_COLORS,
  getNumFirms,
  getCompetitionMode,
  getFirmConfig,
} from '../../types/game';

interface FirmSummary {
  firmId: number;
  totalProfit: number;
  avgQuantity: number;
  nashQuantity: number;
  quantityDeviation: number;
  model: string;
}

export function GameResults() {
  const { gameState } = useGameStore();
  const { resetGame } = useSocket();

  const summary = useMemo(() => {
    if (!gameState || gameState.rounds.length === 0) return null;

    const { config, rounds, nashEquilibrium, nPolyEquilibrium } = gameState;
    const numFirms = getNumFirms(config);
    const n = rounds.length;

    // Calculate per-firm statistics
    const firmSummaries: FirmSummary[] = [];
    let totalProfit = 0;
    let nashTotalProfit = 0;

    for (let i = 1; i <= numFirms; i++) {
      const firmConfig = getFirmConfig(config, i);

      // Get firm's data from rounds
      const firmTotalProfit = rounds.reduce((sum, round) => {
        if (round.firmResults) {
          const firmResult = round.firmResults.find(f => f.firmId === i);
          return sum + (firmResult?.profit ?? 0);
        }
        // Fallback to legacy fields
        return sum + (i === 1 ? round.firm1Profit : i === 2 ? round.firm2Profit : 0);
      }, 0);

      const firmAvgQuantity = rounds.reduce((sum, round) => {
        if (round.firmResults) {
          const firmResult = round.firmResults.find(f => f.firmId === i);
          return sum + (firmResult?.quantity ?? 0);
        }
        return sum + (i === 1 ? round.firm1Quantity : i === 2 ? round.firm2Quantity : 0);
      }, 0) / n;

      // Get Nash equilibrium quantity for this firm
      const nashQty = nPolyEquilibrium?.firms.find(f => f.firmId === i)?.quantity
        ?? (i === 1 ? nashEquilibrium.firm1Quantity : i === 2 ? nashEquilibrium.firm2Quantity : 0);

      const nashProfit = nPolyEquilibrium?.firms.find(f => f.firmId === i)?.profit
        ?? (i === 1 ? nashEquilibrium.firm1Profit : i === 2 ? nashEquilibrium.firm2Profit : 0);

      firmSummaries.push({
        firmId: i,
        totalProfit: firmTotalProfit,
        avgQuantity: firmAvgQuantity,
        nashQuantity: nashQty,
        quantityDeviation: Math.abs(firmAvgQuantity - nashQty),
        model: firmConfig.model,
      });

      totalProfit += firmTotalProfit;
      nashTotalProfit += nashProfit;
    }

    const avgMarketPrice = rounds.reduce((sum, r) => sum + r.marketPrice, 0) / n;
    const actualAvgProfit = totalProfit / n;

    // Find winner(s)
    const maxProfit = Math.max(...firmSummaries.map(f => f.totalProfit));
    const winners = firmSummaries.filter(f => f.totalProfit === maxProfit);

    return {
      firmSummaries,
      avgMarketPrice,
      nashTotalProfit,
      actualAvgProfit,
      totalProfit,
      winners,
      numFirms,
    };
  }, [gameState]);

  if (!gameState || gameState.status !== 'completed' || !summary) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-500">No completed game to display</div>
      </div>
    );
  }

  const { config, rounds, nashEquilibrium, nPolyEquilibrium } = gameState;
  const numFirms = summary.numFirms;
  const competitionMode = getCompetitionMode(config);

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
            {summary.winners.length > 1
              ? `Tie: ${summary.winners.map(w => `Firm ${w.firmId}`).join(' & ')}!`
              : `Firm ${summary.winners[0].firmId} Wins!`}
          </h2>
          <p className="text-lg">
            After {rounds.length} rounds of competition
            {summary.winners.length === 1 && (
              <span> with ${summary.winners[0].totalProfit.toFixed(2)} total profit</span>
            )}
          </p>
        </div>
      </div>

      {/* Firm Summary Cards - Dynamic for N firms */}
      <div className={`grid gap-4 mb-6 ${
        numFirms <= 2 ? 'grid-cols-1 md:grid-cols-2' :
        numFirms <= 3 ? 'grid-cols-1 md:grid-cols-3' :
        numFirms <= 4 ? 'grid-cols-2 md:grid-cols-4' :
        'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'
      }`}>
        {summary.firmSummaries.map((firm, idx) => (
          <div
            key={firm.firmId}
            className="p-4 rounded-lg shadow"
            style={{ backgroundColor: `${FIRM_COLORS[idx]}15`, borderLeft: `4px solid ${FIRM_COLORS[idx]}` }}
          >
            <h2 className="text-lg font-semibold mb-3" style={{ color: FIRM_COLORS[idx] }}>
              Firm {firm.firmId}
            </h2>
            <div className="text-xs text-gray-500 mb-2">{firm.model}</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Profit:</span>
                <span className="font-bold" style={{ color: FIRM_COLORS[idx] }}>
                  {firm.totalProfit.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Avg {competitionMode === 'bertrand' ? 'Price' : 'Qty'}:</span>
                <span className="font-medium">{firm.avgQuantity.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Nash {competitionMode === 'bertrand' ? 'Price' : 'Qty'}:</span>
                <span className="font-medium">{firm.nashQuantity.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Deviation:</span>
                <span className={`font-medium ${firm.quantityDeviation < 2 ? 'text-green-600' : 'text-orange-600'}`}>
                  {firm.quantityDeviation.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Market Summary */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Market Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">Avg Market Price</div>
            <div className="text-xl font-bold">{summary.avgMarketPrice.toFixed(2)}</div>
            <div className="text-sm text-gray-500">
              Nash: {(nPolyEquilibrium?.avgMarketPrice ?? nashEquilibrium.marketPrice).toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Nash Profit (per round)</div>
            <div className="text-xl font-bold">{summary.nashTotalProfit.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Actual Avg Profit</div>
            <div className="text-xl font-bold">{summary.actualAvgProfit.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Efficiency</div>
            <div
              className={`text-xl font-bold ${
                summary.actualAvgProfit >= summary.nashTotalProfit
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {((summary.actualAvgProfit / summary.nashTotalProfit) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Quantity Chart */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">
          {competitionMode === 'bertrand' ? 'Price' : 'Quantity'} Evolution
        </h2>
        <QuantityChart
          rounds={rounds}
          nashEquilibrium={nashEquilibrium}
          nPolyEquilibrium={nPolyEquilibrium}
          numFirms={numFirms}
          competitionMode={competitionMode}
        />
      </div>

      {/* Full Results Table - Dynamic for N firms */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Detailed Round History</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-3 py-3 text-left">Round</th>
                {Array.from({ length: numFirms }, (_, i) => (
                  <th key={`q${i + 1}`} className="px-3 py-3 text-right" style={{ color: FIRM_COLORS[i] }}>
                    {competitionMode === 'bertrand' ? `p${i + 1}` : `q${i + 1}`}
                  </th>
                ))}
                <th className="px-3 py-3 text-right">Price</th>
                {Array.from({ length: numFirms }, (_, i) => (
                  <th key={`profit${i + 1}`} className="px-3 py-3 text-right" style={{ color: FIRM_COLORS[i] }}>
                    π{i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map((round) => (
                <tr key={round.roundNumber} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{round.roundNumber}</td>
                  {Array.from({ length: numFirms }, (_, i) => {
                    const firmId = i + 1;
                    const firmResult = round.firmResults?.find(f => f.firmId === firmId);
                    const value = competitionMode === 'bertrand'
                      ? (firmResult?.price ?? round.marketPrices?.[i] ?? round.marketPrice)
                      : (firmResult?.quantity ?? (firmId === 1 ? round.firm1Quantity : firmId === 2 ? round.firm2Quantity : 0));
                    return (
                      <td key={`q${firmId}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                        {value.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">{round.marketPrice.toFixed(2)}</td>
                  {Array.from({ length: numFirms }, (_, i) => {
                    const firmId = i + 1;
                    const firmResult = round.firmResults?.find(f => f.firmId === firmId);
                    const profit = firmResult?.profit ?? (firmId === 1 ? round.firm1Profit : firmId === 2 ? round.firm2Profit : 0);
                    return (
                      <td key={`profit${firmId}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                        {profit.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="px-3 py-3">Avg</td>
                {summary.firmSummaries.map((firm, idx) => (
                  <td key={`avg-q${firm.firmId}`} className="px-3 py-3 text-right" style={{ color: FIRM_COLORS[idx] }}>
                    {firm.avgQuantity.toFixed(2)}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">{summary.avgMarketPrice.toFixed(2)}</td>
                {summary.firmSummaries.map((firm, idx) => (
                  <td key={`total-profit${firm.firmId}`} className="px-3 py-3 text-right" style={{ color: FIRM_COLORS[idx] }}>
                    {firm.totalProfit.toFixed(2)}
                  </td>
                ))}
              </tr>
              <tr className="bg-blue-50">
                <td className="px-3 py-3 font-medium">Nash</td>
                {summary.firmSummaries.map((firm, idx) => (
                  <td key={`nash-q${firm.firmId}`} className="px-3 py-3 text-right" style={{ color: FIRM_COLORS[idx] }}>
                    {firm.nashQuantity.toFixed(2)}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">
                  {(nPolyEquilibrium?.avgMarketPrice ?? nashEquilibrium.marketPrice).toFixed(2)}
                </td>
                {summary.firmSummaries.map((firm, idx) => {
                  const nashProfit = nPolyEquilibrium?.firms.find(f => f.firmId === firm.firmId)?.profit
                    ?? (firm.firmId === 1 ? nashEquilibrium.firm1Profit : firm.firmId === 2 ? nashEquilibrium.firm2Profit : 0);
                  return (
                    <td key={`nash-profit${firm.firmId}`} className="px-3 py-3 text-right" style={{ color: FIRM_COLORS[idx] }}>
                      {nashProfit.toFixed(2)}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
