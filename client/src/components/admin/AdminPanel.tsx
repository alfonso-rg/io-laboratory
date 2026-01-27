import { useState, useEffect } from 'react';

interface GameResult {
  gameId: string;
  config: {
    firm1Model: string;
    firm2Model: string;
    totalRounds: number;
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

  useEffect(() => {
    fetchGames();
    fetchStats();
  }, [page]);

  const fetchGames = async () => {
    try {
      const response = await fetch(`/api/admin/games?page=${page}&limit=10`);
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
      const response = await fetch('/api/admin/stats');
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
      const response = await fetch(`/api/admin/games/${gameId}`, {
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
                    <th className="px-4 py-2 text-left">Firm 1</th>
                    <th className="px-4 py-2 text-left">Firm 2</th>
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
                      <td className="px-4 py-2">{game.config.firm1Model}</td>
                      <td className="px-4 py-2">{game.config.firm2Model}</td>
                      <td className="px-4 py-2 text-right">{game.config.totalRounds}</td>
                      <td className="px-4 py-2 text-right text-blue-600">
                        {game.summary.totalFirm1Profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600">
                        {game.summary.totalFirm2Profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">
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
    </div>
  );
}
