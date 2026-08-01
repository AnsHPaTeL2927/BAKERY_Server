const { z } = require('zod');
const { sanitizedString, statusEnum, listQuerySchema, booleanFromForm, jsonFromForm } = require('./common');

const weightsSchema = z.array(z.string().trim().min(1)).min(1, 'Add at least one weight/size option');
const priceByWeightSchema = z.record(z.coerce.number().nonnegative());
const flavoursSchema = z.array(z.string().trim().min(1)).default([]);

const productBodySchema = z.object({
  name: sanitizedString({ min: 2, max: 150 }),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  categoryId: z.coerce.number().int().positive().optional(),
  description: sanitizedString({ min: 10, max: 4000 }),
  weights: jsonFromForm(weightsSchema),
  priceByWeight: jsonFromForm(priceByWeightSchema),
  flavours: jsonFromForm(flavoursSchema).optional(),
  featured: booleanFromForm,
  available: booleanFromForm,
  status: statusEnum.optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const createProductSchema = z.object({
  body: productBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateProductSchema = z.object({
  body: productBodySchema.partial().extend({
    removeImageIds: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        try {
          const parsed = JSON.parse(val);
          return Array.isArray(parsed) && parsed.every((n) => Number.isInteger(n));
        } catch {
          return false;
        }
      }, 'removeImageIds must be a JSON array of integers'),
    newPrimaryImageId: z.coerce.number().int().positive().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const listProductsSchema = z.object({
  body: z.object({}).optional(),
  query: listQuerySchema.extend({ categoryId: z.coerce.number().int().positive().optional() }),
  params: z.object({}).optional(),
});

module.exports = { createProductSchema, updateProductSchema, listProductsSchema };
