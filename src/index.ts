import { app } from './app.js';
import { config } from './config/index.js';

const startServer = () => {
  app.listen(config.port, () => {
    console.log(`🤖 Personal Assistant API running on http://localhost:${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`❤️  Health check: http://localhost:${config.port}/api/health`);
    console.log(`💬 Chat API: http://localhost:${config.port}/api/chat`);
    console.log(`💰 Expenses proxy: http://localhost:${config.port}/api/proxy/expenses`);
    console.log(`📝 Notes proxy: http://localhost:${config.port}/api/proxy/notes`);
    console.log(`✅ Todos proxy: http://localhost:${config.port}/api/proxy/todos`);
  });
};

startServer();
