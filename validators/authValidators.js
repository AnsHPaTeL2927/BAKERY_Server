const { z } = require('zod');

const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    password: z.string().min(1, 'Password is required'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const verifyOtpSchema = z.object({
  body: z.object({
    otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const resetPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { loginSchema, verifyOtpSchema, forgotPasswordSchema, resetPasswordSchema };
