const { z } = require('zod');
const { sanitizedString } = require('./common');

const updateSettingsSchema = z.object({
  body: z.object({
    siteName: sanitizedString({ min: 2, max: 150 }).optional(),
    tagline: sanitizedString({ max: 200 }).optional(),
    description: sanitizedString({ max: 1000 }).optional(),
    phone: z.string().trim().max(30).optional(),
    // wa.me needs the full international number, so a bare 10-digit national
    // number is rejected here rather than silently producing links that fail
    // with WhatsApp's "link is not supported". 11 digits minimum = country
    // code + number, and a leading 0 is a national trunk prefix, never part of
    // an international number.
    whatsapp: z
      .string()
      .trim()
      .regex(/^[1-9]\d{10,14}$/, 'Enter the full number with country code and no spaces or +, e.g. 918780652597')
      .optional()
      .or(z.literal('')),
    email: z.string().trim().email().optional().or(z.literal('')),
    address: sanitizedString({ max: 300 }).optional(),
    hours: sanitizedString({ max: 200 }).optional(),
    instagram: z.string().trim().url().optional().or(z.literal('')),
    facebook: z.string().trim().url().optional().or(z.literal('')),
    removeLogo: z.enum(['true', 'false']).optional(),
    removeFavicon: z.enum(['true', 'false']).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { updateSettingsSchema };
