const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');

const list = asyncHandler(async (req, res) => {
  const { search, status, page, pageSize } = req.query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { name: { contains: search } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.testimonial.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.testimonial.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

const create = asyncHandler(async (req, res) => {
  const photo = req.file ? await saveProcessedImage(req.file.buffer, 'gallery') : null;
  const item = await prisma.testimonial.create({ data: { ...req.body, photo } });

  await logAction({ adminId: req.admin.id, action: 'TESTIMONIAL_CREATED', entityType: 'Testimonial', entityId: item.id, ip: req.ip });
  res.status(201).json({ item });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Testimonial not found');

  let photo = existing.photo;
  if (req.file) {
    photo = await saveProcessedImage(req.file.buffer, 'gallery');
    await deleteImageByUrl(existing.photo);
  }

  const item = await prisma.testimonial.update({ where: { id: req.params.id }, data: { ...req.body, photo } });

  await logAction({ adminId: req.admin.id, action: 'TESTIMONIAL_UPDATED', entityType: 'Testimonial', entityId: item.id, ip: req.ip });
  res.json({ item });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.testimonial.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Testimonial not found');

  await prisma.testimonial.delete({ where: { id: req.params.id } });
  await deleteImageByUrl(existing.photo);

  await logAction({ adminId: req.admin.id, action: 'TESTIMONIAL_DELETED', entityType: 'Testimonial', entityId: existing.id, ip: req.ip });
  res.json({ ok: true });
});

const setStatus = asyncHandler(async (req, res) => {
  const item = await prisma.testimonial.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  await logAction({ adminId: req.admin.id, action: 'TESTIMONIAL_STATUS_CHANGED', entityType: 'Testimonial', entityId: item.id, meta: { status: item.status }, ip: req.ip });
  res.json({ item });
});

module.exports = { list, create, update, remove, setStatus };
