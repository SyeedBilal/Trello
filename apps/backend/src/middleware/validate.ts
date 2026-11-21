import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/errors.js';

export const validate = (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(400, result.error.issues[0]?.message ?? 'Invalid request');
  }
  req.body = result.data;
  next();
};
