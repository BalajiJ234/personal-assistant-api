import axios from 'axios';
import { config } from '../config/index.js';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatResponse {
  content: string;
  actions?: Action[];
}

interface Action {
  type: 'expense_added' | 'note_added' | 'todo_added' | 'query_result';
  data: Record<string, unknown>;
}

// Intent detection patterns
const patterns = {
  addExpense: /(?:add|log|record|spent|paid|bought)\s+(?:expense|₹|\$|rs|inr)/i,
  getExpenses: /(?:show|list|get|what are|my)\s+(?:expenses|spending|transactions)/i,
  addNote: /(?:add|create|make|write)\s+(?:a\s+)?note/i,
  getNotes: /(?:show|list|get|what are|my)\s+notes/i,
  addTodo: /(?:add|create|remind|todo|task)/i,
  getTodos: /(?:show|list|get|what are|my)\s+(?:todos|tasks|reminders)/i,
  greeting: /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))/i,
  help: /(?:help|what can you do|commands)/i,
};

export async function processMessage(
  message: string,
  _history: Message[]
): Promise<ChatResponse> {
  const lowerMessage = message.toLowerCase();

  // Greeting
  if (patterns.greeting.test(lowerMessage)) {
    return {
      content: `Hello! 👋 I'm your Life-Sync personal assistant. I can help you with:

💰 **Expenses** - Track and view your spending
📝 **Notes** - Create and manage notes  
✅ **Todos** - Manage tasks across 7 categories

Try saying:
- "Show my expenses"
- "Add a note about meeting tomorrow"
- "Add a work todo: Review PR"`,
    };
  }

  // Help
  if (patterns.help.test(lowerMessage)) {
    return {
      content: `Here's what I can do:

**💰 Expenses:**
- "Add expense ₹500 for lunch"
- "Show my expenses"

**📝 Notes:**
- "Add a note: Meeting at 3pm"
- "Show my notes"

**✅ Todos (7 types):**
- general, work, shopping, health, learning, finance, personal
- "Add a work todo: Complete report"
- "Show my shopping todos"

Just chat naturally and I'll help you!`,
    };
  }

  // Get expenses
  if (patterns.getExpenses.test(lowerMessage)) {
    try {
      const response = await axios.get(`${config.apis.wealthPulse}/expenses`);
      const expenses = response.data.expenses || [];
      
      if (expenses.length === 0) {
        return { content: "You don't have any expenses logged yet. Try saying 'Add expense ₹500 for lunch'" };
      }

      const expenseList = expenses
        .slice(0, 5)
        .map((e: { amount: number; category: string; description: string }) => 
          `• ₹${e.amount} - ${e.category}: ${e.description}`
        )
        .join('\n');

      return {
        content: `Here are your recent expenses:\n\n${expenseList}`,
        actions: [{ type: 'query_result', data: { expenses } }],
      };
    } catch {
      return { content: "Sorry, I couldn't fetch your expenses. The expense service might be offline." };
    }
  }

  // Get notes
  if (patterns.getNotes.test(lowerMessage)) {
    try {
      const response = await axios.get(`${config.apis.lifeNotes}/notes`);
      const notes = response.data.notes || [];
      
      if (notes.length === 0) {
        return { content: "You don't have any notes yet. Try saying 'Add a note: Your note here'" };
      }

      const noteList = notes
        .slice(0, 5)
        .map((n: { title: string }) => `• ${n.title}`)
        .join('\n');

      return {
        content: `Here are your recent notes:\n\n${noteList}`,
        actions: [{ type: 'query_result', data: { notes } }],
      };
    } catch {
      return { content: "Sorry, I couldn't fetch your notes. The notes service might be offline." };
    }
  }

  // Get todos
  if (patterns.getTodos.test(lowerMessage)) {
    try {
      const response = await axios.get(`${config.apis.lifeNotes}/todos`);
      const todos = response.data.todos || [];
      
      if (todos.length === 0) {
        return { content: "You don't have any todos yet. Try saying 'Add a todo: Your task here'" };
      }

      const todoList = todos
        .slice(0, 5)
        .map((t: { title: string; type: string; completed: boolean }) => 
          `• [${t.completed ? '✓' : ' '}] ${t.title} (${t.type})`
        )
        .join('\n');

      return {
        content: `Here are your todos:\n\n${todoList}`,
        actions: [{ type: 'query_result', data: { todos } }],
      };
    } catch {
      return { content: "Sorry, I couldn't fetch your todos. The notes service might be offline." };
    }
  }

  // Add expense (simple pattern matching - will enhance with AI later)
  if (patterns.addExpense.test(lowerMessage)) {
    return {
      content: `I understand you want to add an expense! 💰

To add an expense, use this format:
"Add expense ₹500 for lunch in food category"

**Coming soon:** I'll be able to parse your natural language and automatically add expenses!`,
    };
  }

  // Add note
  if (patterns.addNote.test(lowerMessage)) {
    return {
      content: `I can help you create a note! 📝

For now, please use the Life Notes app directly. 
**Coming soon:** I'll be able to create notes from chat!`,
    };
  }

  // Add todo
  if (patterns.addTodo.test(lowerMessage)) {
    return {
      content: `I can help you create a todo! ✅

Available types: general, work, shopping, health, learning, finance, personal

**Coming soon:** I'll be able to create todos from chat!`,
    };
  }

  // Default response
  return {
    content: `I'm not sure how to help with that yet. Try:
- "Show my expenses"
- "Show my notes"  
- "Show my todos"
- "Help" for more options

I'm continuously learning to help you better! 🚀`,
  };
}
