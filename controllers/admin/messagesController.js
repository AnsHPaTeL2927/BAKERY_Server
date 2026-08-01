const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { logAction } = require('../../services/auditService');

const list = asyncHandler(async (req, res) => {
  const { search, status, page, pageSize } = req.query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contactMessage.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

const updateStatus = asyncHandler(async (req, res) => {
  const existing = await prisma.contactMessage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Message not found');

  const message = await prisma.contactMessage.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  await logAction({ adminId: req.admin.id, action: 'MESSAGE_STATUS_CHANGED', entityType: 'ContactMessage', entityId: message.id, meta: { status: message.status }, ip: req.ip });
  res.json({ message });
});

module.exports = { list, updateStatus };
