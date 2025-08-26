import { z } from "zod";

const emailField = z.string().trim().min(1,"Email is required").email("Valid email required").transform(v=>v.toLowerCase());
const passwordField = z.string().min(8,"Min 8 characters").max(256,"Password too long");
const nameField = z.string().trim().min(1,"Name is required").max(120,"Name too long");

export const signupSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  locale: z.string().trim().max(32).optional(),
  timezone: z.string().trim().max(64).optional(),
  termsAccepted: z.boolean().optional(),
}).strict().refine(d => d.termsAccepted !== false, { path: ["termsAccepted"], message: "You must accept the terms" });

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
}).strict();

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken required"),
}).strict();

export const userPublicShape = z.object({
  _id: z.string(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["student","instructor","admin"]).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
}).strict();