import { Router, Request, Response } from 'express';
import { processMessage } from '../services/chat.service.js';

const router = Router();

interface ChatRequest {
  message: string;
  conversationId?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// In-memory conversation store (replace with DB later)
const conversations: Map<string, Message[]> = new Map();

// Send a message to the assistant
router.post('/', async (req: Request<{}, {}, ChatRequest>, res: Response) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Get or create conversation
    const convId = conversationId || `conv_${Date.now()}`;
    if (!conversations.has(convId)) {
      conversations.set(convId, []);
    }

    const history = conversations.get(convId)!;

    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    history.push(userMessage);

    // Process message and get response
    const response = await processMessage(message, history);

    // Add assistant response
    const assistantMessage: Message = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString(),
    };
    history.push(assistantMessage);

    res.json({
      conversationId: convId,
      message: assistantMessage,
      actions: response.actions,
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get conversation history
router.get('/:conversationId', (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const history = conversations.get(conversationId);

  if (!history) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  res.json({
    conversationId,
    messages: history,
  });
});

// List all conversations
router.get('/', (_req: Request, res: Response) => {
  const convList = Array.from(conversations.entries()).map(([id, messages]) => ({
    id,
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1]?.content.slice(0, 50) || '',
    updatedAt: messages[messages.length - 1]?.timestamp || '',
  }));

  res.json({ conversations: convList });
});

export { router as chatRouter };
