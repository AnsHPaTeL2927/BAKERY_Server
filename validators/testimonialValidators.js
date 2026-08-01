const { z } = require('zod');
const { sanitizedString, statusEnum, listQuerySchema, booleanFromForm } = require('./common');

const testimonialBodySchema = z.object({
  name: sanitizedString({ min: 2, max: 120 }),
  review: sanitizedString({ min: 5, max: 2000 }),
  rating: z.coerce.number().int().min(1).max(5),
  approved: booleanFromForm,
  featured: booleanFromForm,
  status: statusEnum.optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const createTestimonialSchema = z.object({
  body: testimonialBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateTestimonialSchema = z.object({
  body: testimonialBodySchema.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const listTestimonialsSchema = z.object({
  body: z.object({}).optional(),
  query: listQuerySchema,
  params: z.object({}).optional(),
});

module.exports = { createTestimonialSchema, updateTestimonialSchema, listTestimonialsSchema };
