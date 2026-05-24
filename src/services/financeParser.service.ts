/**
 * Finance Parser Service
 * Parses free-form text into structured financial transaction objects.
 * Supports: expenses, income, debts, commitments, purchase goals.
 * No database logic — this is purely a parsing/categorization layer.
 */

export type ParsedType =
  | 'EXPENSE'
  | 'INCOME'
  | 'DEBT'
  | 'COMMITMENT'
  | 'PURCHASE_GOAL';

export interface ParsedTransaction {
  id: string;
  type: 'EXPENSE' | 'INCOME';
  title: string;
  amount: number;
  currency: string;
  category: string;
  transactionDate: string;
  confidenceScore: number;
  source: 'chat' | 'file';
  tags: string[];
  notes: string;
  rawText: string;
}

export interface ParsedDebt {
  id: string;
  type: 'DEBT';
  debtName: string;
  totalAmount: number;
  currency: string;
  debtType: string;
  status: 'ACTIVE';
  confidenceScore: number;
  rawText: string;
}

export interface ParsedCommitment {
  id: string;
  type: 'COMMITMENT';
  title: string;
  amount: number;
  currency: string;
  dueDate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;
  rawText: string;
}

export interface ParsedPurchaseGoal {
  id: string;
  type: 'PURCHASE_GOAL';
  itemName: string;
  estimatedCost: number;
  currency: string;
  targetDate: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;
  rawText: string;
}

export type ParsedEntry =
  | ParsedTransaction
  | ParsedDebt
  | ParsedCommitment
  | ParsedPurchaseGoal;

export interface ParseResult {
  entries: ParsedEntry[];
  unparsedLines: string[];
  totalDetected: number;
}

// ─── Currency Detection ────────────────────────────────────────────────────

const SUPPORTED_CURRENCIES = ['AED', 'INR', 'USD', 'EUR', 'GBP'] as const;
type Currency = (typeof SUPPORTED_CURRENCIES)[number];
const DEFAULT_CURRENCY: Currency = 'AED';

const CURRENCY_SYMBOLS: Record<string, Currency> = {
  '₹': 'INR',
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  'dhs': 'AED',
  'dirham': 'AED',
  'dirhams': 'AED',
  'inr': 'INR',
  'rs': 'INR',
  'rupee': 'INR',
  'rupees': 'INR',
  'usd': 'USD',
  'dollar': 'USD',
  'dollars': 'USD',
  'eur': 'EUR',
  'euro': 'EUR',
  'euros': 'EUR',
  'gbp': 'GBP',
  'pound': 'GBP',
  'pounds': 'GBP',
};

function detectCurrency(text: string): Currency {
  const upper = text.toUpperCase();
  // Check ISO codes first (exact word boundary match)
  for (const code of SUPPORTED_CURRENCIES) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) {
      return code;
    }
  }
  // Check symbols and aliases
  const lower = text.toLowerCase();
  for (const [alias, currency] of Object.entries(CURRENCY_SYMBOLS)) {
    if (lower.includes(alias)) return currency;
  }
  return DEFAULT_CURRENCY;
}

// ─── Amount Detection ──────────────────────────────────────────────────────

/**
 * Finds the first monetary amount in a text segment.
 * Handles: "120 AED", "₹8500", "$45.50", "120"
 */
function extractAmount(text: string): number | null {
  // Pattern: optional currency symbol, digits, optional decimal
  const match = text.match(
    /(?:[₹$€£])\s*(\d{1,10}(?:[.,]\d{1,2})?)|(\d{1,10}(?:[.,]\d{1,2})?)\s*(?:AED|INR|USD|EUR|GBP|dhs?|rs|₹|\$|€|£)/i
  );
  if (match) {
    const raw = (match[1] || match[2]).replace(',', '');
    return parseFloat(raw);
  }
  // Fallback: first standalone number in the segment
  const plain = text.match(/\b(\d{1,10}(?:\.\d{1,2})?)\b/);
  if (plain) return parseFloat(plain[1]);
  return null;
}

// ─── Category Mapping ─────────────────────────────────────────────────────

