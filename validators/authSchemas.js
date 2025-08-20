// validators/authSchemas.js
// ESM. Strong, future-proof payload validation for auth endpoints.

import { z } from 'zod';

/* ---------------- Password policy knobs (env-tunable) ---------------- */
const MIN_LEN = Number(process.env.PASSWORD_MIN_LENGTH || 8);
const MAX_LEN = Number(process.env.PASSWORD_MAX_LENGTH || 72);
const REQUIRE_COMPLEXITY = (process.env.PASSWORD_REQUIRE_COMPLEXITY || 'false') === 'true';
const COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

/* ---------------- Shared primitives & helpers ---------------- */
const trim = (s) => (typeof s === 'string' ? s.trim() : s);

const emailSchema = z
  .string({ required_error: 'Email is required' })
  .email('Valid email required')
  .transform((v) => trim(v).toLowerCase());

const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(MIN_LEN, `Minimum ${MIN_LEN} characters`)
  .max(MAX_LEN, `Maximum ${MAX_LEN} characters`)
  .superRefine((val, ctx) => {
    if (REQUIRE_COMPLEXITY && !COMPLEXITY.test(val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Must include upper, lower, number, and symbol',
      });
    }
  });

/* ---------------- Signup ----------------
   Designed to be forward-compatible with invites, SSO flags, captcha, etc.
*/
export const signupSchema = z
  .object({
    name: z
      .string({ required_error: 'Name is required' })
      .min(1, 'Name is required')
      .max(100, 'Name is too long')
      .transform((v) => trim(v)),
    email: emailSchema,
    password: passwordSchema,

    // Optional knobs you can start using later without breaking clients:
    inviteCode: z.string().trim().max(64).optional(),
    captchaToken: z.string().trim().max(2048).optional(), // turn on when captcha is enabled
    // “remember me” hints how long you keep refresh token
    rememberMe: z.boolean().optional(),

    // Soft metadata for analytics or personalization
    locale: z.string().trim().max(16).optional(),
    timezone: z.string().trim().max(64).optional(),

    // If you require explicit terms at signup later:
    termsAccepted: z.boolean().optional(),
  })
  .strict('Unexpected fields in signup payload');

/* ---------------- Login ----------------
   Supports either classic email+password, or username/identifier if you add it later.
*/
export const loginSchema = z
  .object({
    // keep email primary
    email: emailSchema.optional(),
    // optional alt identifier for future username login
    identifier: z.string().trim().min(1).max(254).optional(),
    password: passwordSchema,
    rememberMe: z.boolean().optional(),
    captchaToken: z.string().trim().max(2048).optional(),
  })
  .refine(
    (v) => !!v.email || !!v.identifier,
    { message: 'Provide email or identifier', path: ['email'] }
  )
  .transform((v) => {
    // normalize: if identifier is an email, move it to email
    if (!v.email && v.identifier && /^[^@]+@[^@]+\.[^@]+$/.test(v.identifier)) {
      v.email = v.identifier.toLowerCase();
    }
    return v;
  })
  .strict('Unexpected fields in login payload');

/* ------------- Types (optional, for editor intellisense) ------------- */
/** @typedef {z.infer<typeof signupSchema>} SignupBody */
/** @typedef {z.infer<typeof loginSchema>}  LoginBody  */
