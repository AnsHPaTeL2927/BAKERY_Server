const prisma = require('../../config/prisma');
const { asyncHandler } = require('../../middleware/errorHandler');

// Visitors submit reviews straight from the public site, but nothing they
// write ever reaches the live page unreviewed: every submission is forced into
// the moderation queue (approved: false + status: DRAFT) regardless of what the
// request body contained. The public GET /testimonials only ever returns
// `status: LIVE, approved: true`, so an admin has to clear it in
// /admin/testimonials before it appears anywhere.
const create = asyncHandler(async (req, res) => {
  const { name, review, rating } = req.body;

  const created = await prisma.testimonial.create({
    data: {
      name,
      review,
      rating,
      approved: false,
      status: 'DRAFT',
      featured: false,
      photo: null,
    },
    select: { id: true },
  });

  res.status(201).json({
    ok: true,
    id: created.id,
    message: 'Thank you! Your review has been received and will appear once approved.',
  });
});

module.exports = { create };