type CategoryRule = { keywords: string[]; category: string };

const EXPENSE_CATEGORY_RULES: CategoryRule[] = [
  { keywords: ['grocery', 'groceries', 'supermarket', 'lulu', 'carrefour', 'spinneys', 'food', 'vegetable', 'fruit', 'milk', 'bread'], category: 'Food & Groceries' },
  { keywords: ['restaurant', 'dining', 'dinner', 'lunch', 'breakfast', 'cafe', 'coffee', 'tea', 'burger', 'pizza', 'shawarma', 'biryani', 'eat'], category: 'Dining Out' },
  { keywords: ['taxi', 'uber', 'careem', 'cab', 'ride', 'transport', 'metro', 'bus', 'petrol', 'fuel', 'parking'], category: 'Transport' },
  { keywords: ['rent', 'landlord', 'apartment', 'flat', 'house', 'villa', 'accommodation', 'housing'], category: 'Accommodation' },
  { keywords: ['netflix', 'spotify', 'subscription', 'amazon prime', 'youtube premium', 'hulu', 'disney', 'apple music', 'membership'], category: 'Subscriptions' },
  { keywords: ['electricity', 'dewa', 'water', 'internet', 'wifi', 'etisalat', 'du ', 'bill', 'utility', 'utilities'], category: 'Utilities' },
  { keywords: ['hospital', 'doctor', 'clinic', 'pharmacy', 'medicine', 'health', 'dental', 'medical'], category: 'Healthcare' },
  { keywords: ['shopping', 'clothes', 'shirt', 'shoes', 'mall', 'fashion', 'dress', 'jeans', 'accessory'], category: 'Shopping' },
  { keywords: ['gym', 'fitness', 'sport', 'yoga', 'swim', 'workout', 'exercise'], category: 'Health & Fitness' },
  { keywords: ['school', 'tuition', 'course', 'education', 'university', 'college', 'book', 'training', 'learn'], category: 'Education' },
  { keywords: ['travel', 'flight', 'hotel', 'airbnb', 'trip', 'vacation', 'holiday', 'booking', 'visa'], category: 'Travel' },
  { keywords: ['sent to family', 'family transfer', 'remittance', 'transfer', 'send money', 'sent money'], category: 'Family & Remittance' },
  { keywords: ['iphone', 'macbook', 'laptop', 'phone', 'gadget', 'electronics', 'tech'], category: 'Electronics' },
];

const INCOME_CATEGORY_RULES: CategoryRule[] = [
  { keywords: ['salary', 'payroll', 'wage', 'stipend', 'pay'], category: 'Salary' },
  { keywords: ['freelance', 'project', 'client payment', 'invoice'], category: 'Freelance' },
  { keywords: ['bonus', 'incentive', 'commission'], category: 'Bonus' },
  { keywords: ['rent received', 'rental income', 'tenant'], category: 'Rental Income' },
  { keywords: ['dividend', 'interest', 'return', 'investment income'], category: 'Investment' },
  { keywords: ['refund', 'cashback', 'reimbursement'], category: 'Refund' },
];

function detectCategory(text: string, type: 'EXPENSE' | 'INCOME'): string {
  const lower = text.toLowerCase();
  const rules = type === 'EXPENSE' ? EXPENSE_CATEGORY_RULES : INCOME_CATEGORY_RULES;
  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return type === 'EXPENSE' ? 'Other' : 'Other Income';
}

// ─── Transaction Type Detection ────────────────────────────────────────────

const DEBT_KEYWORDS = [
  'credit card', 'loan', 'emi', 'debt', 'borrowed', 'owe', 'owes', 'outstanding', 'dues', 'mortgage',
];
const COMMITMENT_KEYWORDS = [
  'due on', 'due date', 'upcoming', 'recurring', 'monthly rent', 'subscription due',
  'insurance due', 'renewal', 'due in', 'pay on', 'payable on',
];
const PURCHASE_GOAL_KEYWORDS = [
  'want to buy', 'planning to buy', 'need to buy', 'saving for', 'wish list',
  'want a', 'want an', 'need a', 'need an', 'planning a', 'planning an',
];
const INCOME_KEYWORDS = [
  'received', 'salary', 'income received', 'got paid', 'payment received',
  'earned', 'freelance income', 'bonus received', 'dividend',
];

