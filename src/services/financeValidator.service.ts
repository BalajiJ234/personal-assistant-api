/**
 * Finance Validator Service
 * Validates parsed entries before they are sent to wealth-pulse-api.
 * Returns structured error/warning/ignored lists.
 */

import type {
  ParsedEntry,
  ParsedTransaction,
  ParsedDebt,
  ParsedCommitment,
} from './financeParser.service.js';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ValidationError {
  entryId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DuplicateWarning {
  entryId: string;
  duplicateOf: string; // id of the conflicting entry
  reason: string;
}

export interface ValidationResult {
  valid: ParsedEntry[];
  invalid: ParsedEntry[];          // has at least one 'error'
  warnings: ValidationError[];     // 'warning' severity issues on valid entries
  errors: ValidationError[];       // 'error' severity issues
  duplicates: DuplicateWarning[];
  needsReview: ParsedEntry[];      // confidenceScore < 0.70
  ignored: ParsedEntry[];          // amount = 0 or completely unparseable
}

const SUPPORTED_CURRENCIES = ['AED', 'INR', 'USD', 'EUR', 'GBP'];

// ─── Individual Validators ─────────────────────────────────────────────────

function validateAmount(entry: ParsedEntry): ValidationError | null {
  const amount =
    entry.type === 'EXPENSE' || entry.type === 'INCOME'
      ? (entry as ParsedTransaction).amount
      : entry.type === 'DEBT'
      ? (entry as ParsedDebt).totalAmount
      : entry.type === 'COMMITMENT'
      ? (entry as ParsedCommitment).amount
      : 0;

  if (amount === undefined || amount === null) {
    return { entryId: entry.id, field: 'amount', message: 'Amount is missing', severity: 'error' };
  }
  if (isNaN(amount) || amount <= 0) {
    return { entryId: entry.id, field: 'amount', message: `Invalid amount: ${amount}`, severity: 'error' };
  }
  if (amount > 10_000_000) {
    return { entryId: entry.id, field: 'amount', message: 'Amount seems unusually large — please verify', severity: 'warning' };
  }
  return null;
}

function validateCurrency(entry: ParsedEntry): ValidationError | null {
  const currency =
    entry.type === 'EXPENSE' || entry.type === 'INCOME'
      ? (entry as ParsedTransaction).currency
      : entry.type === 'DEBT'
      ? (entry as ParsedDebt).currency
      : entry.type === 'COMMITMENT'
      ? (entry as ParsedCommitment).currency
      : 'AED';

  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return {
      entryId: entry.id,
      field: 'currency',
      message: `Unsupported currency "${currency}". Supported: ${SUPPORTED_CURRENCIES.join(', ')}`,
      severity: 'error',
    };
  }
  return null;
}

function validateDate(entry: ParsedEntry): ValidationError | null {
  const dateField =
    entry.type === 'EXPENSE' || entry.type === 'INCOME'
      ? (entry as ParsedTransaction).transactionDate
      : entry.type === 'COMMITMENT'
      ? (entry as ParsedCommitment).dueDate
      : null;

  if (!dateField) return null; // debts + purchase goals don't require a date

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateField)) {
    return {
      entryId: entry.id,
      field: 'date',
      message: `Invalid date format "${dateField}". Expected YYYY-MM-DD`,
      severity: 'error',
    };
  }

  const parsed = new Date(dateField);
  if (isNaN(parsed.getTime())) {
    return {
      entryId: entry.id,
      field: 'date',
      message: `Date "${dateField}" is not a valid calendar date`,
      severity: 'error',
    };
  }

  const now = new Date();
  const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
  const twoYearsAhead = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
  if (parsed < twoYearsAgo || parsed > twoYearsAhead) {
    return {
      entryId: entry.id,
      field: 'date',
      message: `Date "${dateField}" is outside the acceptable range (±2 years)`,
      severity: 'warning',
    };
  }

  return null;
}

