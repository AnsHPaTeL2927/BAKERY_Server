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

module.exports = { loginSchema, verifyOtpSchema };
