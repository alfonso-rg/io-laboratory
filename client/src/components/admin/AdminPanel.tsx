import { useState, useEffect } from 'react';
import { FIRM_COLORS, AVAILABLE_MODELS } from '../../types/game';

// API base URL - use the same URL as socket connection
const API_BASE_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

interface FirmRoundResult {
  firmId: number;
  quantity: number;
  price?: number;
  profit: number;
  reasoning?: string;
  systemPrompt?: string;
  roundPrompt?: string;
}

interface CommunicationMessage {
  firm: number;
  message: string;
}

interface RoundResult {
  roundNumber: number;
  firm1Quantity: number;
  firm2Quantity: number;
  totalQuantity: number;
  marketPrice: number;
  firm1Profit: number;
  firm2Profit: number;
  firm1Reasoning?: string;
  firm2Reasoning?: string;
  firmResults?: FirmRoundResult[];
  marketPrices?: number[];
  communication?: CommunicationMessage[];
  timestamp: string;
}

interface ReplicationResult {
  replicationNumber: number;
  rounds: RoundResult[];
  summary: {
    totalFirm1Profit: number;
    totalFirm2Profit: number;
    avgFirm1Quantity: number;
    avgFirm2Quantity: number;
    avgMarketPrice: number;
  };
  startedAt: string;
  completedAt: string;
}

interface FirmConfig {
  id: number;
  linearCost: number;
  quadraticCost: number;
  model: string;
  info?: {
    revealDemandFunction: boolean;
    revealOwnCosts: boolean;
    revealRivalCosts: boolean;
    revealRivalIsLLM: boolean;
    describeRivalAsHuman: boolean;
  };
}

interface FullGameConfig {
  competitionMode?: 'cournot' | 'bertrand';
  numFirms?: number;
  gamma?: number;
  demandIntercept: number;
  demandSlope: number;
  firm1LinearCost: number;
  firm1QuadraticCost: number;
  firm2LinearCost: number;
  firm2QuadraticCost: number;
  totalRounds: number;
  numReplications: number;
  firm1Model: string;
  firm2Model: string;
  firm1Info?: {
    revealDemandFunction: boolean;
    revealOwnCosts: boolean;
    revealRivalCosts: boolean;
    revealRivalIsLLM: boolean;
    describeRivalAsHuman: boolean;
  };
  firm2Info?: {
    revealDemandFunction: boolean;
    revealOwnCosts: boolean;
    revealRivalCosts: boolean;
    revealRivalIsLLM: boolean;
    describeRivalAsHuman: boolean;
  };
  firms?: FirmConfig[];
  communication: {
    allowCommunication: boolean;
    messagesPerRound: number;
    communicationPrompt?: string;
  };
  customSystemPrompt?: string;
  customRoundPrompt?: string;
}

interface FullGameResult {
  gameId: string;
  config: FullGameConfig;
  rounds: RoundResult[];
  replications: ReplicationResult[];
  nashEquilibrium: {
    firm1Quantity: number;
    firm2Quantity: number;
    totalQuantity: number;
    marketPrice: number;
    firm1Profit: number;
    firm2Profit: number;
  };
  cooperativeEquilibrium?: {
    firm1Quantity: number;
    firm2Quantity: number;
    totalQuantity: number;
    marketPrice: number;
    firm1Profit: number;
    firm2Profit: number;
    totalProfit: number;
  };
  summary: {
    totalFirm1Profit: number;
    totalFirm2Profit: number;
    avgFirm1Quantity: number;
    avgFirm2Quantity: number;
    avgMarketPrice: number;
    nashDeviation: {
      firm1QuantityDeviation: number;
      firm2QuantityDeviation: number;
    };
  };
  startedAt: string;
  completedAt: string;
}

interface GameResult {
  gameId: string;
  config: {
    firm1Model: string;
    firm2Model: string;
    totalRounds: number;
    competitionMode?: 'cournot' | 'bertrand';
    numFirms?: number;
  };
  summary: {
    totalFirm1Profit: number;
    totalFirm2Profit: number;
    avgFirm1Quantity: number;
    avgFirm2Quantity: number;
    nashDeviation: {
      firm1QuantityDeviation: number;
      firm2QuantityDeviation: number;
    };
  };
  completedAt: string;
}

interface GameStats {
  totalGames: number;
  avgRoundsPerGame: number;
  avgNashDeviation: number;
  modelPerformance: {
    model: string;
    avgProfit: number;
    avgQuantityDeviation: number;
    gamesPlayed: number;
  }[];
}

