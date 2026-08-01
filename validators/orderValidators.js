const { z } = require('zod');
const { sanitizedString } = require('./common');

const ORDER_STATUS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED'];
const PAYMENT_STATUS = ['PENDING', 'PARTIAL', 'PAID'];
const ORDER_TYPE = ['PICKUP', 'DELIVERY'];

const orderBodySchema = z.object({
  customerName: sanitizedString({ min: 2, max: 150 }),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
  productName: sanitizedString({ min: 2, max: 200 }),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  totalAmount: z.coerce.number().nonnegative('Total amount cannot be negative'),
  advancePaid: z.coerce.number().nonnegative('Advance paid cannot be negative').optional().default(0),
  orderType: z.enum(ORDER_TYPE).optional().default('PICKUP'),
  pickupDatetime: z.coerce.date(),
  status: z.enum(ORDER_STATUS).optional().default('PENDING'),
  paymentStatus: z.enum(PAYMENT_STATUS).optional().default('PENDING'),
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

const listOrdersSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    search: z.string().trim().max(200).optional(),
    status: z.enum(ORDER_STATUS).optional(),
    paymentStatus: z.enum(PAYMENT_STATUS).optional(),
    date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
  params: z.object({}).optional(),
});

module.exports = { createOrderSchema, updateOrderSchema, listOrdersSchema, ORDER_STATUS, PAYMENT_STATUS, ORDER_TYPE };
