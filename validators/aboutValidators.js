const { z } = require('zod');
const { sanitizedString } = require('./common');

const updateAboutSchema = z.object({
  body: z.object({
    chefHeading: sanitizedString({ max: 100 }).optional(),
    chefName: sanitizedString({ max: 100 }).optional(),
    chefBio: sanitizedString({ max: 3000 }).optional(),
    image1Alt: sanitizedString({ max: 200 }).optional(),
    image2Alt: sanitizedString({ max: 200 }).optional(),
    image3Alt: sanitizedString({ max: 200 }).optional(),
    remove_chefPhoto: z.enum(['true', 'false']).optional(),
    remove_image1: z.enum(['true', 'false']).optional(),
    remove_image2: z.enum(['true', 'false']).optional(),
    remove_image3: z.enum(['true', 'false']).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { updateAboutSchema };
