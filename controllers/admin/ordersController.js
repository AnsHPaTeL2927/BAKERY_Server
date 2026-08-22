const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { logAction } = require('../../services/auditService');
const fs = require('fs');
const { generateInvoice, toInvoiceNumber, invoiceFilePath } = require('../../services/invoiceService');

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
    ...(order.items
      ? {
          items: order.items.map((it) => ({
            ...it,
            unitPrice: Number(it.unitPrice),
            lineTotal: Number(it.lineTotal),
          })),
        }
      : {}),
  };
}

function dayRange(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

// Multi-item support: an order's real product data now lives in `items`
// (one row per product). `productName`/`quantity`/`weight`/`flavour` on the
// Order itself are kept as a legacy mirror/summary — auto-derived here so
// every existing display that reads those fields directly (desktop table,
// invoice fallback, audit log) keeps working unchanged, with zero knowledge
// that multi-item orders exist.
function itemLineTotal(item) {
  return Number(item.unitPrice) * Number(item.quantity);
}

function summarizeItems(items) {
  if (!items || items.length === 0) return null;
  const totalQty = items.reduce((sum, it) => sum + Number(it.quantity), 0);
  const totalAmount = items.reduce((sum, it) => sum + itemLineTotal(it), 0);
  const first = items[0];
  return {
    productName: items.length === 1 ? first.productName : `${first.productName} +${items.length - 1} more`,
    quantity: totalQty,
    totalAmount,
    weight: first.weight || null,
    flavour: first.flavour || null,
  };
}

function itemsNestedWrite(items) {
  return items.map((it, idx) => ({
    productName: it.productName,
    weight: it.weight || null,
    flavour: it.flavour || null,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
    lineTotal: itemLineTotal(it),
    note: it.note || null,
    sortOrder: idx,
  }));
}

const ORDER_INCLUDE = { items: { orderBy: { sortOrder: 'asc' } } };

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
    sort,
  } = req.query;

  const dbStatus = status ? toDbOrderStatus(status) : undefined;
  const dbPaymentStatus = paymentStatus ? toDbPaymentStatus(paymentStatus) : undefined;

  const amountRange = {
    ...(minAmount !== undefined ? { gte: minAmount } : {}),
    ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
  };

  // Built as an AND-array of independent conditions (rather than merging
  // multiple `{ OR: [...] }` blocks into one object) specifically so the
  // `product` filter and the free-text `search` filter — both of which need
  // their own OR clause — can coexist without one silently overwriting the
  // other's `OR` key when spread into the same object.
  const and = [
    ...(dbStatus ? [{ status: dbStatus }] : []),
    ...(dbPaymentStatus ? [{ paymentStatus: dbPaymentStatus }] : []),
    ...(orderType ? [{ orderType }] : []),
    ...(date ? [{ pickupDatetime: dayRange(date) }] : []),
    ...(createdDate ? [{ createdAt: dayRange(createdDate) }] : []),
    ...(customerName ? [{ customerName: { contains: customerName } }] : []),
    ...(phone ? [{ phone: { contains: phone } }] : []),
    ...(product
      ? [{ OR: [{ productName: { contains: product } }, { items: { some: { productName: { contains: product } } } }] }]
      : []),
    ...(Object.keys(amountRange).length ? [{ totalAmount: amountRange }] : []),
    ...(search
      ? [
          {
            OR: [
              { customerName: { contains: search } },
              { phone: { contains: search } },
              { orderNumber: { contains: search } },
              { productName: { contains: search } },
              { items: { some: { productName: { contains: search } } } },
            ],
          },
        ]
      : []),
  ];
  const where = and.length > 0 ? { AND: and } : {};

  const orderBy = sort === 'oldest' || sort === 'asc'
    ? [{ createdAt: 'asc' }, { id: 'asc' }]
    : [{ createdAt: 'desc' }, { id: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: ORDER_INCLUDE,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ items: items.map(serializeOrder), total, page, pageSize });
});

