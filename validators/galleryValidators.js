const { z } = require('zod');
const { sanitizedString, statusEnum, listQuerySchema } = require('./common');

const galleryBodySchema = z.object({
  alt: sanitizedString({ max: 200 }).optional(),
  category: sanitizedString({ max: 100 }).optional(),
  status: statusEnum.optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const createGallerySchema = z.object({
  body: galleryBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateGallerySchema = z.object({
  body: galleryBodySchema.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const listGallerySchema = z.object({
  body: z.object({}).optional(),
  query: listQuerySchema,
  params: z.object({}).optional(),
});

module.exports = { createGallerySchema, updateGallerySchema, listGallerySchema };
