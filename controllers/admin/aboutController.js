const prisma = require('../../config/prisma');
const { asyncHandler } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');

// field name in the form -> image module (drives resize dimensions)
const IMAGE_FIELDS = {
  chefPhoto: 'chef',
  image1: 'about',
  image2: 'about',
  image3: 'about',
};

const get = asyncHandler(async (_req, res) => {
  const about = await prisma.aboutSection.findUnique({ where: { id: 1 } });
  res.json({ about });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.aboutSection.findUnique({ where: { id: 1 } });

  const images = {};
  for (const [field, moduleKey] of Object.entries(IMAGE_FIELDS)) {
    const uploaded = req.files?.[field]?.[0];
    const previous = existing?.[field] ?? null;

    if (uploaded) {
      images[field] = await saveProcessedImage(uploaded.buffer, moduleKey);
      // Only after the replacement is safely stored, so a failed upload never
      // leaves the section with a dangling reference.
      if (previous) await deleteImageByUrl(previous);
    } else if (req.body[`remove_${field}`] === 'true' && previous) {
      await deleteImageByUrl(previous);
      images[field] = null;
    } else {
      images[field] = previous;
    }
  }

  // Strip the remove_* control flags — they are instructions, not columns.
  const rest = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => !key.startsWith('remove_')),
  );

  const about = await prisma.aboutSection.upsert({
    where: { id: 1 },
    update: { ...rest, ...images },
    create: { id: 1, ...rest, ...images },
  });

  await logAction({
    adminId: req.admin.id,
    action: 'ABOUT_UPDATED',
    entityType: 'AboutSection',
    entityId: 1,
    ip: req.ip,
  });

  res.json({ about });
});

module.exports = { get, update };