const create = asyncHandler(async (req, res) => {
  const { totalAmount, discount, advancePaid, status, paymentStatus, paymentMethod, orderNumber: _ignored, items, ...rest } = req.body;

  const summary = summarizeItems(items);
  const finalTotalAmount = summary ? summary.totalAmount : totalAmount;
  const finalDiscount = discount || 0;
  const finalAdvancePaid = advancePaid || 0;
  const remainingAmount = finalTotalAmount - finalDiscount - finalAdvancePaid;
  if (remainingAmount < 0) {
    throw new ApiError(422, 'Discount and advance paid cannot exceed the total amount');
  }

  const count = await prisma.order.count();
  const generatedOrderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;

  const payload = {
    ...rest,
    ...(summary
      ? { productName: summary.productName, quantity: summary.quantity, weight: summary.weight, flavour: summary.flavour }
      : {}),
    totalAmount: finalTotalAmount,
    discount: finalDiscount,
    advancePaid: finalAdvancePaid,
    orderNumber: generatedOrderNumber,
    remainingAmount,
    status: toDbOrderStatus(status),
    paymentStatus: toDbPaymentStatus(paymentStatus),
    ...(items && items.length > 0 ? { items: { create: itemsNestedWrite(items) } } : {}),
  };

  const order = await prisma.order.create({
    data: payload,
    include: ORDER_INCLUDE,
  });

  await logAction({ adminId: req.admin.id, action: 'ORDER_CREATED', entityType: 'Order', entityId: order.id, ip: req.ip });
  res.status(201).json({ order: serializeOrder(order) });
});


const update = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.id);
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new ApiError(404, 'Order not found');

  const { status, paymentStatus, paymentMethod, orderNumber: _ignored, items, ...rest } = req.body;

  const summary = items ? summarizeItems(items) : null;
  const totalAmount = summary ? summary.totalAmount : (req.body.totalAmount ?? Number(existing.totalAmount));
  const discount = req.body.discount ?? Number(existing.discount);
  const advancePaid = req.body.advancePaid ?? Number(existing.advancePaid);
  const remainingAmount = totalAmount - discount - advancePaid;
  if (remainingAmount < 0) {
    throw new ApiError(422, 'Discount and advance paid cannot exceed the total amount');
  }

  const payload = {
    ...rest,
    ...(summary
      ? { productName: summary.productName, quantity: summary.quantity, weight: summary.weight, flavour: summary.flavour }
      : {}),
    totalAmount,
    remainingAmount,
    ...(status ? { status: toDbOrderStatus(status) } : {}),
    ...(paymentStatus ? { paymentStatus: toDbPaymentStatus(paymentStatus) } : {}),
    // Full replace, not a diff/merge — simplest correct semantics for a
    // repeatable item list edited as a whole in one form submission.
    ...(items ? { items: { deleteMany: {}, create: itemsNestedWrite(items) } } : {}),
  };

  const order = await prisma.order.update({
    where: { id: orderId },
    data: payload,
    include: ORDER_INCLUDE,
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
    include: ORDER_INCLUDE,
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
    include: ORDER_INCLUDE,
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

// The stored value is a relative, host-independent API path — never an
// absolute URL built from request headers (an attacker-supplied
// X-Forwarded-Host would otherwise be persisted and later handed to staff as a
// clickable link). The frontend resolves it against its own API base.
function invoiceApiPath(orderId) {
  return `/api/admin/orders/${orderId}/invoice`;
}

async function buildInvoice(order) {
  const settings = await prisma.websiteSettings.findUnique({ where: { id: 1 } });
  return generateInvoice(serializeOrder(order), settings);
}

const generateInvoiceHandler = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const existing = await prisma.order.findUnique({ where: { id: Number(id) }, include: ORDER_INCLUDE });
  if (!existing) throw new ApiError(404, 'Order not found');

  await buildInvoice(existing);

  const updated = await prisma.order.update({
    where: { id: Number(id) },
    include: ORDER_INCLUDE,
    data: {
      invoicePath: invoiceApiPath(existing.id),
      invoiceGeneratedAt: new Date(),
    },
  });

  res.json({ order: serializeOrder(updated), invoicePath: updated.invoicePath });
});

// Invoices are PII, so the PDF is streamed from private storage behind
// requireAdminAuth rather than being served as a static file. Regenerates on
// the fly when the file is missing (older order, cleared disk on a
// redeploy — free hosts do not keep an ephemeral filesystem between deploys).
const downloadInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await prisma.order.findUnique({ where: { id: Number(id) }, include: ORDER_INCLUDE });
  if (!order) throw new ApiError(404, 'Order not found');

  let filePath = invoiceFilePath(order.orderNumber);
  if (!fs.existsSync(filePath)) {
    filePath = await buildInvoice(order);
    await prisma.order.update({
      where: { id: order.id },
      data: { invoicePath: invoiceApiPath(order.id), invoiceGeneratedAt: new Date() },
    });
  }

  const filename = `${toInvoiceNumber(order.orderNumber)}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(filePath).pipe(res);
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
  downloadInvoice,
  getTimeline,
};
