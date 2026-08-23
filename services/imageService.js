const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { ApiError } = require('../middleware/errorHandler');
const sharp = require('sharp');
const env = require('../config/env');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

// Vercel's filesystem is read-only outside /tmp, and /tmp does not survive
// between invocations, so anything written locally would vanish before the
// next request could serve it. In production images go to Vercel Blob and are
// referenced by the absolute URL it returns; local development keeps writing
// to uploads/ so there is no cloud dependency just to run the site.
const USE_BLOB = Boolean(env.BLOB_READ_WRITE_TOKEN);

const DIMENSIONS = {
  hero: { width: 1920, height: 800 },
  product: { width: 1200, height: 1200 },
  gallery: { width: 1200, height: 1200 },
  category: { width: 600, height: 600 },
  logo: { width: 300, height: 300 },
  chef: { width: 800, height: 600 },
  about: { width: 600, height: 600 },
  favicon: { width: 64, height: 64 },
};

const DIR_BY_MODULE = {
  hero: 'banners',
  product: 'products',
  gallery: 'gallery',
  category: 'categories',
  logo: 'settings',
  chef: 'about',
  about: 'about',
  favicon: 'settings',
};

// Resizes/crops the uploaded image to the exact dimensions required by the
// module and converts it to webp. Returns the URL to store on the record:
// an absolute Blob URL in production, or a relative "/uploads/..." path
// locally (which absolutizeUploads then expands per-request).
async function saveProcessedImage(buffer, moduleKey) {
  const dims = DIMENSIONS[moduleKey];
  if (!dims) {
    throw new Error(`Unknown image module: ${moduleKey}`);
  }

  const dir = DIR_BY_MODULE[moduleKey];
  const filename = `${crypto.randomUUID()}.webp`;

  // The MIME check in middleware/upload.js trusts the browser-declared type,
  // so a file that is renamed (or mislabelled by the OS) reaches this far and
  // then fails inside sharp. Left unhandled that surfaces as a generic 500,
  // which reads as "the site is broken" rather than "this file is not usable".
  let processed;
  try {
    processed = await sharp(buffer)
      .resize(dims.width, dims.height, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    console.warn(`[image] could not decode upload for ${moduleKey}: ${err.message}`);
    throw new ApiError(
      400,
      'This file could not be read as an image. It may be corrupted, or saved in a different format than its name suggests — please re-save it as a JPG, PNG, or WEBP and try again.',
    );
  }

  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    // addRandomSuffix is off because the filename is already a UUID; leaving it
    // on would append a second random segment and make the stored URL
    // impossible to predict from the pathname during data migration.
    const { url } = await put(`uploads/${dir}/${filename}`, processed, {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
      token: env.BLOB_READ_WRITE_TOKEN,
      cacheControlMaxAge: 31536000,
    });
    return url;
  }

  const destDir = path.join(UPLOADS_ROOT, dir);
  await fs.mkdir(destDir, { recursive: true });
  await fs.writeFile(path.join(destDir, filename), processed);

  return `/uploads/${dir}/${filename}`;
}

// Accepts either storage shape. Records written before the Blob migration
// still hold "/uploads/..." paths, so both are handled rather than assuming
// everything in the database matches the current backend.
async function deleteImageByUrl(url) {
  if (!url) return;

  if (/^https?:\/\//i.test(url)) {
    // Only ever delete from our own Blob store — seed/demo rows point at
    // external hosts (Unsplash) that must be left alone.
    if (!USE_BLOB || !url.includes('.blob.vercel-storage.com')) return;
    const { del } = require('@vercel/blob');
    try {
      await del(url, { token: env.BLOB_READ_WRITE_TOKEN });
    } catch (err) {
      // A missing blob is not an error worth failing the request over — the
      // caller is deleting the record either way.
      console.warn(`[image] blob delete failed for ${url}: ${err.message}`);
    }
    return;
  }

  if (!url.startsWith('/uploads/')) return;
  const relativePath = url.replace('/uploads/', '');
  const fullPath = path.join(UPLOADS_ROOT, relativePath);
  try {
    await fs.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

module.exports = { saveProcessedImage, deleteImageByUrl, DIMENSIONS, USE_BLOB };
