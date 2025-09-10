import { z } from "zod";

/**
 * Shared primitives
 */
const Email = z.string().trim().toLowerCase().email("Invalid email");
const Password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long");

const Name = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name too long");

/**
 * SignupSchema
 * Body: { name, email, password }
 * (add fields later as needed, e.g. locale, timezone, termsAccepted, etc.)
 */
export const SignupSchema = z
  .object({
    name: Name,
    email: Email,
    password: Password,
  })
  .strict();

/**
 * LoginSchema
 * Body: { email, password }
 */
export const LoginSchema = z
  .object({
    email: Email,
    password: Password,
  })
  .strict();

// Optional: export a map if you like referencing by name elsewhere
export const AuthSchemas = {
  SignupSchema,
  LoginSchema,
};

export default AuthSchemas;