function validateTitle(entry: ParsedEntry): ValidationError | null {
  const title =
    entry.type === 'EXPENSE' || entry.type === 'INCOME'
      ? (entry as ParsedTransaction).title
      : entry.type === 'DEBT'
      ? (entry as ParsedDebt).debtName
      : entry.type === 'COMMITMENT'
      ? (entry as ParsedCommitment).title
      : '';

  if (!title || title.trim().length < 2) {
    return {
      entryId: entry.id,
      field: 'title',
      message: 'Title is too short or missing',
      severity: 'warning',
    };
  }
  return null;
}

function validateConfidence(entry: ParsedEntry): ValidationError | null {
  if (entry.confidenceScore < 0.70) {
    return {
      entryId: entry.id,
      field: 'confidenceScore',
      message: `Low confidence score (${Math.round(entry.confidenceScore * 100)}%) — manual review required`,
      severity: 'warning',
    };
  }
  return null;
}

// ─── Duplicate Detection ───────────────────────────────────────────────────

function detectDuplicates(entries: ParsedEntry[]): DuplicateWarning[] {
  const warnings: DuplicateWarning[] = [];
  const transactions = entries.filter(
    (e): e is ParsedTransaction => e.type === 'EXPENSE' || e.type === 'INCOME'
  );

  for (let i = 0; i < transactions.length; i++) {
    for (let j = i + 1; j < transactions.length; j++) {
      const a = transactions[i];
      const b = transactions[j];
      const sameAmount = a.amount === b.amount;
      const sameCurrency = a.currency === b.currency;
      const sameTitle =
        a.title.toLowerCase().trim() === b.title.toLowerCase().trim();
      const sameDate = a.transactionDate === b.transactionDate;

      // Flag as potential duplicate if amount + currency + title match
      if (sameAmount && sameCurrency && sameTitle) {
        warnings.push({
          entryId: b.id,
          duplicateOf: a.id,
          reason: `Same amount (${a.amount} ${a.currency}), title, and date (${sameDate ? 'identical' : 'different date'})`,
        });
      }
    }
  }

  return warnings;
}

// ─── Main Validator ────────────────────────────────────────────────────────

export function validateEntries(entries: ParsedEntry[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  const errorsByEntryId = new Map<string, boolean>();

  for (const entry of entries) {
    const checks = [
      validateAmount(entry),
      validateCurrency(entry),
      validateDate(entry),
      validateTitle(entry),
      validateConfidence(entry),
    ];

    for (const issue of checks) {
      if (!issue) continue;
      if (issue.severity === 'error') {
        allErrors.push(issue);
        errorsByEntryId.set(entry.id, true);
      } else {
        allWarnings.push(issue);
      }
    }
  }

  const duplicates = detectDuplicates(entries);
  // Mark duplicate entries as warnings (not errors — user can choose to import anyway)
  for (const dup of duplicates) {
    allWarnings.push({
      entryId: dup.entryId,
      field: 'duplicate',
      message: dup.reason,
      severity: 'warning',
    });
  }

  const valid: ParsedEntry[] = [];
  const invalid: ParsedEntry[] = [];
  const needsReview: ParsedEntry[] = [];
  const ignored: ParsedEntry[] = [];

  for (const entry of entries) {
    const amount =
      entry.type === 'EXPENSE' || entry.type === 'INCOME'
        ? (entry as ParsedTransaction).amount
        : entry.type === 'DEBT'
        ? (entry as ParsedDebt).totalAmount
        : entry.type === 'COMMITMENT'
        ? (entry as ParsedCommitment).amount
        : 0;

    if (!amount || amount <= 0) {
      ignored.push(entry);
      continue;
    }

    if (errorsByEntryId.get(entry.id)) {
      invalid.push(entry);
    } else if (entry.confidenceScore < 0.70) {
      needsReview.push(entry);
    } else {
      valid.push(entry);
    }
  }

  return {
    valid,
    invalid,
    warnings: allWarnings,
    errors: allErrors,
    duplicates,
    needsReview,
    ignored,
  };
}
