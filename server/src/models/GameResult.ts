import mongoose, { Schema, Document } from 'mongoose';
import { GameResultData } from '../types';

export interface GameResultDocument extends GameResultData, Document {}

// Communication message schema
const CommunicationMessageSchema = new Schema({
  firm: { type: Number, enum: [1, 2], required: true },
  message: { type: String, required: true },
});

// Round result schema with communication
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
  communication: { type: [CommunicationMessageSchema], default: [] },
  timestamp: { type: Date, required: true },
});

// Replication summary schema
const ReplicationSummarySchema = new Schema({
  totalFirm1Profit: { type: Number, required: true },
  totalFirm2Profit: { type: Number, required: true },
  avgFirm1Quantity: { type: Number, required: true },
  avgFirm2Quantity: { type: Number, required: true },
  avgMarketPrice: { type: Number, required: true },
});

// Replication result schema
const ReplicationResultSchema = new Schema({
  replicationNumber: { type: Number, required: true },
  rounds: { type: [RoundResultSchema], required: true },
  summary: { type: ReplicationSummarySchema, required: true },
  startedAt: { type: Date, required: true },
  completedAt: { type: Date, required: true },
});

// Information disclosure schema
const InformationDisclosureSchema = new Schema({
  revealDemandFunction: { type: Boolean, default: true },
  revealOwnCosts: { type: Boolean, default: true },
  revealRivalCosts: { type: Boolean, default: false },
  revealRivalIsLLM: { type: Boolean, default: true },
  describeRivalAsHuman: { type: Boolean, default: false },
});

// Communication settings schema
const CommunicationSettingsSchema = new Schema({
  allowCommunication: { type: Boolean, default: false },
  messagesPerRound: { type: Number, default: 0 },
  communicationPrompt: { type: String },
});

// Full config schema with all new fields
const CournotConfigSchema = new Schema({
  demandIntercept: { type: Number, required: true },
  demandSlope: { type: Number, required: true },
  firm1LinearCost: { type: Number, required: true },
  firm1QuadraticCost: { type: Number, required: true },
  firm2LinearCost: { type: Number, required: true },
  firm2QuadraticCost: { type: Number, required: true },
  totalRounds: { type: Number, required: true },
  numReplications: { type: Number, default: 1 },
  firm1Model: { type: String, required: true },
  firm2Model: { type: String, required: true },
  firm1Info: { type: InformationDisclosureSchema },
  firm2Info: { type: InformationDisclosureSchema },
  communication: { type: CommunicationSettingsSchema },
  customSystemPrompt: { type: String },
  customRoundPrompt: { type: String },
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

const CooperativeEquilibriumSchema = new Schema({
  firm1Quantity: { type: Number, required: true },
  firm2Quantity: { type: Number, required: true },
  totalQuantity: { type: Number, required: true },
  marketPrice: { type: Number, required: true },
  firm1Profit: { type: Number, required: true },
  firm2Profit: { type: Number, required: true },
  totalProfit: { type: Number, required: true },
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
  rounds: { type: [RoundResultSchema], default: [] },  // Last replication's rounds
  replications: { type: [ReplicationResultSchema], default: [] },  // All replications
  nashEquilibrium: { type: NashEquilibriumSchema, required: true },
  cooperativeEquilibrium: { type: CooperativeEquilibriumSchema },
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
