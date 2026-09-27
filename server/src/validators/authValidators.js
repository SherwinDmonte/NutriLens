import { z } from 'zod';

const emailSchema = z
  .string({ error: 'Email is required.' })
  .trim()
  .min(1, 'Email is required.')
  .max(254, 'Email cannot exceed 254 characters.')
  .email('Enter a valid email address.')
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string({ error: 'Password is required.' })
  .min(10, 'Password must contain at least 10 characters.')
  .max(128, 'Password cannot exceed 128 characters.');

export const registerSchema = z
  .object({
    name: z
      .string({ error: 'Name is required.' })
      .trim()
      .min(2, 'Name must contain at least 2 characters.')
      .max(80, 'Name cannot exceed 80 characters.'),
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
  })
  .strict();
