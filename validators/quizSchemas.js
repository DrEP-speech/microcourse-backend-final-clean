// validators/quizSchemas.js
import { z } from 'zod';
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const questionSchema = z.object({
  text:    z.string().min(1),
  choices: z.array(z.string().min(1)).min(2),
  correctIndex: z.number().int().min(0).optional(),
}).refine(q => q.correctIndex === undefined || q.correctIndex < q.choices.length, {
  message: 'correctIndex out of range',
});

export const quizCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  course: objectId,
  published: z.boolean().optional(),
  questions: z.array(questionSchema).optional().default([]),
});

export const quizUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  course: objectId.optional(),
  published: z.boolean().optional(),
  questions: z.array(questionSchema).optional(),
}).refine(v => Object.keys(v).length > 0, { message: 'No fields to update' });

export const quizBulkSchema = z.array(quizCreateSchema).min(1).max(50);
