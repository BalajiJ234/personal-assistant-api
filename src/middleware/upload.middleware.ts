/**
 * File Upload Middleware
 * Configures multer for finance file imports.
 * Accepts: .csv, .json, .txt
 * Max file size: 5 MB
 */

import multer from 'multer';
import type { Request } from 'express';

const ALLOWED_MIMETYPES = [
  'text/csv',
  'application/json',
  'text/plain',
  'text/tab-separated-values',
  // Some browsers send CSV with these types
  'application/vnd.ms-excel',
  'application/csv',
];

const ALLOWED_EXTENSIONS = ['.csv', '.json', '.txt'];

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void {
  const ext = '.' + file.originalname.split('.').pop()?.toLowerCase();
  const mimeOk = ALLOWED_MIMETYPES.includes(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.includes(ext);

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type "${file.originalname}". Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
      )
    );
  }
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter,
});
