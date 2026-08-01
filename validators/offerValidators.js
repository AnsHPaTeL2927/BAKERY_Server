const { z } = require('zod');
const { sanitizedString, statusEnum, listQuerySchema, booleanFromForm } = require('./common');

const offerBodySchema = z.object({
  festival: sanitizedString({ min: 2, max: 120 }),
  title: sanitizedString({ min: 2, max: 200 }),
  description: sanitizedString({ min: 5, max: 2000 }),
  discount: sanitizedString({ min: 1, max: 60 }),
  ctaText: sanitizedString({ min: 1, max: 60 }),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  active: booleanFromForm,
  priority: z.coerce.number().int().optional(),
  status: statusEnum.optional(),
});

const createOfferSchema = z.object({
  body: offerBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateOfferSchema = z.object({
  body: offerBodySchema.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const listOffersSchema = z.object({
  body: z.object({}).optional(),
  query: listQuerySchema,
  params: z.object({}).optional(),
});

module.exports = { createOfferSchema, updateOfferSchema, listOffersSchema };
