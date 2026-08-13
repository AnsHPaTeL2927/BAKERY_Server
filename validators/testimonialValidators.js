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
  query: listQuerySchema.extend({
    // Moderation filter: 'pending' surfaces visitor-submitted reviews that
    // still need a decision, 'approved' the ones already cleared.
    approval: z.enum(['pending', 'approved']).optional(),
  }),
  params: z.object({}).optional(),
});

const approvalUpdateSchema = z.object({
  body: z.object({ approved: z.union([z.boolean(), z.string()]).transform((val) => val === true || val === 'true') }),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

// Visitor-submitted reviews. Deliberately narrower than the admin schema —
// the public can only supply the three fields below; `approved`, `status`,
// `featured`, `sortOrder` and `photo` are never accepted from the browser and
// are set server-side (see controllers/public/reviewsController.js).
const createPublicReviewSchema = z.object({
  body: z.object({
    name: sanitizedString({ min: 2, max: 120 }),
    review: sanitizedString({ min: 10, max: 1500 }),
    rating: z.coerce.number().int().min(1).max(5),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = {
  createTestimonialSchema,
  updateTestimonialSchema,
  listTestimonialsSchema,
  approvalUpdateSchema,
  createPublicReviewSchema,
};
