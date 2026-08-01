const { z } = require('zod');
const { sanitizedString, statusEnum, listQuerySchema } = require('./common');

const categoryBodySchema = z.object({
  name: sanitizedString({ min: 2, max: 120 }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  status: statusEnum.optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const createCategorySchema = z.object({
  body: categoryBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateCategorySchema = z.object({
  body: categoryBodySchema.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const listCategoriesSchema = z.object({
  body: z.object({}).optional(),
  query: listQuerySchema,
  params: z.object({}).optional(),
});

module.exports = { createCategorySchema, updateCategorySchema, listCategoriesSchema };
