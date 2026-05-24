/**
 * WealthPulse Integration Service
 * Forwards confirmed parsed entries to wealth-pulse-api.
 * This service is the ONLY place that talks to wealth-pulse-api from personal-assistant-api.
 */

import axios from 'axios';
import { config } from '../config/index.js';
import type {
  ParsedEntry,
  ParsedTransaction,
  ParsedDebt,
  ParsedCommitment,
} from './financeParser.service.js';

// ─── Wealth-pulse-api payload types ───────────────────────────────────────

interface WealthPulseTransaction {
  title: string;
  amount: number;
  currency: string;
  type: 'EXPENSE' | 'INCOME';
  category: string;
  transactionDate: string;
  notes?: string;
  tags?: string[];
}

interface WealthPulseDebt {
  debtName: string;
  totalAmount: number;
  currency: string;
  debtType: string;
  status: string;
  notes?: string;
}

interface WealthPulseCommitment {
  title: string;
  amount: number;
  currency: string;
  dueDate?: string;
  priority?: string;
  notes?: string;
}

// ─── Import Result ────────────────────────────────────────────────────────

export interface ForwardResult {
  importedTransactions: number;
  importedDebts: number;
  importedCommitments: number;
  skipped: number;
  errors: string[];
}

// ─── Converters ───────────────────────────────────────────────────────────

function toWealthPulseTransaction(entry: ParsedTransaction): WealthPulseTransaction {
  return {
    title: entry.title,
    amount: entry.amount,
    currency: entry.currency,
    type: entry.type,
    category: entry.category,
    transactionDate: entry.transactionDate,
    notes: entry.notes || undefined,
    tags: entry.tags?.length ? entry.tags : undefined,
  };
}

function toWealthPulseDebt(entry: ParsedDebt): WealthPulseDebt {
  return {
    debtName: entry.debtName,
    totalAmount: entry.totalAmount,
    currency: entry.currency,
    debtType: entry.debtType,
    status: entry.status,
  };
}

function toWealthPulseCommitment(entry: ParsedCommitment): WealthPulseCommitment {
  return {
    title: entry.title,
    amount: entry.amount,
    currency: entry.currency,
    dueDate: entry.dueDate || undefined,
    priority: entry.priority,
  };
}

// ─── Forward Confirmed Entries ─────────────────────────────────────────────

/**
 * Sends confirmed parsed entries to wealth-pulse-api.
 * Splits entries by type and calls the appropriate routes.
 * Never duplicates DB logic — just forwards normalized payloads.
 */
export async function forwardConfirmedEntries(
  entries: ParsedEntry[]
): Promise<ForwardResult> {
  const result: ForwardResult = {
    importedTransactions: 0,
    importedDebts: 0,
    importedCommitments: 0,
    skipped: 0,
    errors: [],
  };

  const transactions: WealthPulseTransaction[] = [];
  const debts: WealthPulseDebt[] = [];
  const commitments: WealthPulseCommitment[] = [];

  for (const entry of entries) {
    if (entry.type === 'EXPENSE' || entry.type === 'INCOME') {
      transactions.push(toWealthPulseTransaction(entry as ParsedTransaction));
    } else if (entry.type === 'DEBT') {
      debts.push(toWealthPulseDebt(entry as ParsedDebt));
    } else if (entry.type === 'COMMITMENT') {
      commitments.push(toWealthPulseCommitment(entry as ParsedCommitment));
    } else {
      // PURCHASE_GOAL — not yet importable, skip
      result.skipped += 1;
    }
  }

  // ── Bulk Transactions ──
  if (transactions.length > 0) {
    try {
      await axios.post(
        `${config.apis.wealthPulse}/transactions/bulk`,
        { transactions },
        { timeout: 10_000 }
      );
      result.importedTransactions = transactions.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Transactions import failed: ${msg}`);
    }
  }

  // ── Debts (one at a time — no bulk route yet) ──
  for (const debt of debts) {
    try {
      await axios.post(
        `${config.apis.wealthPulse}/debts`,
        debt,
        { timeout: 10_000 }
      );
      result.importedDebts += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Debt "${debt.debtName}" import failed: ${msg}`);
    }
  }

  // ── Commitments (one at a time — no bulk route yet) ──
  for (const commitment of commitments) {
    try {
      await axios.post(
        `${config.apis.wealthPulse}/commitments`,
        commitment,
        { timeout: 10_000 }
      );
      result.importedCommitments += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push(`Commitment "${commitment.title}" import failed: ${msg}`);
    }
  }

  return result;
}
