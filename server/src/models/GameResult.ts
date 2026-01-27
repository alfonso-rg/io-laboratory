import mongoose, { Schema, Document } from 'mongoose';
import { GameResultData } from '../types';

export interface GameResultDocument extends GameResultData, Document {}

// Communication message schema (updated for N firms)
const CommunicationMessageSchema = new Schema({
  firm: { type: Number, required: true, min: 1, max: 10 },
  message: { type: String, required: true },
});

// Individual firm result schema (for N-firm support)
const FirmRoundResultSchema = new Schema({
  firmId: { type: Number, required: true },
  quantity: { type: Number, required: true },
  price: { type: Number },
  profit: { type: Number, required: true },
  reasoning: { type: String },
  // Prompts sent to LLM (for auditing/debugging)
  systemPrompt: { type: String },
  roundPrompt: { type: String },
});

// Round result schema with communication (extended for N firms)
const RoundResultSchema = new Schema({
  roundNumber: { type: Number, required: true },
  // Legacy fields for backward compatibility
  firm1Quantity: { type: Number, required: true },
  firm2Quantity: { type: Number, required: true },
  totalQuantity: { type: Number, required: true },
  marketPrice: { type: Number, required: true },
  firm1Profit: { type: Number, required: true },
  firm2Profit: { type: Number, required: true },
  firm1Reasoning: { type: String },
  firm2Reasoning: { type: String },
  // New fields for N-firm support
  firmResults: { type: [FirmRoundResultSchema], default: [] },
  marketPrices: { type: [Number], default: [] },
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

// Firm configuration schema (for N firms)
const FirmConfigSchema = new Schema({
  id: { type: Number, required: true },
  linearCost: { type: Number, required: true },
  quadraticCost: { type: Number, required: true },
  model: { type: String, required: true },
  info: { type: InformationDisclosureSchema },
});

// Full config schema with all new fields (extended for N-poly and Bertrand)
const CournotConfigSchema = new Schema({
  // Competition mode and market structure
  competitionMode: { type: String, enum: ['cournot', 'bertrand'], default: 'cournot' },
  numFirms: { type: Number, default: 2, min: 2, max: 10 },
  gamma: { type: Number, default: 1, min: 0, max: 1 },

  // Demand parameters
  demandIntercept: { type: Number, required: true },
  demandSlope: { type: Number, required: true },

  // Legacy firm cost fields (for backward compatibility)
  firm1LinearCost: { type: Number, required: true },
  firm1QuadraticCost: { type: Number, required: true },
  firm2LinearCost: { type: Number, required: true },
  firm2QuadraticCost: { type: Number, required: true },

  // Game settings
  totalRounds: { type: Number, required: true },
  numReplications: { type: Number, default: 1 },

  // Legacy model fields (for backward compatibility)
  firm1Model: { type: String, required: true },
  firm2Model: { type: String, required: true },

  // Legacy info disclosure fields (for backward compatibility)
  firm1Info: { type: InformationDisclosureSchema },
  firm2Info: { type: InformationDisclosureSchema },

  // N-firm configuration array
  firms: { type: [FirmConfigSchema], default: [] },

  // Communication settings
  communication: { type: CommunicationSettingsSchema },

  // Custom prompts
  customSystemPrompt: { type: String },
  customRoundPrompt: { type: String },

  // Constraints
  minQuantity: { type: Number },
  maxQuantity: { type: Number },
  minPrice: { type: Number },
  maxPrice: { type: Number },
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
