import type { Request } from 'express';
import { AppError } from './errors.js';

export function requiredParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== 'string' || value.length === 0) throw new AppError(400, `Missing ${name}`);
  return value;
}
