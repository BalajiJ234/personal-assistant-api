import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { config } from './config/index.js';
import { healthRouter } from './routes/health.routes.js';
import { chatRouter } from './routes/chat.routes.js';
import { proxyRouter } from './routes/proxy.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';

const app: Application = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/health', healthRouter);
app.use('/api/chat', chatRouter);
app.use('/api/proxy', proxyRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
