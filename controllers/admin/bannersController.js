const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');
const { applyOrder } = require('../../services/reorderService');

const list = asyncHandler(async (req, res) => {
  const { search, status, page, pageSize } = req.query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { title: { contains: search } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.heroBanner.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.heroBanner.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

const create = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'A banner image is required');

  const image = await saveProcessedImage(req.file.buffer, 'hero');
  const priority = req.body.priority ?? (await prisma.heroBanner.count());
  const banner = await prisma.heroBanner.create({ data: { ...req.body, image, priority } });

  await logAction({ adminId: req.admin.id, action: 'BANNER_CREATED', entityType: 'HeroBanner', entityId: banner.id, ip: req.ip });
  res.status(201).json({ banner });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.heroBanner.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Banner not found');

  let image = existing.image;
  if (req.file) {
    image = await saveProcessedImage(req.file.buffer, 'hero');
    await deleteImageByUrl(existing.image);
  }

  const banner = await prisma.heroBanner.update({ where: { id: req.params.id }, data: { ...req.body, image } });

  await logAction({ adminId: req.admin.id, action: 'BANNER_UPDATED', entityType: 'HeroBanner', entityId: banner.id, ip: req.ip });
  res.json({ banner });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.heroBanner.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Banner not found');

  await prisma.heroBanner.delete({ where: { id: req.params.id } });
  await deleteImageByUrl(existing.image);

  await logAction({ adminId: req.admin.id, action: 'BANNER_DELETED', entityType: 'HeroBanner', entityId: existing.id, ip: req.ip });
  res.json({ ok: true });
});

const setStatus = asyncHandler(async (req, res) => {
  const banner = await prisma.heroBanner.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  await logAction({ adminId: req.admin.id, action: 'BANNER_STATUS_CHANGED', entityType: 'HeroBanner', entityId: banner.id, meta: { status: banner.status }, ip: req.ip });
  res.json({ banner });
});

const reorder = asyncHandler(async (req, res) => {
  await applyOrder(prisma.heroBanner, req.body.order, 'priority', req.body.offset);
  await logAction({ adminId: req.admin.id, action: 'BANNER_REORDERED', entityType: 'HeroBanner', meta: { order: req.body.order }, ip: req.ip });
  res.json({ ok: true });
});

module.exports = { list, create, update, remove, setStatus, reorder };
