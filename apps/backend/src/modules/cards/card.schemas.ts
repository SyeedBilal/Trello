import { z } from 'zod';

const prioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

export const createCardSchema = z.object({
  title: z.string().trim().min(1, 'Card title is required').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: prioritySchema.optional().default('MEDIUM'),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
});

export const updateCardSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  priority: prioritySchema.optional(),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  labels: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Provide a field to update');
