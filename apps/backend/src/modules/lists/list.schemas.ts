import { z } from 'zod';

export const createListSchema = z.object({
  title: z.string().trim().min(1, 'List title is required').max(100),
});

export const updateListSchema = z.object({
  title: z.string().trim().min(1, 'List title is required').max(100),
});
