const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { logAction } = require('../../services/auditService');
const { generateInvoice, toInvoiceNumber } = require('../../services/invoiceService');
const { resolveBaseUrl } = require('../../middleware/absolutizeUploads');

function serializeOrder(order) {
  return {
    ...order,
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
  const { search, status, paymentStatus, date, customerName, phone, product, createdDate, minAmount, maxAmount, page, pageSize } =
    req.query;
  const amountRange = {
    ...(minAmount !== undefined ? { gte: minAmount } : {}),
    ...(maxAmount !== undefined ? { lte: maxAmount } : {}),
  };
  const where = {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
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
  const { totalAmount, discount, advancePaid } = req.body;
  const remainingAmount = totalAmount - (discount || 0) - (advancePaid || 0);
  if (remainingAmount < 0) {
    throw new ApiError(422, 'Discount and advance paid cannot exceed the total amount');
  }

  const count = await prisma.order.count();
  const orderNumber = `ORD-${String(count + 1).padStart(4, '0')}`;

  const order = await prisma.order.create({
    data: { ...req.body, orderNumber, remainingAmount },
  });

  await logAction({ adminId: req.admin.id, action: 'ORDER_CREATED', entityType: 'Order', entityId: order.id, ip: req.ip });
  res.status(201).json({ order: serializeOrder(order) });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Order not found');

  const totalAmount = req.body.totalAmount ?? Number(existing.totalAmount);
  const discount = req.body.discount ?? Number(existing.discount);
  const advancePaid = req.body.advancePaid ?? Number(existing.advancePaid);
  const remainingAmount = totalAmount - discount - advancePaid;
  if (remainingAmount < 0) {
    throw new ApiError(422, 'Discount and advance paid cannot exceed the total amount');
  }

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { ...req.body, remainingAmount },
  });

  await logAction({ adminId: req.admin.id, action: 'ORDER_UPDATED', entityType: 'Order', entityId: order.id, ip: req.ip });
  res.json({ order: serializeOrder(order) });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Order not found');

  await prisma.order.delete({ where: { id: req.params.id } });

  await logAction({ adminId: req.admin.id, action: 'ORDER_DELETED', entityType: 'Order', entityId: existing.id, ip: req.ip });
  res.json({ ok: true });
});

const generateInvoicePdf = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) throw new ApiError(404, 'Order not found');

  const settings = await prisma.websiteSettings.findUnique({ where: { id: 1 } });
  // Filename is deterministic from the order's own orderNumber, so the QR's
  // target URL can be computed before the file is even written.
  const publicUrl = `${resolveBaseUrl(req)}/uploads/invoices/${toInvoiceNumber(order.orderNumber)}.pdf`;
  const invoicePath = await generateInvoice(order, settings, publicUrl);

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: { invoicePath, invoiceGeneratedAt: new Date() },
  });

  await logAction({ adminId: req.admin.id, action: 'INVOICE_GENERATED', entityType: 'Order', entityId: order.id, ip: req.ip });
  res.json({ order: serializeOrder(updated) });
});

const getTimeline = asyncHandler(async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order) throw new ApiError(404, 'Order not found');

  const events = await prisma.auditLog.findMany({
    where: { entityType: 'Order', entityId: req.params.id },
    orderBy: { createdAt: 'asc' },
    include: { admin: { select: { name: true } } },
  });

  res.json({
    events: events.map((e) => ({
      id: e.id,
      action: e.action,
      adminName: e.admin?.name || 'System',
      createdAt: e.createdAt,
    })),
  });
});

module.exports = { list, create, update, remove, generateInvoicePdf, getTimeline };
