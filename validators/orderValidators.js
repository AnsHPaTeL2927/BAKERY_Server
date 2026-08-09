const { z } = require('zod');
const { sanitizedString } = require('./common');

const ORDER_STATUS = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED',
];

const PAYMENT_STATUS = [
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'REFUNDED',
  'PENDING',
  'PARTIAL',
];

const ORDER_TYPE = ['PICKUP', 'DELIVERY'];

const PAYMENT_METHOD = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'];

const orderBodySchema = z.object({
  customerName: sanitizedString({ min: 2, max: 150 }),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
  productName: sanitizedString({ min: 2, max: 200 }),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  totalAmount: z.coerce.number().nonnegative('Total amount cannot be negative'),
  discount: z.coerce.number().nonnegative('Discount cannot be negative').optional().default(0),
  advancePaid: z.coerce.number().nonnegative('Advance paid cannot be negative').optional().default(0),
  orderType: z.enum(ORDER_TYPE).optional().default('PICKUP'),
  pickupDatetime: z.coerce.date(),
  status: z.enum(ORDER_STATUS).optional().default('PENDING'),
  paymentStatus: z.enum(PAYMENT_STATUS).optional().default('UNPAID'),
  paymentMethod: z.enum(PAYMENT_METHOD).optional().default('CASH'),
  address: sanitizedString({ max: 500 }).optional().or(z.literal('')),
  weight: sanitizedString({ max: 50 }).optional().or(z.literal('')),
  flavour: sanitizedString({ max: 100 }).optional().or(z.literal('')),
  notes: sanitizedString({ max: 2000 }).optional().or(z.literal('')),
});

const createOrderSchema = z.object({
  body: orderBodySchema,
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

const updateOrderSchema = z.object({
  body: orderBodySchema.partial(),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const changeStatusSchema = z.object({
  body: z.object({
    status: z.enum(ORDER_STATUS),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const changePaymentStatusSchema = z.object({
  body: z.object({
    paymentStatus: z.enum(PAYMENT_STATUS).optional(),
    paymentMethod: z.enum(PAYMENT_METHOD).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: z.coerce.number().int().positive() }),
});

const dateOnly = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const listOrdersSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(200).optional(),
    status: z.enum(ORDER_STATUS).optional(),
    paymentStatus: z.enum(PAYMENT_STATUS).optional(),
    orderType: z.enum(ORDER_TYPE).optional(),
    paymentMethod: z.enum(PAYMENT_METHOD).optional(),
    date: dateOnly.optional(),
    customerName: z.string().trim().max(150).optional(),
    phone: z.string().trim().max(20).optional(),
    product: z.string().trim().max(200).optional(),
    createdDate: dateOnly.optional(),
    minAmount: z.coerce.number().nonnegative().optional(),
    maxAmount: z.coerce.number().nonnegative().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});

module.exports = {
  createOrderSchema,
  updateOrderSchema,
  changeStatusSchema,
  changePaymentStatusSchema,
  listOrdersSchema,
  ORDER_STATUS,
  PAYMENT_STATUS,
  ORDER_TYPE,
  PAYMENT_METHOD,
};
