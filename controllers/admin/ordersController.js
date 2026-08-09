const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { logAction } = require('../../services/auditService');
const { generateInvoice, toInvoiceNumber } = require('../../services/invoiceService');
const { resolveBaseUrl } = require('../../middleware/absolutizeUploads');

// Maps UI/API payment status labels -> DB enum values
// PaymentStatus enum in schema: UNPAID | PARTIALLY_PAID | PAID | REFUNDED | PENDING | PARTIAL
function toDbPaymentStatus(status) {
  if (!status) return 'UNPAID';
  const s = String(status).toUpperCase();
  if (s === 'UNPAID' || s === 'PENDING') return 'UNPAID';
  if (s === 'PARTIALLY_PAID' || s === 'PARTIAL') return 'PARTIALLY_PAID';
  if (s === 'PAID') return 'PAID';
  if (s === 'REFUNDED') return 'REFUNDED';
  return 'UNPAID';
}

function fromDbPaymentStatus(status) {
  if (!status) return 'UNPAID';
  const s = String(status).toUpperCase();
  if (s === 'PENDING' || s === 'UNPAID') return 'UNPAID';
  if (s === 'PARTIAL' || s === 'PARTIALLY_PAID') return 'PARTIALLY_PAID';
  return s;
}

function toDbOrderStatus(status) {
  if (!status) return 'PENDING';
  return status;
}

function fromDbOrderStatus(status) {
  if (!status) return 'PENDING';
  return status;
}

function serializeOrder(order) {
  if (!order) return order;
  return {
    ...order,
    paymentMethod: order.paymentMethod || 'CASH',
    status: fromDbOrderStatus(order.status),
    paymentStatus: fromDbPaymentStatus(order.paymentStatus),
    totalAmount: Number(order.totalAmount),
    discount: Number(order.discount),
    advancePaid: Number(order.advancePaid),
    remainingAmount: Number(order.remainingAmount),
  };
}

function dayRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

