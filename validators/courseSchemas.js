// validators/courseSchemas.js
import { z } from 'zod';

export const courseCreateSchema = z.object({
  title: z.string().min(1, 'title is required'),
  description: z.string().optional().default(''),
  published: z.boolean().optional(),
});

export const courseUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  published: z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'No fields to update' });

export const courseBulkSchema = z.array(courseCreateSchema).min(1).max(50);
