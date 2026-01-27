import { Router, Request, Response } from 'express';
import { GameResultModel } from '../models/GameResult';
import { ApiResponse, GameStats, GameResultData } from '../types';
import { logger } from '../config/logger';

const router = Router();

// Get all game results with pagination
router.get('/games', async (req: Request, res: Response) => {
  try {
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

// Get game statistics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
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
