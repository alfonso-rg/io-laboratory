import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { GameResultModel } from '../models/GameResult';
import { ApiResponse, GameStats, GameResultData, RoundResult, ReplicationResult } from '../types';
import { logger } from '../config/logger';

const router = Router();

// Helper function to escape CSV fields
function escapeCSV(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  // If contains comma, newline, or quote, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Check if MongoDB is connected
function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

// Get all game results with pagination
router.get('/games', async (req: Request, res: Response) => {
  try {
    // Check MongoDB connection
    if (!isMongoConnected()) {
      res.json({
        success: true,
        data: {
          games: [],
          pagination: { page: 1, limit: 10, total: 0, pages: 0 },
        },
        warning: 'Database not connected - no historical data available',
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const [games, total] = await Promise.all([
      GameResultModel.find()
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GameResultModel.countDocuments(),
    ]);

    const response: ApiResponse<{
      games: GameResultData[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }> = {
      success: true,
      data: {
        games: games as GameResultData[],
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching games:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch games',
    });
  }
});

// Get a specific game by ID
router.get('/games/:gameId', async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      res.status(503).json({
        success: false,
        error: 'Database not connected',
      });
      return;
    }

    const game = await GameResultModel.findOne({ gameId: req.params.gameId }).lean();

    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    const response: ApiResponse<GameResultData> = {
      success: true,
      data: game as GameResultData,
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch game',
    });
  }
});

// Delete a game
router.delete('/games/:gameId', async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      res.status(503).json({
        success: false,
        error: 'Database not connected',
      });
      return;
    }

    const result = await GameResultModel.deleteOne({ gameId: req.params.gameId });

    if (result.deletedCount === 0) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    logger.error('Error deleting game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete game',
    });
  }
});

