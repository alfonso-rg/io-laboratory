import mongoose, { Schema, Document } from 'mongoose';
import { GameResultData } from '../types';

export interface GameResultDocument extends GameResultData, Document {}

const RoundResultSchema = new Schema({
  roundNumber: { type: Number, required: true },
  firm1Quantity: { type: Number, required: true },
  firm2Quantity: { type: Number, required: true },
  totalQuantity: { type: Number, required: true },
  marketPrice: { type: Number, required: true },
  firm1Profit: { type: Number, required: true },
  firm2Profit: { type: Number, required: true },
  firm1Reasoning: { type: String },
  firm2Reasoning: { type: String },
  timestamp: { type: Date, required: true },
});

const CournotConfigSchema = new Schema({
  demandIntercept: { type: Number, required: true },
  demandSlope: { type: Number, required: true },
  firm1LinearCost: { type: Number, required: true },
  firm1QuadraticCost: { type: Number, required: true },
  firm2LinearCost: { type: Number, required: true },
  firm2QuadraticCost: { type: Number, required: true },
  totalRounds: { type: Number, required: true },
  firm1Model: { type: String, required: true },
  firm2Model: { type: String, required: true },
  minQuantity: { type: Number },
  maxQuantity: { type: Number },
});

const NashEquilibriumSchema = new Schema({
  firm1Quantity: { type: Number, required: true },
  firm2Quantity: { type: Number, required: true },
  totalQuantity: { type: Number, required: true },
  marketPrice: { type: Number, required: true },
  firm1Profit: { type: Number, required: true },
  firm2Profit: { type: Number, required: true },
});

const GameSummarySchema = new Schema({
  totalFirm1Profit: { type: Number, required: true },
  totalFirm2Profit: { type: Number, required: true },
  avgFirm1Quantity: { type: Number, required: true },
  avgFirm2Quantity: { type: Number, required: true },
  avgMarketPrice: { type: Number, required: true },
  nashDeviation: {
    firm1QuantityDeviation: { type: Number, required: true },
    firm2QuantityDeviation: { type: Number, required: true },
  },
});

const GameResultSchema = new Schema({
  gameId: { type: String, required: true, unique: true, index: true },
  config: { type: CournotConfigSchema, required: true },
  rounds: { type: [RoundResultSchema], required: true },
  nashEquilibrium: { type: NashEquilibriumSchema, required: true },
  summary: { type: GameSummarySchema, required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, required: true },
}, {
  timestamps: true,
});

// Indexes for querying
GameResultSchema.index({ 'config.firm1Model': 1 });
GameResultSchema.index({ 'config.firm2Model': 1 });
GameResultSchema.index({ completedAt: -1 });

export const GameResultModel = mongoose.model<GameResultDocument>('GameResult', GameResultSchema);
