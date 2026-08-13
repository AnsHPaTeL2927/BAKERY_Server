const prisma = require('../../config/prisma');
const { asyncHandler } = require('../../middleware/errorHandler');

function serializeProduct(product) {
  const primary = product.images.find((img) => img.isPrimary) || product.images[0];
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category?.slug ?? null,
    description: product.description,
    image: primary?.url ?? null,
    images: product.images.map((img) => img.url),
    weights: product.weights,
    priceByWeight: product.priceByWeight,
    flavours: product.flavours,
    featured: product.featured,
    available: product.available,
  };
}

const getProducts = asyncHandler(async (req, res) => {
  const { category } = req.query;
  const products = await prisma.product.findMany({
    where: {
      status: 'LIVE',
      ...(category ? { category: { slug: String(category) } } : {}),
    },
    include: { images: { orderBy: { sortOrder: 'asc' } }, category: { select: { slug: true } } },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  res.json(products.map(serializeProduct));
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { status: 'LIVE' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, slug: true, description: true, image: true },
  });
  res.json(categories);
});

const getGallery = asyncHandler(async (req, res) => {
  const gallery = await prisma.gallery.findMany({
    where: { status: 'LIVE' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, image: true, alt: true, category: true },
  });
  res.json(gallery);
});

const getOffers = asyncHandler(async (req, res) => {
  const offers = await prisma.offer.findMany({
    where: { status: 'LIVE' },
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
  });

  // The admin's `active` flag is a manual "is this the current promotion"
  // toggle — it doesn't know about the clock, so an admin who forgets to
  // flip it off after `endDate` would otherwise keep an expired offer live
  // on the public site indefinitely. Compute the date-aware truth here so
  // every public consumer (Home banner, Festival Specials) sees the same
  // answer without duplicating this logic or needing a separate cron job.
  const now = Date.now();
  const withComputedState = offers.map((offer) => ({
    ...offer,
    isCurrentlyActive: offer.active && offer.startDate.getTime() <= now && now <= offer.endDate.getTime(),
    isUpcoming: offer.startDate.getTime() > now,
    isExpired: offer.endDate.getTime() < now,
  }));

  res.json(withComputedState);
});

const getSettings = asyncHandler(async (req, res) => {
  const settings = await prisma.websiteSettings.findUnique({ where: { id: 1 } });
  res.json(settings || {});
});

const getTestimonials = asyncHandler(async (req, res) => {
  const testimonials = await prisma.testimonial.findMany({
    where: { status: 'LIVE', approved: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  res.json(testimonials);
});

const getHeroBanners = asyncHandler(async (req, res) => {
  const banners = await prisma.heroBanner.findMany({
    where: { status: 'LIVE' },
    orderBy: [{ priority: 'asc' }, { id: 'asc' }],
  });
  res.json(banners);
});

module.exports = {
  getProducts,
  getCategories,
  getGallery,
  getOffers,
  getSettings,
  getTestimonials,
  getHeroBanners,
};
