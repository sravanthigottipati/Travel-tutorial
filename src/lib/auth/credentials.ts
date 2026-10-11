import { z } from "zod";

// Shared validation for registration and login forms/routes.
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // bcrypt only reads the first 72 bytes, and an unbounded string is a cheap
  // way to burn CPU, so cap it well below any request-size limit.
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
