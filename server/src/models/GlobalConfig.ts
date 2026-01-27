import mongoose, { Schema, Document } from 'mongoose';

export interface GlobalConfigData {
  key: string;
  value: unknown;
  description?: string;
}

export interface GlobalConfigDocument extends GlobalConfigData, Document {}

const GlobalConfigSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed, required: true },
  description: { type: String },
}, {
  timestamps: true,
});

export const GlobalConfigModel = mongoose.model<GlobalConfigDocument>('GlobalConfig', GlobalConfigSchema);

// Helper functions for common config operations
export async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  const config = await GlobalConfigModel.findOne({ key });
  return config ? (config.value as T) : defaultValue;
}

export async function setConfig<T>(key: string, value: T, description?: string): Promise<void> {
  await GlobalConfigModel.findOneAndUpdate(
    { key },
    { key, value, description },
    { upsert: true }
  );
}
