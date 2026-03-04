import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../AppError';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  // Zod validation errors → 400 with field-level details
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      code: 400,
      message: 'Validation failed',
      details,
    });
  }

  // Known application errors with a statusCode
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.statusCode,
      message: err.message,
      details: err.details ?? null,
    });
  }

  // Unknown errors → 500
  // eslint-disable-next-line no-console
  console.error('Unexpected error:', err);
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  return res.status(500).json({
    code: 500,
    message,
    details: null,
  });
}