// Export game data as CSV
router.get('/games/:gameId/export', async (req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      res.status(503).json({
        success: false,
        error: 'Database not connected',
      });
      return;
    }

    const game = await GameResultModel.findOne({ gameId: req.params.gameId }).lean();

    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    const format = (req.query.format as string) || 'rounds';
    const includeReasoning = req.query.reasoning === 'true';
    const includeChat = req.query.chat === 'true';

    let csv = '';
    const numFirms = game.config.numFirms || 2;
    const isBertrand = game.config.competitionMode === 'bertrand';

    if (format === 'rounds' || format === 'full') {
      // Build header
      const headers = ['Replication', 'Round', 'Timestamp'];

      // Add firm columns
      for (let i = 1; i <= numFirms; i++) {
        headers.push(`Firm${i}_${isBertrand ? 'Price' : 'Quantity'}`);
        headers.push(`Firm${i}_Profit`);
        if (includeReasoning) {
          headers.push(`Firm${i}_Reasoning`);
        }
      }

      headers.push('TotalQuantity', 'MarketPrice');

      // Add realized parameters columns if applicable
      if (game.config.parameterVariation && game.config.parameterVariation !== 'fixed') {
        headers.push('Realized_Gamma');
        if (game.config.demandFunction?.type === 'linear') {
          headers.push('Realized_Intercept', 'Realized_Slope');
        } else if (game.config.demandFunction?.type === 'isoelastic') {
          headers.push('Realized_Scale', 'Realized_Elasticity');
        } else if (game.config.demandFunction?.type === 'ces') {
          headers.push('Realized_Scale', 'Realized_SubstitutionElasticity');
        } else if (game.config.demandFunction?.type === 'logit') {
          headers.push('Realized_Intercept', 'Realized_PriceCoefficient');
        } else if (game.config.demandFunction?.type === 'exponential') {
          headers.push('Realized_Scale', 'Realized_DecayRate');
        }
        for (let i = 1; i <= numFirms; i++) {
          headers.push(`Realized_Firm${i}_LinearCost`, `Realized_Firm${i}_QuadraticCost`);
        }
      }

      // Add communication column if requested
      if (includeChat) {
        headers.push('Communication');
      }

      csv = headers.map(h => escapeCSV(h)).join(',') + '\n';

      // Add data rows
      const replications = game.replications.length > 0
        ? game.replications
        : [{ replicationNumber: 1, rounds: game.rounds }];

      for (const rep of replications) {
        for (const round of (rep as ReplicationResult).rounds) {
          const row: (string | number)[] = [
            (rep as ReplicationResult).replicationNumber,
            round.roundNumber,
            round.timestamp ? new Date(round.timestamp).toISOString() : '',
          ];

          // Get firm results
          const firmResults = round.firmResults || [
            { firmId: 1, quantity: round.firm1Quantity, profit: round.firm1Profit, reasoning: round.firm1Reasoning },
            { firmId: 2, quantity: round.firm2Quantity, profit: round.firm2Profit, reasoning: round.firm2Reasoning },
          ];

          for (let i = 1; i <= numFirms; i++) {
            const firm = firmResults.find(f => f.firmId === i);
            row.push(firm?.quantity ?? 0);
            row.push(firm?.profit ?? 0);
            if (includeReasoning) {
              row.push(firm?.reasoning || '');
            }
          }

          row.push(round.totalQuantity);
          row.push(round.marketPrice);

          // Add realized parameters if applicable
          if (game.config.parameterVariation && game.config.parameterVariation !== 'fixed') {
            const rp = round.realizedParameters;
            row.push(rp?.gamma ?? '');

            if (game.config.demandFunction?.type === 'linear') {
              row.push(rp?.demand?.intercept ?? '');
              row.push(rp?.demand?.slope ?? '');
            } else if (game.config.demandFunction?.type === 'isoelastic') {
              row.push(rp?.demand?.scale ?? '');
              row.push(rp?.demand?.elasticity ?? '');
            } else if (game.config.demandFunction?.type === 'ces') {
              row.push(rp?.demand?.scale ?? '');
              row.push(rp?.demand?.substitutionElasticity ?? '');
            } else if (game.config.demandFunction?.type === 'logit') {
              row.push(rp?.demand?.intercept ?? '');
              row.push(rp?.demand?.priceCoefficient ?? '');
            } else if (game.config.demandFunction?.type === 'exponential') {
              row.push(rp?.demand?.scale ?? '');
              row.push(rp?.demand?.decayRate ?? '');
            }

            for (let i = 1; i <= numFirms; i++) {
              const fc = rp?.firmCosts?.find(c => c.firmId === i);
              row.push(fc?.linearCost ?? '');
              row.push(fc?.quadraticCost ?? '');
            }
          }

          // Add communication if requested
          if (includeChat) {
            const chatText = round.communication?.map(m => `F${m.firm}: ${m.message}`).join(' | ') || '';
            row.push(chatText);
          }

          csv += row.map(v => escapeCSV(v)).join(',') + '\n';
        }
      }
    } else if (format === 'summary') {
      // Summary format - aggregate by replication
      const headers = [
        'Replication',
        'TotalRounds',
        'AvgFirm1Quantity',
        'AvgFirm2Quantity',
        'TotalFirm1Profit',
        'TotalFirm2Profit',
        'AvgMarketPrice',
        'StartedAt',
        'CompletedAt',
      ];

      csv = headers.map(h => escapeCSV(h)).join(',') + '\n';

      const replications = game.replications.length > 0
        ? game.replications
        : [{
            replicationNumber: 1,
            rounds: game.rounds,
            summary: game.summary,
            startedAt: game.startedAt,
            completedAt: game.completedAt,
          }];

      for (const rep of replications) {
        const repData = rep as ReplicationResult & { summary?: typeof game.summary; startedAt?: Date; completedAt?: Date };
        const summary = repData.summary || game.summary;
        const row = [
          repData.replicationNumber,
          repData.rounds.length,
          summary.avgFirm1Quantity,
          summary.avgFirm2Quantity,
          summary.totalFirm1Profit,
          summary.totalFirm2Profit,
          summary.avgMarketPrice,
          repData.startedAt ? new Date(repData.startedAt).toISOString() : '',
          repData.completedAt ? new Date(repData.completedAt).toISOString() : '',
        ];

        csv += row.map(v => escapeCSV(v)).join(',') + '\n';
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Use: rounds, summary, or full',
      });
      return;
    }

    // Set headers for CSV download
    const filename = `game_${game.gameId.slice(0, 8)}_${format}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export game',
    });
  }
});

// Get game statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    if (!isMongoConnected()) {
      res.json({
        success: true,
        data: {
          totalGames: 0,
          avgRoundsPerGame: 0,
          avgNashDeviation: 0,
          modelPerformance: [],
        },
        warning: 'Database not connected - no statistics available',
      });
      return;
    }

    const totalGames = await GameResultModel.countDocuments();

    if (totalGames === 0) {
      const response: ApiResponse<GameStats> = {
        success: true,
        data: {
          totalGames: 0,
          avgRoundsPerGame: 0,
          avgNashDeviation: 0,
          modelPerformance: [],
        },
      };
      res.json(response);
      return;
    }

    // Aggregate statistics
    const stats = await GameResultModel.aggregate([
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          avgRounds: { $avg: { $size: '$rounds' } },
          avgNashDevFirm1: { $avg: '$summary.nashDeviation.firm1QuantityDeviation' },
          avgNashDevFirm2: { $avg: '$summary.nashDeviation.firm2QuantityDeviation' },
        },
      },
    ]);

    // Model performance aggregation
    const modelStats = await GameResultModel.aggregate([
      {
        $facet: {
          firm1Stats: [
            {
              $group: {
                _id: '$config.firm1Model',
                avgProfit: { $avg: '$summary.totalFirm1Profit' },
                avgQuantityDeviation: { $avg: '$summary.nashDeviation.firm1QuantityDeviation' },
                gamesPlayed: { $sum: 1 },
              },
            },
          ],
          firm2Stats: [
            {
              $group: {
                _id: '$config.firm2Model',
                avgProfit: { $avg: '$summary.totalFirm2Profit' },
                avgQuantityDeviation: { $avg: '$summary.nashDeviation.firm2QuantityDeviation' },
                gamesPlayed: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // Merge model stats
    const modelPerformanceMap = new Map<string, {
      model: string;
      avgProfit: number;
      avgQuantityDeviation: number;
      gamesPlayed: number;
    }>();

    for (const stat of modelStats[0].firm1Stats) {
      modelPerformanceMap.set(stat._id, {
        model: stat._id,
        avgProfit: stat.avgProfit,
        avgQuantityDeviation: stat.avgQuantityDeviation,
        gamesPlayed: stat.gamesPlayed,
      });
    }

    for (const stat of modelStats[0].firm2Stats) {
      const existing = modelPerformanceMap.get(stat._id);
      if (existing) {
        existing.avgProfit = (existing.avgProfit + stat.avgProfit) / 2;
        existing.avgQuantityDeviation = (existing.avgQuantityDeviation + stat.avgQuantityDeviation) / 2;
        existing.gamesPlayed += stat.gamesPlayed;
      } else {
        modelPerformanceMap.set(stat._id, {
          model: stat._id,
          avgProfit: stat.avgProfit,
          avgQuantityDeviation: stat.avgQuantityDeviation,
          gamesPlayed: stat.gamesPlayed,
        });
      }
    }

    const avgNashDev = stats[0]
      ? (stats[0].avgNashDevFirm1 + stats[0].avgNashDevFirm2) / 2
      : 0;

    const response: ApiResponse<GameStats> = {
      success: true,
      data: {
        totalGames,
        avgRoundsPerGame: stats[0]?.avgRounds || 0,
        avgNashDeviation: avgNashDev,
        modelPerformance: Array.from(modelPerformanceMap.values()),
      },
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics',
    });
  }
});

export default router;
