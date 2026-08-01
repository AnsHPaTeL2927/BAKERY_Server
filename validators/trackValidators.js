const { z } = require('zod');

const trackEventSchema = z.object({
  body: z.object({
    type: z.enum(['PAGE_VIEW', 'ORDER_CLICK', 'WHATSAPP_CLICK', 'CALL_CLICK', 'GALLERY_VIEW', 'PRODUCT_VIEW']),
    refId: z.coerce.number().int().positive().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = { trackEventSchema };