function detectType(text: string): ParsedType {
  const lower = text.toLowerCase();
  if (PURCHASE_GOAL_KEYWORDS.some((kw) => lower.includes(kw))) return 'PURCHASE_GOAL';
  if (DEBT_KEYWORDS.some((kw) => lower.includes(kw))) return 'DEBT';
  if (COMMITMENT_KEYWORDS.some((kw) => lower.includes(kw))) return 'COMMITMENT';
  if (INCOME_KEYWORDS.some((kw) => lower.includes(kw))) return 'INCOME';
  return 'EXPENSE'; // default
}

// ─── Date Detection ────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

function detectDate(text: string): string {
  const today = new Date();
  const lower = text.toLowerCase();

  // "next month" → first of next month
  if (lower.includes('next month')) {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return d.toISOString().split('T')[0];
  }

  // "due on June 5" or "June 5" or "5 June"
  const monthDayMatch = lower.match(
    /(?:due\s+on\s+|on\s+)?([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/
  );
  if (monthDayMatch) {
    const monthNum = MONTH_MAP[monthDayMatch[1]];
    if (monthNum) {
      const day = parseInt(monthDayMatch[2]);
      const year =
        monthNum < today.getMonth() + 1 ? today.getFullYear() + 1 : today.getFullYear();
      return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // ISO date: "2026-05-20"
  const isoMatch = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return isoMatch[1];

  // DD/MM/YYYY or MM/DD/YYYY
  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const [, d, m, y] = slashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Default: today
  return today.toISOString().split('T')[0];
}

// ─── Debt Type Detection ───────────────────────────────────────────────────

function detectDebtType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('credit card')) return 'Credit Card';
  if (lower.includes('mortgage') || lower.includes('home loan')) return 'Mortgage';
  if (lower.includes('car loan') || lower.includes('auto loan')) return 'Auto Loan';
  if (lower.includes('personal loan')) return 'Personal Loan';
  if (lower.includes('student loan') || lower.includes('education loan')) return 'Student Loan';
  if (lower.includes('emi')) return 'EMI';
  return 'Other Debt';
}

// ─── Commitment Priority ───────────────────────────────────────────────────

function detectCommitmentPriority(text: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const lower = text.toLowerCase();
  if (lower.includes('rent') || lower.includes('mortgage') || lower.includes('insurance')) return 'HIGH';
  if (lower.includes('subscription') || lower.includes('utility') || lower.includes('bill')) return 'MEDIUM';
  return 'LOW';
}

// ─── Confidence Scoring ────────────────────────────────────────────────────

function scoreConfidence(params: {
  hasAmount: boolean;
  hasCurrency: boolean;
  hasDate: boolean;
  hasCategory: boolean;
  typeIsExplicit: boolean;
}): number {
  let score = 0;
  if (params.hasAmount) score += 0.40;
  if (params.hasCurrency) score += 0.20;
  if (params.hasDate) score += 0.15;
  if (params.hasCategory) score += 0.15;
  if (params.typeIsExplicit) score += 0.10;
  return Math.round(score * 100) / 100;
}

// ─── Title Extraction ──────────────────────────────────────────────────────

function extractTitle(text: string): string {
  // Remove amount + currency
  let clean = text
    .replace(/(?:[₹$€£]\s*\d+(?:[.,]\d{1,2})?)/g, '')
    .replace(/\d+(?:[.,]\d{1,2})?\s*(?:AED|INR|USD|EUR|GBP|dhs?|rs)/gi, '')
    .replace(/\b(?:paid|spent|bought|sent|received|got|salary|income|debt|credit card|loan|emi|due on|upcoming|want to buy|planning to buy)\b/gi, '')
    .replace(/[,;]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return clean.length > 2 ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Transaction';
}

function genId(): string {
  return `parsed_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Single-Line Parser ────────────────────────────────────────────────────

export function parseSingleLine(
  raw: string,
  source: 'chat' | 'file' = 'chat'
): ParsedEntry | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const amount = extractAmount(trimmed);
  const currency = detectCurrency(trimmed);
  const detectedType = detectType(trimmed);
  const date = detectDate(trimmed);

  const hasCurrencyExplicit =
    SUPPORTED_CURRENCIES.some((c) => trimmed.toUpperCase().includes(c)) ||
    Object.keys(CURRENCY_SYMBOLS).some((s) => trimmed.toLowerCase().includes(s));

  const hasDateExplicit =
    /\b\d{4}-\d{2}-\d{2}\b/.test(trimmed) ||
    /\b\d{1,2}\/\d{1,2}\/\d{4}\b/.test(trimmed) ||
    Object.keys(MONTH_MAP).some((m) => trimmed.toLowerCase().includes(m));

  if (detectedType === 'DEBT') {
    const confidence = scoreConfidence({
      hasAmount: amount !== null,
      hasCurrency: hasCurrencyExplicit,
      hasDate: false,
      hasCategory: true,
      typeIsExplicit: DEBT_KEYWORDS.some((kw) => trimmed.toLowerCase().includes(kw)),
    });
    const entry: ParsedDebt = {
      id: genId(),
      type: 'DEBT',
      debtName: extractTitle(trimmed),
      totalAmount: amount ?? 0,
      currency,
      debtType: detectDebtType(trimmed),
      status: 'ACTIVE',
      confidenceScore: confidence,
      rawText: trimmed,
    };
    return entry;
  }

  if (detectedType === 'COMMITMENT') {
    const confidence = scoreConfidence({
      hasAmount: amount !== null,
      hasCurrency: hasCurrencyExplicit,
      hasDate: hasDateExplicit,
      hasCategory: true,
      typeIsExplicit: COMMITMENT_KEYWORDS.some((kw) => trimmed.toLowerCase().includes(kw)),
    });
    const entry: ParsedCommitment = {
      id: genId(),
      type: 'COMMITMENT',
      title: extractTitle(trimmed),
      amount: amount ?? 0,
      currency,
      dueDate: date,
      priority: detectCommitmentPriority(trimmed),
      confidenceScore: confidence,
      rawText: trimmed,
    };
    return entry;
  }

  if (detectedType === 'PURCHASE_GOAL') {
    const confidence = scoreConfidence({
      hasAmount: amount !== null,
      hasCurrency: hasCurrencyExplicit,
      hasDate: false,
      hasCategory: false,
      typeIsExplicit: PURCHASE_GOAL_KEYWORDS.some((kw) => trimmed.toLowerCase().includes(kw)),
    });
    const entry: ParsedPurchaseGoal = {
      id: genId(),
      type: 'PURCHASE_GOAL',
      itemName: extractTitle(trimmed),
      estimatedCost: amount ?? 0,
      currency,
      targetDate: '',
      priority: 'MEDIUM',
      confidenceScore: confidence,
      rawText: trimmed,
    };
    return entry;
  }

  // EXPENSE or INCOME
  const txType: 'EXPENSE' | 'INCOME' = detectedType === 'INCOME' ? 'INCOME' : 'EXPENSE';
  const category = detectCategory(trimmed, txType);
  const isDefaultCategory = category === 'Other' || category === 'Other Income';

  const typeIsExplicit =
    txType === 'INCOME'
      ? INCOME_KEYWORDS.some((kw) => trimmed.toLowerCase().includes(kw))
      : true; // expense is default, so count as explicit

  const confidence = scoreConfidence({
    hasAmount: amount !== null,
    hasCurrency: hasCurrencyExplicit,
    hasDate: hasDateExplicit,
    hasCategory: !isDefaultCategory,
    typeIsExplicit,
  });

  const entry: ParsedTransaction = {
    id: genId(),
    type: txType,
    title: extractTitle(trimmed),
    amount: amount ?? 0,
    currency,
    category,
    transactionDate: date,
    confidenceScore: confidence,
    source,
    tags: [],
    notes: '',
    rawText: trimmed,
  };
  return entry;
}

// ─── Multi-Entry Text Parser ───────────────────────────────────────────────

/**
 * Splits a user message into individual transaction entries.
 * Handles: comma-separated, newline-separated, semicolon-separated.
 *
 * Example input:
 * "Paid 120 AED grocery, 45 AED taxi, salary received 8500 AED"
 */
export function parseMessage(text: string, source: 'chat' | 'file' = 'chat'): ParseResult {
  // Split on commas, semicolons, or newlines — but only if the segment has a number
  const rawLines = text
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const entries: ParsedEntry[] = [];
  const unparsedLines: string[] = [];

  for (const line of rawLines) {
    // Skip lines with no numeric content
    if (!/\d/.test(line)) {
      // Could still be a purchase goal: "Want to buy iPhone"
      if (PURCHASE_GOAL_KEYWORDS.some((kw) => line.toLowerCase().includes(kw))) {
        const entry = parseSingleLine(line, source);
        if (entry) entries.push(entry);
        else unparsedLines.push(line);
      } else {
        unparsedLines.push(line);
      }
      continue;
    }

    const entry = parseSingleLine(line, source);
    if (entry) entries.push(entry);
    else unparsedLines.push(line);
  }

  return {
    entries,
    unparsedLines,
    totalDetected: entries.length,
  };
}

// ─── CSV Row Parser ────────────────────────────────────────────────────────

export interface CsvRow {
  amount?: string;
  currency?: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  date?: string;
  transaction_date?: string;
  transactionDate?: string;
  type?: string;
  notes?: string;
  note?: string;
}

/**
 * Parses a normalised CSV row into a ParsedTransaction.
 * Handles flexible column name variants.
 */
export function parseCsvRow(row: CsvRow, index: number): ParsedTransaction | null {
  const rawAmount =
    row.amount ?? '';
  const amount = parseFloat(rawAmount.replace(/[^0-9.]/g, ''));
  if (isNaN(amount) || amount <= 0) return null;

  const rawCurrency = (row.currency ?? '').trim().toUpperCase();
  const currency: Currency = SUPPORTED_CURRENCIES.includes(rawCurrency as Currency)
    ? (rawCurrency as Currency)
    : DEFAULT_CURRENCY;

  const rawTitle = (row.title ?? row.name ?? row.description ?? '').trim();
  const title = rawTitle || `Row ${index + 1}`;

  const rawCategory = (row.category ?? '').trim();
  const rawType = (row.type ?? '').trim().toUpperCase();
  const txType: 'EXPENSE' | 'INCOME' =
    rawType === 'INCOME' ? 'INCOME' : 'EXPENSE';

  const rawDate =
    row.date ?? row.transaction_date ?? row.transactionDate ?? '';
  const transactionDate = rawDate.trim()
    ? detectDate(rawDate)
    : new Date().toISOString().split('T')[0];

  const notes = (row.notes ?? row.note ?? '').trim();
  const category =
    rawCategory || detectCategory(rawTitle, txType);

  const hasCurrency = rawCurrency.length > 0;
  const hasDate = rawDate.trim().length > 0;
  const isDefaultCategory = category === 'Other' || category === 'Other Income';

  const confidence = scoreConfidence({
    hasAmount: true,
    hasCurrency,
    hasDate,
    hasCategory: !isDefaultCategory,
    typeIsExplicit: rawType.length > 0,
  });

  return {
    id: genId(),
    type: txType,
    title,
    amount,
    currency,
    category,
    transactionDate,
    confidenceScore: confidence,
    source: 'file',
    tags: [],
    notes,
    rawText: JSON.stringify(row),
  };
}

/**
 * Parses a full JSON array of transaction objects (from JSON file upload).
 */
export function parseJsonArray(data: unknown[]): ParseResult {
  const entries: ParsedEntry[] = [];
  const unparsedLines: string[] = [];

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (typeof row !== 'object' || row === null) {
      unparsedLines.push(String(row));
      continue;
    }
    const parsed = parseCsvRow(row as CsvRow, i);
    if (parsed) entries.push(parsed);
    else unparsedLines.push(JSON.stringify(row));
  }

  return { entries, unparsedLines, totalDetected: entries.length };
}