export function AdminPanel() {
  const [games, setGames] = useState<GameResult[]>([]);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedGame, setSelectedGame] = useState<FullGameResult | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchGames();
    fetchStats();
  }, [page]);

  const fetchGameDetails = async (gameId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/games/${gameId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedGame(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch game details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleRoundExpansion = (key: string) => {
    setExpandedRounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const getModelLabel = (modelValue: string): string => {
    const model = AVAILABLE_MODELS.find(m => m.value === modelValue);
    return model ? model.label : modelValue;
  };

  const fetchGames = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/games?page=${page}&limit=10`);
      const data = await response.json();
      if (data.success) {
        setGames(data.data.games);
        setTotalPages(data.data.pagination.pages);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch games');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/stats`);
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const deleteGame = async (gameId: string) => {
    if (!confirm('Are you sure you want to delete this game?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/games/${gameId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        fetchGames();
        fetchStats();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to delete game');
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Games</div>
            <div className="text-2xl font-bold">{stats.totalGames}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Avg Rounds</div>
            <div className="text-2xl font-bold">{stats.avgRoundsPerGame.toFixed(1)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Avg Nash Deviation</div>
            <div className="text-2xl font-bold">{stats.avgNashDeviation.toFixed(2)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Models Tested</div>
            <div className="text-2xl font-bold">{stats.modelPerformance.length}</div>
          </div>
        </div>
      )}

      {/* Model Performance */}
      {stats && stats.modelPerformance.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Model Performance</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left">Model</th>
                  <th className="px-4 py-2 text-right">Avg Profit</th>
                  <th className="px-4 py-2 text-right">Avg Nash Deviation</th>
                  <th className="px-4 py-2 text-right">Games Played</th>
                </tr>
              </thead>
              <tbody>
                {stats.modelPerformance.map((model) => (
                  <tr key={model.model} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{model.model}</td>
                    <td className="px-4 py-2 text-right">{model.avgProfit.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{model.avgQuantityDeviation.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right">{model.gamesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Game History */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Game History</h2>

        {games.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No games recorded yet</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Mode</th>
                    <th className="px-4 py-2 text-left">Firms</th>
                    <th className="px-4 py-2 text-right">Rounds</th>
                    <th className="px-4 py-2 text-right">F1 Profit</th>
                    <th className="px-4 py-2 text-right">F2 Profit</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((game) => (
                    <tr key={game.gameId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2">
                        {new Date(game.completedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 capitalize">
                        {game.config.competitionMode || 'cournot'}
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs">
                          {getModelLabel(game.config.firm1Model)}
                          {(game.config.numFirms || 2) > 2
                            ? ` + ${(game.config.numFirms || 2) - 1} more`
                            : ` vs ${getModelLabel(game.config.firm2Model)}`}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">{game.config.totalRounds}</td>
                      <td className="px-4 py-2 text-right text-blue-600">
                        {game.summary.totalFirm1Profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {game.summary.totalFirm2Profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right space-x-2">
                        <button
                          onClick={() => fetchGameDetails(game.gameId)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          View
                        </button>
                        <button
                          onClick={() => deleteGame(game.gameId)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Game Details Modal */}
      {(selectedGame || loadingDetails) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-semibold">
                {loadingDetails ? 'Loading...' : `Game Details: ${selectedGame?.gameId.slice(0, 8)}...`}
              </h2>
              <button
                onClick={() => setSelectedGame(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-8 text-center">Loading game details...</div>
            ) : selectedGame && (
              <div className="overflow-y-auto flex-1 p-4">
                {/* Game Configuration */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Configuration</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Competition Mode</div>
                      <div className="font-medium capitalize">{selectedGame.config.competitionMode || 'cournot'}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Number of Firms</div>
                      <div className="font-medium">{selectedGame.config.numFirms || 2}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Product Diff. (γ)</div>
                      <div className="font-medium">{selectedGame.config.gamma ?? 1}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Total Rounds</div>
                      <div className="font-medium">{selectedGame.config.totalRounds}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Replications</div>
                      <div className="font-medium">{selectedGame.config.numReplications || 1}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Demand: a</div>
                      <div className="font-medium">{selectedGame.config.demandIntercept}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Demand: b</div>
                      <div className="font-medium">{selectedGame.config.demandSlope}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Communication</div>
                      <div className="font-medium">
                        {selectedGame.config.communication?.allowCommunication
                          ? `Yes (${selectedGame.config.communication.messagesPerRound} msg/round)`
                          : 'No'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Firm Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Firms</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedGame.config.firms && selectedGame.config.firms.length > 0
                      ? selectedGame.config.firms
                      : [
                          { id: 1, linearCost: selectedGame.config.firm1LinearCost, quadraticCost: selectedGame.config.firm1QuadraticCost, model: selectedGame.config.firm1Model, info: selectedGame.config.firm1Info },
                          { id: 2, linearCost: selectedGame.config.firm2LinearCost, quadraticCost: selectedGame.config.firm2QuadraticCost, model: selectedGame.config.firm2Model, info: selectedGame.config.firm2Info },
                        ]
                    ).map((firm, idx) => (
                      <div key={firm.id} className="border rounded-lg p-4" style={{ borderColor: FIRM_COLORS[idx] }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: FIRM_COLORS[idx] }}></div>
                          <span className="font-semibold">Firm {firm.id}</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div><span className="text-gray-600">Model:</span> {getModelLabel(firm.model)}</div>
                          <div><span className="text-gray-600">Linear Cost (c):</span> {firm.linearCost}</div>
                          <div><span className="text-gray-600">Quadratic Cost (d):</span> {firm.quadraticCost}</div>
                          {firm.info && (
                            <div className="mt-2 text-xs text-gray-500">
                              <div>Reveal demand: {firm.info.revealDemandFunction ? '✓' : '✗'}</div>
                              <div>Reveal own costs: {firm.info.revealOwnCosts ? '✓' : '✗'}</div>
                              <div>Reveal rival costs: {firm.info.revealRivalCosts ? '✓' : '✗'}</div>
                              <div>Reveal rival is LLM: {firm.info.revealRivalIsLLM ? '✓' : '✗'}</div>
                              <div>Describe rival as human: {firm.info.describeRivalAsHuman ? '✓' : '✗'}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Equilibrium Values */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Theoretical Equilibria</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <div className="font-semibold mb-2">Nash Equilibrium</div>
                      <div className="text-sm space-y-1">
                        <div>q1*: {selectedGame.nashEquilibrium.firm1Quantity.toFixed(2)}</div>
                        <div>q2*: {selectedGame.nashEquilibrium.firm2Quantity.toFixed(2)}</div>
                        <div>Price: {selectedGame.nashEquilibrium.marketPrice.toFixed(2)}</div>
                        <div>π1: {selectedGame.nashEquilibrium.firm1Profit.toFixed(2)}</div>
                        <div>π2: {selectedGame.nashEquilibrium.firm2Profit.toFixed(2)}</div>
                      </div>
                    </div>
                    {selectedGame.cooperativeEquilibrium && (
                      <div className="border rounded-lg p-4">
                        <div className="font-semibold mb-2">Cooperative (Monopoly)</div>
                        <div className="text-sm space-y-1">
                          <div>q1*: {selectedGame.cooperativeEquilibrium.firm1Quantity.toFixed(2)}</div>
                          <div>q2*: {selectedGame.cooperativeEquilibrium.firm2Quantity.toFixed(2)}</div>
                          <div>Price: {selectedGame.cooperativeEquilibrium.marketPrice.toFixed(2)}</div>
                          <div>Total Profit: {selectedGame.cooperativeEquilibrium.totalProfit.toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Results Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="text-gray-600">Firm 1 Total Profit</div>
                      <div className="font-medium text-blue-600">{selectedGame.summary.totalFirm1Profit.toFixed(2)}</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded">
                      <div className="text-gray-600">Firm 2 Total Profit</div>
                      <div className="font-medium text-red-600">{selectedGame.summary.totalFirm2Profit.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Avg Firm 1 Qty</div>
                      <div className="font-medium">{selectedGame.summary.avgFirm1Quantity.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Avg Firm 2 Qty</div>
                      <div className="font-medium">{selectedGame.summary.avgFirm2Quantity.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded">
                      <div className="text-gray-600">Avg Price</div>
                      <div className="font-medium">{selectedGame.summary.avgMarketPrice.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Round-by-Round Details */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-3">Round-by-Round Details</h3>
                  {(selectedGame.replications.length > 0 ? selectedGame.replications : [{ replicationNumber: 1, rounds: selectedGame.rounds }]).map((replication: { replicationNumber: number; rounds: RoundResult[] }) => (
                    <div key={replication.replicationNumber} className="mb-4">
                      {selectedGame.replications.length > 1 && (
                        <div className="font-medium text-gray-700 mb-2">
                          Replication {replication.replicationNumber}
                        </div>
                      )}
                      <div className="space-y-2">
                        {replication.rounds.map((round) => {
                          const roundKey = `${replication.replicationNumber}-${round.roundNumber}`;
                          const isExpanded = expandedRounds.has(roundKey);
                          const firmResults = round.firmResults || [
                            { firmId: 1, quantity: round.firm1Quantity, profit: round.firm1Profit, reasoning: round.firm1Reasoning },
                            { firmId: 2, quantity: round.firm2Quantity, profit: round.firm2Profit, reasoning: round.firm2Reasoning },
                          ];

                          return (
                            <div key={round.roundNumber} className="border rounded-lg overflow-hidden">
                              {/* Round Header */}
                              <div
                                className="p-3 bg-gray-50 cursor-pointer flex justify-between items-center"
                                onClick={() => toggleRoundExpansion(roundKey)}
                              >
                                <div className="flex items-center gap-4">
                                  <span className="font-medium">Round {round.roundNumber}</span>
                                  <span className="text-sm text-gray-600">
                                    Q: {round.totalQuantity.toFixed(1)} | P: {round.marketPrice.toFixed(2)}
                                  </span>
                                  {round.communication && round.communication.length > 0 && (
                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                      {round.communication.length} messages
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                              </div>

                              {/* Expanded Content */}
                              {isExpanded && (
                                <div className="p-4 space-y-4">
                                  {/* Communication Log */}
                                  {round.communication && round.communication.length > 0 && (
                                    <div>
                                      <div className="font-medium text-sm mb-2">Communication</div>
                                      <div className="bg-purple-50 rounded p-3 space-y-2 text-sm">
                                        {round.communication.map((msg, idx) => (
                                          <div key={idx} className="flex gap-2">
                                            <span
                                              className="font-medium shrink-0"
                                              style={{ color: FIRM_COLORS[msg.firm - 1] }}
                                            >
                                              Firm {msg.firm}:
                                            </span>
                                            <span className="text-gray-700">{msg.message}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Firm Decisions */}
                                  <div>
                                    <div className="font-medium text-sm mb-2">Decisions & Results</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {firmResults.map((firm, idx) => (
                                        <div
                                          key={firm.firmId}
                                          className="border rounded p-3"
                                          style={{ borderColor: FIRM_COLORS[idx] }}
                                        >
                                          <div className="flex items-center gap-2 mb-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: FIRM_COLORS[idx] }}></div>
                                            <span className="font-medium">Firm {firm.firmId}</span>
                                          </div>
                                          <div className="text-sm space-y-1">
                                            <div>
                                              <span className="text-gray-600">
                                                {selectedGame.config.competitionMode === 'bertrand' ? 'Price' : 'Quantity'}:
                                              </span>{' '}
                                              {firm.quantity.toFixed(2)}
                                            </div>
                                            <div><span className="text-gray-600">Profit:</span> {firm.profit.toFixed(2)}</div>
                                          </div>
                                          {firm.reasoning && (
                                            <div className="mt-2">
                                              <div className="text-xs text-gray-500 mb-1">Reasoning:</div>
                                              <div className="text-xs bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                                                {firm.reasoning}
                                              </div>
                                            </div>
                                          )}
                                          {(firm.systemPrompt || firm.roundPrompt) && (
                                            <details className="mt-2">
                                              <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                                View Prompts
                                              </summary>
                                              <div className="mt-2 space-y-2">
                                                {firm.systemPrompt && (
                                                  <div>
                                                    <div className="text-xs text-gray-500 mb-1">System Prompt:</div>
                                                    <pre className="text-xs bg-gray-100 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                                                      {firm.systemPrompt}
                                                    </pre>
                                                  </div>
                                                )}
                                                {firm.roundPrompt && (
                                                  <div>
                                                    <div className="text-xs text-gray-500 mb-1">Round Prompt:</div>
                                                    <pre className="text-xs bg-gray-100 p-2 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                                                      {firm.roundPrompt}
                                                    </pre>
                                                  </div>
                                                )}
                                              </div>
                                            </details>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Custom Prompts */}
                {(selectedGame.config.customSystemPrompt || selectedGame.config.customRoundPrompt) && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Custom Prompts Used</h3>
                    <div className="space-y-4">
                      {selectedGame.config.customSystemPrompt && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Custom System Prompt:</div>
                          <pre className="text-sm bg-gray-50 p-3 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                            {selectedGame.config.customSystemPrompt}
                          </pre>
                        </div>
                      )}
                      {selectedGame.config.customRoundPrompt && (
                        <div>
                          <div className="text-sm text-gray-600 mb-1">Custom Round Prompt:</div>
                          <pre className="text-sm bg-gray-50 p-3 rounded max-h-40 overflow-auto whitespace-pre-wrap">
                            {selectedGame.config.customRoundPrompt}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="text-sm text-gray-500">
                  <div>Started: {new Date(selectedGame.startedAt).toLocaleString()}</div>
                  <div>Completed: {new Date(selectedGame.completedAt).toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
