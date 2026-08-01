const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');
const { applyOrder } = require('../../services/reorderService');

const list = asyncHandler(async (req, res) => {
  const { search, status, page, pageSize } = req.query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ alt: { contains: search } }, { category: { contains: search } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.gallery.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.gallery.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

const create = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'An image is required');

  const image = await saveProcessedImage(req.file.buffer, 'gallery');
  const sortOrder = req.body.sortOrder ?? (await prisma.gallery.count());
  const item = await prisma.gallery.create({ data: { ...req.body, image, sortOrder } });

  await logAction({ adminId: req.admin.id, action: 'GALLERY_CREATED', entityType: 'Gallery', entityId: item.id, ip: req.ip });
  res.status(201).json({ item });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.gallery.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Gallery item not found');

  let image = existing.image;
  if (req.file) {
    image = await saveProcessedImage(req.file.buffer, 'gallery');
    await deleteImageByUrl(existing.image);
  }

  const item = await prisma.gallery.update({ where: { id: req.params.id }, data: { ...req.body, image } });

  await logAction({ adminId: req.admin.id, action: 'GALLERY_UPDATED', entityType: 'Gallery', entityId: item.id, ip: req.ip });
  res.json({ item });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.gallery.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Gallery item not found');

  await prisma.gallery.delete({ where: { id: req.params.id } });
  await deleteImageByUrl(existing.image);

  await logAction({ adminId: req.admin.id, action: 'GALLERY_DELETED', entityType: 'Gallery', entityId: existing.id, ip: req.ip });
  res.json({ ok: true });
});

const setStatus = asyncHandler(async (req, res) => {
  const item = await prisma.gallery.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  await logAction({ adminId: req.admin.id, action: 'GALLERY_STATUS_CHANGED', entityType: 'Gallery', entityId: item.id, meta: { status: item.status }, ip: req.ip });
  res.json({ item });
});

const reorder = asyncHandler(async (req, res) => {
  await applyOrder(prisma.gallery, req.body.order, 'sortOrder', req.body.offset);
  await logAction({ adminId: req.admin.id, action: 'GALLERY_REORDERED', entityType: 'Gallery', meta: { order: req.body.order }, ip: req.ip });
  res.json({ ok: true });
});

module.exports = { list, create, update, remove, setStatus, reorder };
