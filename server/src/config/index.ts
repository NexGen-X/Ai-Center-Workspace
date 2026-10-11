import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgres://routex:a8ad6064dad32fc6ec79f0378d6b8c1e@127.0.0.1:5432/ai_center?sslmode=disable',
  encryptionKey: process.env.ENCRYPTION_KEY || 'ai-center-default-32-chars-key-2026!',
  defaultWorkspaceId: 'ws-default-command-center',
  nodeEnv: process.env.NODE_ENV || 'development'
};
