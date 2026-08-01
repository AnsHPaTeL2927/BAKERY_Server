const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');
const { applyOrder } = require('../../services/reorderService');

const list = asyncHandler(async (req, res) => {
  const { search, status, page, pageSize } = req.query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { name: { contains: search } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.category.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

const create = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(422, 'A category image is required');
  }

  const image = await saveProcessedImage(req.file.buffer, 'category');
  const sortOrder = req.body.sortOrder ?? (await prisma.category.count());
  const category = await prisma.category.create({
    data: { ...req.body, image, sortOrder },
  });

  await logAction({ adminId: req.admin.id, action: 'CATEGORY_CREATED', entityType: 'Category', entityId: category.id, ip: req.ip });
  res.status(201).json({ category });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Category not found');

  let image = existing.image;
  if (req.file) {
    image = await saveProcessedImage(req.file.buffer, 'category');
    await deleteImageByUrl(existing.image);
  }

  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: { ...req.body, image },
  });

  await logAction({ adminId: req.admin.id, action: 'CATEGORY_UPDATED', entityType: 'Category', entityId: category.id, ip: req.ip });
  res.json({ category });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Category not found');

  await prisma.category.delete({ where: { id: req.params.id } });
  await deleteImageByUrl(existing.image);

  await logAction({ adminId: req.admin.id, action: 'CATEGORY_DELETED', entityType: 'Category', entityId: existing.id, ip: req.ip });
  res.json({ ok: true });
});

const setStatus = asyncHandler(async (req, res) => {
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: { status: req.body.status },
  });

  await logAction({ adminId: req.admin.id, action: 'CATEGORY_STATUS_CHANGED', entityType: 'Category', entityId: category.id, meta: { status: category.status }, ip: req.ip });
  res.json({ category });
});

const reorder = asyncHandler(async (req, res) => {
  await applyOrder(prisma.category, req.body.order, 'sortOrder', req.body.offset);
  await logAction({ adminId: req.admin.id, action: 'CATEGORY_REORDERED', entityType: 'Category', meta: { order: req.body.order }, ip: req.ip });
  res.json({ ok: true });
});

module.exports = { list, create, update, remove, setStatus, reorder };
