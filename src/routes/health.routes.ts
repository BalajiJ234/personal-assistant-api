import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config/index.js';

const router = Router();

// Health check for this API
router.get('/', async (_req: Request, res: Response) => {
  // Check downstream services
  const serviceHealth = {
    wealthPulseApi: 'unknown',
    lifeNotesApi: 'unknown',
  };

  try {
    await axios.get(`${config.apis.wealthPulse}/health`, { timeout: 2000 });
    serviceHealth.wealthPulseApi = 'healthy';
  } catch {
    serviceHealth.wealthPulseApi = 'unhealthy';
  }

  try {
    await axios.get(`${config.apis.lifeNotes}/health`, { timeout: 2000 });
    serviceHealth.lifeNotesApi = 'healthy';
  } catch {
    serviceHealth.lifeNotesApi = 'unhealthy';
  }

  res.json({
    status: 'ok',
    service: 'personal-assistant-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    downstreamServices: serviceHealth,
  });
});

export { router as healthRouter };
