const prisma = require('../../config/prisma');
const { asyncHandler } = require('../../middleware/errorHandler');
const { saveProcessedImage, deleteImageByUrl } = require('../../services/imageService');
const { logAction } = require('../../services/auditService');

const get = asyncHandler(async (req, res) => {
  const settings = await prisma.websiteSettings.findUnique({ where: { id: 1 } });
  res.json({ settings });
});

const update = asyncHandler(async (req, res) => {
  const existing = await prisma.websiteSettings.findUnique({ where: { id: 1 } });

  let logo = existing?.logo ?? null;
  let favicon = existing?.favicon ?? null;

  if (req.files?.logo?.[0]) {
    logo = await saveProcessedImage(req.files.logo[0].buffer, 'logo');
    if (existing?.logo) await deleteImageByUrl(existing.logo);
  } else if (req.body.removeLogo === 'true' && existing?.logo) {
    await deleteImageByUrl(existing.logo);
    logo = null;
  }

  if (req.files?.favicon?.[0]) {
    favicon = await saveProcessedImage(req.files.favicon[0].buffer, 'favicon');
    if (existing?.favicon) await deleteImageByUrl(existing.favicon);
  } else if (req.body.removeFavicon === 'true' && existing?.favicon) {
    await deleteImageByUrl(existing.favicon);
    favicon = null;
  }

  const { removeLogo, removeFavicon, ...rest } = req.body;

  const settings = await prisma.websiteSettings.upsert({
    where: { id: 1 },
    update: { ...rest, logo, favicon },
    create: { id: 1, siteName: 'Cakes by Tulsi', ...rest, logo, favicon },
  });

  await logAction({ adminId: req.admin.id, action: 'SETTINGS_UPDATED', entityType: 'WebsiteSettings', entityId: 1, ip: req.ip });
  res.json({ settings });
});

module.exports = { get, update };
