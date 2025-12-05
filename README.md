# Personal Assistant API - Life-Sync 2.0

AI Orchestrator API for Life-Sync 2.0. This service acts as the central hub that wraps `wealth-pulse-api` and `life-notes-api`, providing a unified chat interface for the personal assistant.

## Part of Life-Sync 2.0 Ecosystem

| Service                    | Type     | Port | Description          |
| -------------------------- | -------- | ---- | -------------------- |
| wealth-pulse-api           | Backend  | 3001 | Expense tracking API |
| life-notes-api             | Backend  | 3002 | Notes & Todos API    |
| **personal-assistant-api** | Backend  | 3003 | AI Orchestrator      |
| personal-assistant         | Frontend | 3000 | Chat UI              |

## Features

- 🤖 **Chat Interface** - Natural language processing for commands
- 🔄 **Service Orchestration** - Proxies requests to downstream APIs
- 💰 **Expense Integration** - Query and add expenses via chat
- 📝 **Notes Integration** - Manage notes through conversation
- ✅ **Todos Integration** - Handle todos with 7 categories
- 🏥 **Health Monitoring** - Checks downstream service health

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js 4.x
- **Language**: TypeScript
- **HTTP Client**: Axios

## API Endpoints

### Health

```
GET /api/health - Service health with downstream status
```

### Chat

```
POST /api/chat - Send message to assistant
GET /api/chat - List all conversations
GET /api/chat/:conversationId - Get conversation history
```

### Proxy (Direct access to downstream APIs)

```
GET/POST /api/proxy/expenses - Wealth Pulse API
GET/POST /api/proxy/notes - Life Notes API
GET/POST /api/proxy/todos - Life Notes API
GET /api/proxy/todos/:type - Todos by type
```

## Getting Started

### Prerequisites

- Node.js 18+
- wealth-pulse-api running on port 3001
- life-notes-api running on port 3002

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run development server
npm run dev
```

### Environment Variables

```env
PORT=3003
NODE_ENV=development
WEALTH_PULSE_API_URL=http://localhost:3001/api
LIFE_NOTES_API_URL=http://localhost:3002/api
CORS_ORIGIN=http://localhost:3000
OPENAI_API_KEY=your-key-here  # For future AI features
```

## Chat Examples

```bash
# Send a message
curl -X POST http://localhost:3003/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show my expenses"}'

# Get conversation
curl http://localhost:3003/api/chat/conv_123456
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    personal-assistant                        │
│                    (Next.js Frontend)                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  personal-assistant-api                      │
│                    (This Service)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Chat Routes │  │Proxy Routes │  │ Chat Service (NLP)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└───────────┬─────────────────────────────────┬───────────────┘
            │                                 │
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────────┐
│   wealth-pulse-api    │         │     life-notes-api        │
│     (Port 3001)       │         │       (Port 3002)         │
│   - Expenses          │         │   - Notes                 │
│   - Categories        │         │   - Todos (7 types)       │
└───────────────────────┘         └───────────────────────────┘
```

## Docker

```bash
# Build and run
docker build -t personal-assistant-api .
docker run -p 3003:3003 personal-assistant-api

# Or with docker-compose (all services)
docker-compose up
```

## Roadmap

- [ ] OpenAI/GPT integration for better NLP
- [ ] Streaming responses
- [ ] Voice command support
- [ ] Smart suggestions based on patterns
- [ ] Multi-user support with auth

## Related Repositories

- [life-sync-2.0](https://github.com/BalajiJ234/life-sync-2.0) - Infrastructure
- [wealth-pulse-api](https://github.com/BalajiJ234/wealth-pulse-api) - Expense API
- [life-notes-api](https://github.com/BalajiJ234/life-notes-api) - Notes API
- [personal-assistant](https://github.com/BalajiJ234/personal-assistant) - Chat UI

## License

MIT
