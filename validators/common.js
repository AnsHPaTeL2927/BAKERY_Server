const { z } = require('zod');
const xss = require('xss');

// Trims and strips any HTML/script payloads from free-text input before it
// ever reaches the database — defense in depth on top of React's own escaping.
function sanitizedString(options = {}) {
  let schema = z.string().trim();
  if (options.min) schema = schema.min(options.min, options.minMessage);
  if (options.max) schema = schema.max(options.max, `Must be ${options.max} characters or fewer`);
  return schema.transform((val) => xss(val));
}

const statusEnum = z.enum(['DRAFT', 'LIVE', 'HIDDEN']);

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: statusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// multipart/form-data always sends primitives as strings — these helpers coerce
// the string forms ("true"/"false", JSON-encoded arrays/objects) back to real types.
const booleanFromForm = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => val === true || val === 'true');

function jsonFromForm(innerSchema) {
  return z
    .union([z.string(), z.array(z.any()), z.record(z.any())])
    .transform((val, ctx) => {
      if (typeof val !== 'string') return val;
      try {
        return JSON.parse(val);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid JSON payload' });
        return z.NEVER;
      }
    })
    .pipe(innerSchema);
}

const statusUpdateSchema = z.object({
  body: z.object({ status: statusEnum }),
  query: z.object({}).optional(),
  params: idParamSchema,
});

const idOnlySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: idParamSchema,
});

const reorderSchema = z.object({
  body: z.object({
    order: z.array(z.coerce.number().int().positive()).min(1),
    offset: z.coerce.number().int().min(0).default(0),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

module.exports = {
  sanitizedString,
  statusEnum,
  listQuerySchema,
  idParamSchema,
  booleanFromForm,
  jsonFromForm,
  statusUpdateSchema,
  idOnlySchema,
  reorderSchema,
};
