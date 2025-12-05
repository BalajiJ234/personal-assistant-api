import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Backend API URLs
  apis: {
    wealthPulse: process.env.WEALTH_PULSE_API_URL || 'http://localhost:3001/api',
    lifeNotes: process.env.LIFE_NOTES_API_URL || 'http://localhost:3002/api',
  },

  // AI Configuration
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4',
  },

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};