const list = asyncHandler(async (req, res) => {
  const {
    search,
    status,
    paymentStatus,
    orderType,
    paymentMethod,
    date,
    customerName,
    phone,
    product,
    createdDate,
    minAmount,
    maxAmount,
    page,
    pageSize,
  } = req.query;

  const dbStatus = status ? toDbOrderStatus(status) : undefined;
  const dbPaymentStatus = paymentStatus ? toDbPaymentStatus(paymentStatus) : undefined;

  const amountRange = {
    ...(minAmount !== undefined ? { gte: minAmount } : {}),
    ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
  };
  const where = {
    ...(dbStatus ? { status: dbStatus } : {}),
    ...(dbPaymentStatus ? { paymentStatus: dbPaymentStatus } : {}),
    ...(orderType ? { orderType } : {}),
    ...(date ? { pickupDatetime: dayRange(date) } : {}),
    ...(createdDate ? { createdAt: dayRange(createdDate) } : {}),
    ...(customerName ? { customerName: { contains: customerName } } : {}),
    ...(phone ? { phone: { contains: phone } } : {}),
    ...(product ? { productName: { contains: product } } : {}),
    ...(Object.keys(amountRange).length ? { totalAmount: amountRange } : {}),
    ...(search
      ? {
          OR: [
            { customerName: { contains: search } },
            { phone: { contains: search } },
            { orderNumber: { contains: search } },
            { productName: { contains: search } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { pickupDatetime: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ items: items.map(serializeOrder), total, page, pageSize });
});

const create = asyncHandler(async (req, res) => {
  const { totalAmount, discount, advancePaid, status, paymentStatus, paymentMethod, orderNumber: _ignored, ...rest } = req.body;
  const remainingAmount = totalAmount - (discount || 0) - (advancePaid || 0);
  if (remainingAmount < 0) {
    throw new ApiError(422, 'Discount and advance paid cannot exceed the total amount');
  }

  const count = await prisma.order.count();
  const generatedOrderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;

  const payload = {
    ...rest,
    totalAmount,
    discount: discount || 0,
    advancePaid: advancePaid || 0,
    orderNumber: generatedOrderNumber,
    remainingAmount,
    status: toDbOrderStatus(status),
    paymentStatus: toDbPaymentStatus(paymentStatus),
  };

  const order = await prisma.order.create({
    data: payload,
  });

  await logAction({ adminId: req.admin.id, action: 'ORDER_CREATED', entityType: 'Order', entityId: order.id, ip: req.ip });
  res.status(201).json({ order: serializeOrder(order) });
});


const update = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new ApiError(404, 'Order not found');

  const { status, paymentStatus, paymentMethod, orderNumber: _ignored, ...rest } = req.body;
  const totalAmount = req.body.totalAmount ?? Number(existing.totalAmount);
  const discount = req.body.discount ?? Number(existing.discount);
  const advancePaid = req.body.advancePaid ?? Number(existing.advancePaid);
  const remainingAmount = totalAmount - discount - advancePaid;
  if (remainingAmount < 0) {
    throw new ApiError(422, 'Discount and advance paid cannot exceed the total amount');
  }

  const payload = {
    ...rest,
    remainingAmount,
    ...(status ? { status: toDbOrderStatus(status) } : {}),
    ...(paymentStatus ? { paymentStatus: toDbPaymentStatus(paymentStatus) } : {}),
  };

  const order = await prisma.order.update({
    where: { id: orderId },
    data: payload,
  });

  await logAction({ adminId: req.admin.id, action: 'ORDER_UPDATED', entityType: 'Order', entityId: order.id, ip: req.ip });
  res.json({ order: serializeOrder(order) });
});


const VALID_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: (orderType) => (orderType === 'DELIVERY' ? ['OUT_FOR_DELIVERY', 'COMPLETED', 'DELIVERED', 'CANCELLED'] : ['COMPLETED', 'DELIVERED', 'CANCELLED']),
  OUT_FOR_DELIVERY: ['COMPLETED', 'DELIVERED', 'CANCELLED'],
  COMPLETED: [],
  DELIVERED: [],
  CANCELLED: [],
};

function isTransitionAllowed(currentStatus, newStatus, orderType) {
  const normCurrent = fromDbOrderStatus(currentStatus);
  const normNew = fromDbOrderStatus(newStatus);
  if (normCurrent === normNew) return true;
  const allowed = VALID_TRANSITIONS[normCurrent] || VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  const list = typeof allowed === 'function' ? allowed(orderType) : allowed;
  return list.includes(normNew) || list.includes(newStatus);
}

const updateStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const existing = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new ApiError(404, 'Order not found');

  if (!isTransitionAllowed(existing.status, status, existing.orderType)) {
    throw new ApiError(422, `Invalid status transition from ${fromDbOrderStatus(existing.status)} to ${status}`);
  }

  const order = await prisma.order.update({
    where: { id: Number(id) },
    data: { status: toDbOrderStatus(status) },
  });

  await logAction({
    adminId: req.admin.id,
    action: 'ORDER_STATUS_CHANGED',
    entityType: 'Order',
    entityId: order.id,
    meta: { from: existing.status, to: order.status },
    ip: req.ip,
  });

  res.json({ order: serializeOrder(order) });
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentStatus } = req.body;

  const existing = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new ApiError(404, 'Order not found');

  const order = await prisma.order.update({
    where: { id: Number(id) },
    data: { paymentStatus: toDbPaymentStatus(paymentStatus) },
  });

  await logAction({
    adminId: req.admin.id,
    action: 'ORDER_PAYMENT_STATUS_CHANGED',
    entityType: 'Order',
    entityId: order.id,
    meta: { from: existing.paymentStatus, to: order.paymentStatus },
    ip: req.ip,
  });

  res.json({ order: serializeOrder(order) });
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new ApiError(404, 'Order not found');

  await prisma.order.delete({ where: { id: Number(id) } });
  await logAction({ adminId: req.admin.id, action: 'ORDER_DELETED', entityType: 'Order', entityId: Number(id), ip: req.ip });

  res.json({ success: true, message: 'Order deleted successfully' });
});

const generateInvoiceHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.order.findUnique({ where: { id: Number(id) } });
  if (!existing) throw new ApiError(404, 'Order not found');

  const serial = serializeOrder(existing);
  const pdfPath = await generateInvoice(serial);
  const relativePath = `/uploads/invoices/${pdfPath.split('/invoices/')[1] || pdfPath.split('\\invoices\\')[1]}`;
  const fullUrl = resolveBaseUrl(req, relativePath);

  const updated = await prisma.order.update({
    where: { id: Number(id) },
    data: {
      invoicePath: fullUrl,
      invoiceGeneratedAt: new Date(),
    },
  });

  res.json({ order: serializeOrder(updated), invoicePath: fullUrl });
});

const getTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const events = await prisma.auditLog.findMany({
    where: { entityType: 'Order', entityId: Number(id) },
    orderBy: { createdAt: 'desc' },
    include: { admin: { select: { name: true, email: true } } },
  });

  res.json({
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      adminName: e.admin?.name || 'System',
      adminEmail: e.admin?.email || '',
      meta: e.meta,
      createdAt: e.createdAt,
    })),
  });
});

module.exports = {
  list,
  create,
  update,
  updateStatus,
  updatePaymentStatus,
  remove,
  generateInvoice: generateInvoiceHandler,
  generateInvoicePdf: generateInvoiceHandler,
  getTimeline,
};
