const { z } = require('zod');
const { sanitizedString, statusEnum, listQuerySchema } = require('./common');

const bannerBodySchema = z.object({
  title: sanitizedString({ max: 200 }).optional(),
  subtitle: sanitizedString({ max: 300 }).optional(),
  ctaText: sanitizedString({ max: 60 }).optional(),
  ctaLink: z.string().trim().max(300).optional(),
  status: statusEnum.optional(),
  priority: z.coerce.number().int().optional(),
});

const createBannerSchema = z.object({
  body: bannerBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateBannerSchema = z.object({
  body: bannerBodySchema.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const listBannersSchema = z.object({
  body: z.object({}).optional(),
  query: listQuerySchema,
  params: z.object({}).optional(),
});

module.exports = { createBannerSchema, updateBannerSchema, listBannersSchema };
