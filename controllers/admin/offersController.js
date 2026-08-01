const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');

const list = asyncHandler(async (req, res) => {
  const { search, status, page, pageSize } = req.query;
  const where = {
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ festival: { contains: search } }, { title: { contains: search } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.offer.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});

const create = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(422, 'A banner image is required');

  const banner = await saveProcessedImage(req.file.buffer, 'hero');
  const offer = await prisma.offer.create({ data: { ...req.body, banner } });

  await logAction({ adminId: req.admin.id, action: 'OFFER_CREATED', entityType: 'Offer', entityId: offer.id, ip: req.ip });
  res.status(201).json({ offer });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Offer not found');

  let banner = existing.banner;
  if (req.file) {
    banner = await saveProcessedImage(req.file.buffer, 'hero');
    await deleteImageByUrl(existing.banner);
  }

  const offer = await prisma.offer.update({ where: { id: req.params.id }, data: { ...req.body, banner } });

  await logAction({ adminId: req.admin.id, action: 'OFFER_UPDATED', entityType: 'Offer', entityId: offer.id, ip: req.ip });
  res.json({ offer });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.offer.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Offer not found');

  await prisma.offer.delete({ where: { id: req.params.id } });
  await deleteImageByUrl(existing.banner);

  await logAction({ adminId: req.admin.id, action: 'OFFER_DELETED', entityType: 'Offer', entityId: existing.id, ip: req.ip });
  res.json({ ok: true });
});

const setStatus = asyncHandler(async (req, res) => {
  const offer = await prisma.offer.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  await logAction({ adminId: req.admin.id, action: 'OFFER_STATUS_CHANGED', entityType: 'Offer', entityId: offer.id, meta: { status: offer.status }, ip: req.ip });
  res.json({ offer });
});

module.exports = { list, create, update, remove, setStatus };
