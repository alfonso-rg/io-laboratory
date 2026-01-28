import { useGameStore } from '../../stores/gameStore';
import { useSocket } from '../../hooks/useSocket';
import { QuantityChart } from './QuantityChart';
import {
  FIRM_COLORS,
  FIRM_COLOR_CLASSES,
  getNumFirms,
  getCompetitionMode,
  getFirmConfig,
} from '../../types/game';

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

  const { config, rounds, nashEquilibrium, nPolyEquilibrium, currentRound, currentReplication, replications, status } = gameState;
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isCompleted = status === 'completed';
  const numReplications = config.numReplications || 1;
  const hasCommunication = config.communication?.allowCommunication;
  const numFirms = getNumFirms(config);
  const competitionMode = getCompetitionMode(config);

  // Calculate cumulative profits for all firms
  const cumulativeProfits: Record<number, number> = {};
  for (let i = 1; i <= numFirms; i++) {
    cumulativeProfits[i] = rounds.reduce((acc, round) => {
      if (round.firmResults) {
        const firmResult = round.firmResults.find(f => f.firmId === i);
        return acc + (firmResult?.profit ?? 0);
      }
      // Fallback to legacy fields
      return acc + (i === 1 ? round.firm1Profit : i === 2 ? round.firm2Profit : 0);
    }, 0);
  }

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

      {/* Firm Status Cards - Dynamic for N firms */}
      <div className={`grid gap-4 mb-6 ${numFirms <= 2 ? 'grid-cols-2' : numFirms <= 4 ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-5'}`}>
        {Array.from({ length: numFirms }, (_, i) => {
          const firmId = i + 1;
          const firmConfig = getFirmConfig(config, firmId);
          const colorClass = FIRM_COLOR_CLASSES[i] || FIRM_COLOR_CLASSES[0];
          const isThinking = firmThinking[`firm${firmId}`];
          const decision = latestDecisions[`firm${firmId}`];
          const nashQty = nPolyEquilibrium?.firms.find(f => f.firmId === firmId)?.quantity
            ?? (firmId === 1 ? nashEquilibrium.firm1Quantity : firmId === 2 ? nashEquilibrium.firm2Quantity : 0);

          return (
            <div key={firmId} className={`bg-white p-4 rounded-lg shadow border-l-4 ${colorClass.border}`}>
              <div className="flex items-center justify-between mb-3">
                <h2 className={`text-lg font-semibold ${colorClass.text}`}>Firm {firmId}</h2>
                <span className="text-xs text-gray-500">{firmConfig.model}</span>
              </div>

              {isThinking ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: FIRM_COLORS[i] }}></div>
                  <span className="text-sm">Thinking...</span>
                </div>
              ) : decision ? (
                <div>
                  <div className={`text-2xl font-bold ${colorClass.text}`}>
                    {competitionMode === 'bertrand' && decision.price !== undefined
                      ? `p = ${decision.price.toFixed(2)}`
                      : `q = ${decision.quantity.toFixed(2)}`}
                  </div>
                  {decision.reasoning && (
                    <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                      {decision.reasoning}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-gray-400 text-sm">Waiting...</div>
              )}

              <div className="mt-3 pt-3 border-t text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nash {competitionMode === 'bertrand' ? 'Price' : 'Qty'}:</span>
                  <span className="font-medium">{nashQty.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cum. Profit:</span>
                  <span className="font-medium">{(cumulativeProfits[firmId] ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
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
          <h2 className="text-xl font-semibold mb-4">
            {competitionMode === 'bertrand' ? 'Price' : 'Quantity'} History
          </h2>
          <QuantityChart
            rounds={rounds}
            nashEquilibrium={nashEquilibrium}
            nPolyEquilibrium={nPolyEquilibrium}
            numFirms={numFirms}
            competitionMode={competitionMode}
          />
        </div>
      )}

      {/* Results Table - Dynamic for N firms */}
      {rounds.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Round Results</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">Round</th>
                  {Array.from({ length: numFirms }, (_, i) => (
                    <th key={`q${i + 1}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                      {competitionMode === 'bertrand' ? `p${i + 1}` : `q${i + 1}`}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Avg Price</th>
                  {Array.from({ length: numFirms }, (_, i) => (
                    <th key={`profit${i + 1}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                      π{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rounds.map((round) => (
                  <tr key={round.roundNumber} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">{round.roundNumber}</td>
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
                {/* Nash reference row */}
                <tr className="bg-gray-100 font-medium">
                  <td className="px-3 py-2">Nash</td>
                  {Array.from({ length: numFirms }, (_, i) => {
                    const firmId = i + 1;
                    const nashFirm = nPolyEquilibrium?.firms.find(f => f.firmId === firmId);
                    const value = competitionMode === 'bertrand'
                      ? (nashFirm?.price ?? nPolyEquilibrium?.avgMarketPrice ?? nashEquilibrium.marketPrice)
                      : (nashFirm?.quantity ?? (firmId === 1 ? nashEquilibrium.firm1Quantity : firmId === 2 ? nashEquilibrium.firm2Quantity : 0));
                    return (
                      <td key={`nash-q${firmId}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                        {value.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">{nPolyEquilibrium?.avgMarketPrice?.toFixed(2) ?? nashEquilibrium.marketPrice.toFixed(2)}</td>
                  {Array.from({ length: numFirms }, (_, i) => {
                    const firmId = i + 1;
                    const nashFirm = nPolyEquilibrium?.firms.find(f => f.firmId === firmId);
                    const profit = nashFirm?.profit ?? (firmId === 1 ? nashEquilibrium.firm1Profit : firmId === 2 ? nashEquilibrium.firm2Profit : 0);
                    return (
                      <td key={`nash-profit${firmId}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                        {profit.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Completed Replications Summary - Dynamic for N firms */}
      {replications && replications.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mt-6">
          <h2 className="text-xl font-semibold mb-4">Completed Replications</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">Rep #</th>
                  {Array.from({ length: numFirms }, (_, i) => (
                    <th key={`avg-q${i + 1}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                      Avg {competitionMode === 'bertrand' ? 'p' : 'q'}{i + 1}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Avg Price</th>
                  {Array.from({ length: numFirms }, (_, i) => (
                    <th key={`profit${i + 1}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                      π{i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {replications.map((rep) => {
                  // Calculate per-firm averages from rounds data
                  const firmAvgs: Record<number, { avgQty: number; totalProfit: number }> = {};
                  for (let i = 1; i <= numFirms; i++) {
                    const rounds = rep.rounds || [];
                    const n = rounds.length || 1;
                    const totalQty = rounds.reduce((sum, r) => {
                      if (r.firmResults) {
                        const fr = r.firmResults.find((f: { firmId: number }) => f.firmId === i);
                        return sum + (fr?.quantity ?? 0);
                      }
                      return sum + (i === 1 ? r.firm1Quantity : i === 2 ? r.firm2Quantity : 0);
                    }, 0);
                    const totalProfit = rounds.reduce((sum, r) => {
                      if (r.firmResults) {
                        const fr = r.firmResults.find((f: { firmId: number }) => f.firmId === i);
                        return sum + (fr?.profit ?? 0);
                      }
                      return sum + (i === 1 ? r.firm1Profit : i === 2 ? r.firm2Profit : 0);
                    }, 0);
                    firmAvgs[i] = { avgQty: totalQty / n, totalProfit };
                  }

                  return (
                    <tr key={rep.replicationNumber} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2">{rep.replicationNumber}</td>
                      {Array.from({ length: numFirms }, (_, i) => (
                        <td key={`avg-q${i + 1}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                          {firmAvgs[i + 1].avgQty.toFixed(2)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">{rep.summary.avgMarketPrice.toFixed(2)}</td>
                      {Array.from({ length: numFirms }, (_, i) => (
                        <td key={`profit${i + 1}`} className="px-3 py-2 text-right" style={{ color: FIRM_COLORS[i] }}>
                          {firmAvgs[i + 1].totalProfit.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
