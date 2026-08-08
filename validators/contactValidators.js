const { z } = require('zod');
const { sanitizedString, listQuerySchema } = require('./common');

const createContactMessageSchema = z.object({
  body: z.object({
    name: sanitizedString({ min: 2, max: 120 }),
    email: z.string().trim().email('Enter a valid email'),
    phone: z.string().trim().max(30).optional(),
    message: sanitizedString({ min: 5, max: 2000 }),
    source: z.enum(['CONTACT', 'CUSTOM_CAKE']).optional().default('CONTACT'),
    occasion: sanitizedString({ max: 100 }).optional(),
    cakeWeight: sanitizedString({ max: 50 }).optional(),
    deliveryDate: z.coerce.date().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const listContactMessagesSchema = z.object({
  body: z.object({}).optional(),
  query: listQuerySchema.omit({ status: true }).extend({
    status: z.enum(['NEW', 'READ', 'ARCHIVED']).optional(),
  }),
  params: z.object({}).optional(),
});

const updateContactMessageSchema = z.object({
  body: z.object({ status: z.enum(['NEW', 'READ', 'ARCHIVED']) }),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

module.exports = { createContactMessageSchema, listContactMessagesSchema, updateContactMessageSchema };
