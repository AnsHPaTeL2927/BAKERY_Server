const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const DIMENSIONS = {
  hero: { width: 1920, height: 800 },
  product: { width: 1200, height: 1200 },
  gallery: { width: 1200, height: 1200 },
  category: { width: 600, height: 600 },
  logo: { width: 300, height: 300 },
  favicon: { width: 64, height: 64 },
};

const DIR_BY_MODULE = {
  hero: 'banners',
  product: 'products',
  gallery: 'gallery',
  category: 'categories',
  logo: 'settings',
  favicon: 'settings',
};

// Resizes/crops the uploaded image to the exact dimensions required by the module,
// converts it to webp, and writes it under server/uploads/<module>/. Returns the
// public-facing relative URL to store on the record.
async function saveProcessedImage(buffer, moduleKey) {
  const dims = DIMENSIONS[moduleKey];
  if (!dims) {
    throw new Error(`Unknown image module: ${moduleKey}`);
  }

  const dir = DIR_BY_MODULE[moduleKey];
  const filename = `${crypto.randomUUID()}.webp`;
  const destDir = path.join(UPLOADS_ROOT, dir);
  await fs.mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, filename);

  await sharp(buffer)
    .resize(dims.width, dims.height, { fit: 'cover', position: 'centre' })
    .webp({ quality: 82 })
    .toFile(destPath);

  return `/uploads/${dir}/${filename}`;
}

async function deleteImageByUrl(url) {
  if (!url || !url.startsWith('/uploads/')) return;
  const relativePath = url.replace('/uploads/', '');
  const fullPath = path.join(UPLOADS_ROOT, relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { saveProcessedImage, deleteImageByUrl, DIMENSIONS };
