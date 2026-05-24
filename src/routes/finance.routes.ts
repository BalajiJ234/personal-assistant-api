/**
 * Finance Routes
 * Provides 5 endpoints for the conversational finance import feature.
 *
 * POST /api/finance/parse-message   — parse free-form text
 * POST /api/finance/parse-file      — parse uploaded CSV/JSON/TXT
 * POST /api/finance/validate        — validate (re-validate edited preview)
 * POST /api/finance/confirm-import  — forward confirmed entries to wealth-pulse-api
 * GET  /api/finance/import-history  — return recent import history (in-memory)
 */

import { Router, Request, Response } from 'express';
import { parse as parseCsv } from 'csv-parse/sync';
import { upload } from '../middleware/upload.middleware.js';
import {
  parseMessage,
  parseCsvRow,
  parseJsonArray,
  type ParsedEntry,
  type CsvRow,
} from '../services/financeParser.service.js';
import { validateEntries } from '../services/financeValidator.service.js';
import { forwardConfirmedEntries } from '../services/wealthPulse.service.js';

const router = Router();

// ─── In-memory import history (replace with DB in Phase 9) ────────────────

interface ImportHistoryRecord {
  id: string;
  sourceType: 'chat' | 'file';
  fileName?: string;
  importedCount: number;
  skippedCount: number;
  duplicateCount: number;
  createdAt: string;
}

const importHistory: ImportHistoryRecord[] = [];

// ─── POST /api/finance/parse-message ─────────────────────────────────────

interface ParseMessageBody {
  message: string;
}

router.post(
  '/parse-message',
  async (req: Request<object, object, ParseMessageBody>, res: Response) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== 'string' || !message.trim()) {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      const parseResult = parseMessage(message.trim(), 'chat');
      const validation = validateEntries(parseResult.entries);

      res.json({
        entries: parseResult.entries,
        unparsedLines: parseResult.unparsedLines,
        totalDetected: parseResult.totalDetected,
        validation: {
          valid: validation.valid.length,
          invalid: validation.invalid.length,
          needsReview: validation.needsReview.length,
          ignored: validation.ignored.length,
          errors: validation.errors,
          warnings: validation.warnings,
          duplicates: validation.duplicates,
        },
      });
    } catch (err) {
      console.error('parse-message error:', err);
      res.status(500).json({ error: 'Failed to parse message' });
    }
  }
);

// ─── POST /api/finance/parse-file ────────────────────────────────────────

router.post(
  '/parse-file',
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const { originalname, mimetype, buffer } = req.file;
      const content = buffer.toString('utf-8');
      const ext = originalname.split('.').pop()?.toLowerCase();

      let parseResult;

      if (ext === 'json' || mimetype === 'application/json') {
        let data: unknown;
        try {
          data = JSON.parse(content);
        } catch {
          res.status(400).json({ error: 'Invalid JSON file' });
          return;
        }
        if (!Array.isArray(data)) {
          res.status(400).json({ error: 'JSON file must contain an array of transaction objects' });
          return;
        }
        parseResult = parseJsonArray(data);
      } else if (ext === 'txt' || mimetype === 'text/plain') {
        // Treat as free-form text — same parser as chat
        parseResult = parseMessage(content, 'file');
      } else {
        // CSV (default)
        let rows: CsvRow[];
        try {
          rows = parseCsv(content, {
            columns: true,           // use first row as headers
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
          }) as CsvRow[];
        } catch {
          res.status(400).json({ error: 'Failed to parse CSV file — check formatting' });
          return;
        }

        const entries: ParsedEntry[] = [];
        const unparsedLines: string[] = [];

        rows.forEach((row, i) => {
          const parsed = parseCsvRow(row, i);
          if (parsed) entries.push(parsed);
          else unparsedLines.push(JSON.stringify(row));
        });

        parseResult = { entries, unparsedLines, totalDetected: entries.length };
      }

      const validation = validateEntries(parseResult.entries);

      res.json({
        fileName: originalname,
        entries: parseResult.entries,
        unparsedLines: parseResult.unparsedLines,
        totalDetected: parseResult.totalDetected,
        validation: {
          valid: validation.valid.length,
          invalid: validation.invalid.length,
          needsReview: validation.needsReview.length,
          ignored: validation.ignored.length,
          errors: validation.errors,
          warnings: validation.warnings,
          duplicates: validation.duplicates,
        },
      });
    } catch (err) {
      console.error('parse-file error:', err);
      res.status(500).json({ error: 'Failed to parse file' });
    }
  }
);

// ─── POST /api/finance/validate ──────────────────────────────────────────
// Re-validates the current preview state after user edits

interface ValidateBody {
  entries: ParsedEntry[];
}

router.post(
  '/validate',
  (req: Request<object, object, ValidateBody>, res: Response) => {
    try {
      const { entries } = req.body;
      if (!Array.isArray(entries)) {
        res.status(400).json({ error: 'entries must be an array' });
        return;
      }

      const validation = validateEntries(entries);

      res.json({
        valid: validation.valid.length,
        invalid: validation.invalid.length,
        needsReview: validation.needsReview.length,
        ignored: validation.ignored.length,
        errors: validation.errors,
        warnings: validation.warnings,
        duplicates: validation.duplicates,
        validEntries: validation.valid,
        invalidEntries: validation.invalid,
        needsReviewEntries: validation.needsReview,
      });
    } catch (err) {
      console.error('validate error:', err);
      res.status(500).json({ error: 'Validation failed' });
    }
  }
);

// ─── POST /api/finance/confirm-import ───────────────────────────────────

interface ConfirmImportBody {
  entries: ParsedEntry[];
  sourceType?: 'chat' | 'file';
  fileName?: string;
}

router.post(
  '/confirm-import',
  async (req: Request<object, object, ConfirmImportBody>, res: Response) => {
    try {
      const { entries, sourceType = 'chat', fileName } = req.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'entries must be a non-empty array' });
        return;
      }

      // Run a final validation pass — reject if any hard errors remain
      const validation = validateEntries(entries);
      if (validation.errors.length > 0) {
        res.status(422).json({
          error: 'Cannot import: entries contain validation errors',
          errors: validation.errors,
        });
        return;
      }

      // Forward valid + needsReview entries (user has already reviewed them)
      const toImport = [...validation.valid, ...validation.needsReview];
      const result = await forwardConfirmedEntries(toImport);

      // Record in history
      const record: ImportHistoryRecord = {
        id: `import_${Date.now()}`,
        sourceType,
        fileName,
        importedCount:
          result.importedTransactions +
          result.importedDebts +
          result.importedCommitments,
        skippedCount: result.skipped + validation.ignored.length,
        duplicateCount: validation.duplicates.length,
        createdAt: new Date().toISOString(),
      };
      importHistory.unshift(record); // newest first
      if (importHistory.length > 100) importHistory.length = 100; // cap

      res.json({
        success: result.errors.length === 0,
        importedTransactions: result.importedTransactions,
        importedDebts: result.importedDebts,
        importedCommitments: result.importedCommitments,
        skipped: result.skipped,
        errors: result.errors,
        historyId: record.id,
      });
    } catch (err) {
      console.error('confirm-import error:', err);
      res.status(500).json({ error: 'Import failed' });
    }
  }
);

// ─── GET /api/finance/import-history ────────────────────────────────────

router.get('/import-history', (_req: Request, res: Response) => {
  res.json({ history: importHistory });
});

export { router as financeRouter };
