import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config/index.js';

const router = Router();

// Proxy to Wealth Pulse API - Expenses
router.get('/expenses', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${config.apis.wealthPulse}/expenses`);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error (expenses):', error);
    res.status(502).json({ error: 'Failed to fetch expenses from wealth-pulse-api' });
  }
});

router.post('/expenses', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${config.apis.wealthPulse}/expenses`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error (create expense):', error);
    res.status(502).json({ error: 'Failed to create expense in wealth-pulse-api' });
  }
});

// Proxy to Life Notes API - Notes
router.get('/notes', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${config.apis.lifeNotes}/notes`);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error (notes):', error);
    res.status(502).json({ error: 'Failed to fetch notes from life-notes-api' });
  }
});

router.post('/notes', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${config.apis.lifeNotes}/notes`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error (create note):', error);
    res.status(502).json({ error: 'Failed to create note in life-notes-api' });
  }
});

// Proxy to Life Notes API - Todos
router.get('/todos', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${config.apis.lifeNotes}/todos`);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error (todos):', error);
    res.status(502).json({ error: 'Failed to fetch todos from life-notes-api' });
  }
});

router.post('/todos', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${config.apis.lifeNotes}/todos`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error (create todo):', error);
    res.status(502).json({ error: 'Failed to create todo in life-notes-api' });
  }
});

router.get('/todos/:type', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${config.apis.lifeNotes}/todos/${req.params.type}`);
    res.json(response.data);
  } catch (error) {
    console.error('Proxy error (todos by type):', error);
    res.status(502).json({ error: 'Failed to fetch todos by type from life-notes-api' });
  }
});

export { router as proxyRouter };
