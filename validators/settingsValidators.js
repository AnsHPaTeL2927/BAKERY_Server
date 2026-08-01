const { z } = require('zod');
const { sanitizedString } = require('./common');

const updateSettingsSchema = z.object({
  body: z.object({
    siteName: sanitizedString({ min: 2, max: 150 }).optional(),
    tagline: sanitizedString({ max: 200 }).optional(),
    description: sanitizedString({ max: 1000 }).optional(),
    phone: z.string().trim().max(30).optional(),
    whatsapp: z.string().trim().regex(/^\d{10,15}$/, 'Use digits only, with country code').optional(),
    email: z.string().trim().email().optional(),
    address: sanitizedString({ max: 300 }).optional(),
    hours: sanitizedString({ max: 200 }).optional(),
    instagram: z.string().trim().url().optional().or(z.literal('')),
    facebook: z.string().trim().url().optional().or(z.literal('')),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { updateSettingsSchema };
