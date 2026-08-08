const prisma = require('../../config/prisma');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');

function minPriceOf(product) {
  const prices = Object.values(product.priceByWeight || {});
  return prices.length ? Math.min(...prices) : 0;
}

const list = asyncHandler(async (req, res) => {
  const { search, status, page, pageSize, categoryId, featured, available, minPrice, maxPrice, sort } = req.query;
  const where = {
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(search ? { name: { contains: search } } : {}),
    ...(featured !== undefined ? { featured: featured === 'true' } : {}),
    ...(available !== undefined ? { available: available === 'true' } : {}),
  };
  const orderBy = sort
    ? [{ createdAt: sort === 'newest' ? 'desc' : 'asc' }, { id: 'asc' }]
    : [{ sortOrder: 'asc' }, { id: 'asc' }];

  const hasPriceFilter = minPrice !== undefined || maxPrice !== undefined;

  if (hasPriceFilter) {
    // priceByWeight is a JSON map of weight -> price with no fixed keys, so a
    // range filter can't be expressed as a plain SQL WHERE clause here — filter
    // in application code instead of adding a dedicated min/max price column.
    const all = await prisma.product.findMany({
      where,
      include: { images: { orderBy: { sortOrder: 'asc' } }, category: { select: { id: true, name: true, slug: true } } },
      orderBy,
    });
    const filtered = all.filter((p) => {
      const price = minPriceOf(p);
      if (minPrice !== undefined && price < minPrice) return false;
      if (maxPrice !== undefined && price > maxPrice) return false;
      return true;
    });
    const total = filtered.length;
    const pageItems = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    res.json({
      items: pageItems.map((p) => ({ ...p, image: p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || null })),
      total,
      page,
      pageSize,
    });
    return;
  }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { images: { orderBy: { sortOrder: 'asc' } }, category: { select: { id: true, name: true, slug: true } } },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    items: items.map((p) => ({ ...p, image: p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || null })),
    total,
    page,
    pageSize,
  });
});

const create = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    throw new ApiError(422, 'At least one product image is required');
  }

  const product = await prisma.product.create({ data: req.body });

  const imageUrls = await Promise.all(files.map((file) => saveProcessedImage(file.buffer, 'product')));
  await prisma.productImage.createMany({
    data: imageUrls.map((url, index) => ({ productId: product.id, url, isPrimary: index === 0, sortOrder: index })),
  });

  const full = await prisma.product.findUnique({
    where: { id: product.id },
    include: { images: true, category: { select: { id: true, name: true, slug: true } } },
  });

  await logAction({ adminId: req.admin.id, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: product.id, ip: req.ip });
  res.status(201).json({ product: full });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id }, include: { images: true } });
  if (!existing) throw new ApiError(404, 'Product not found');

  const removeImageIds = req.body.removeImageIds
    ? JSON.parse(req.body.removeImageIds).map(Number)
    : [];
  const newPrimaryImageId = req.body.newPrimaryImageId ? Number(req.body.newPrimaryImageId) : null;
  delete req.body.removeImageIds;
  delete req.body.newPrimaryImageId;

  await prisma.product.update({ where: { id: req.params.id }, data: req.body });

  if (removeImageIds.length > 0) {
    const toRemove = existing.images.filter((img) => removeImageIds.includes(img.id));
    await prisma.productImage.deleteMany({ where: { id: { in: removeImageIds }, productId: existing.id } });
    await Promise.all(toRemove.map((img) => deleteImageByUrl(img.url)));
  }

  const files = req.files || [];
  if (files.length > 0) {
    const remainingCount = await prisma.productImage.count({ where: { productId: existing.id } });
    const imageUrls = await Promise.all(files.map((file) => saveProcessedImage(file.buffer, 'product')));
    await prisma.productImage.createMany({
      data: imageUrls.map((url, index) => ({
        productId: existing.id,
        url,
        isPrimary: remainingCount === 0 && index === 0,
        sortOrder: remainingCount + index,
      })),
    });
  }

  if (newPrimaryImageId) {
    await prisma.productImage.updateMany({ where: { productId: existing.id }, data: { isPrimary: false } });
    await prisma.productImage.updateMany({ where: { id: newPrimaryImageId, productId: existing.id }, data: { isPrimary: true } });
  }

  const full = await prisma.product.findUnique({
    where: { id: existing.id },
    include: { images: { orderBy: { sortOrder: 'asc' } }, category: { select: { id: true, name: true, slug: true } } },
  });

  await logAction({ adminId: req.admin.id, action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: existing.id, ip: req.ip });
  res.json({ product: full });
});

const remove = asyncHandler(async (req, res) => {
  const existing = await prisma.product.findUnique({ where: { id: req.params.id }, include: { images: true } });
  if (!existing) throw new ApiError(404, 'Product not found');

  await prisma.product.delete({ where: { id: req.params.id } });
  await Promise.all(existing.images.map((img) => deleteImageByUrl(img.url)));

  await logAction({ adminId: req.admin.id, action: 'PRODUCT_DELETED', entityType: 'Product', entityId: existing.id, ip: req.ip });
  res.json({ ok: true });
});

const setStatus = asyncHandler(async (req, res) => {
  const product = await prisma.product.update({ where: { id: req.params.id }, data: { status: req.body.status } });
  await logAction({ adminId: req.admin.id, action: 'PRODUCT_STATUS_CHANGED', entityType: 'Product', entityId: product.id, meta: { status: product.status }, ip: req.ip });
  res.json({ product });
});

module.exports = { list, create, update, remove, setStatus };
