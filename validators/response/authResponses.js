import { z } from 'zod';

export const AuthUserSchema = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errors: z.array(z.object({
    path: z.string().optional(),
    message: z.string(),
  })).optional(),
});

export const SignupResponseSchema = z.object({
  success: z.literal(true),
  user: AuthUserSchema,
});

export const LoginResponseSchema = z.object({
  success: z.literal(true),
  user: AuthUserSchema,
});

export const MeResponseSchema = z.object({
  success: z.literal(true),
  user: AuthUserSchema,
});

export const RefreshResponseSchema = z.object({
  success: z.literal(true),
  // you may choose not to return the token; cookies are source of truth.
  accessToken: z.string().optional(),
});
