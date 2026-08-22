// Step 3 of the move: copy the image files that currently live in server/uploads/
// into Vercel Blob, and rewrite the "/uploads/..." paths stored in the database
// to the absolute Blob URLs they now live at.
//
//   BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..." \
//   POSTGRES_PRISMA_URL="postgresql://...-pooler...neon.tech/...?sslmode=require&pgbouncer=true" \
//     npm run blob:migrate
//
// Run AFTER db:import. The files are already processed webp — they are uploaded
// byte-for-byte, not re-encoded, so nothing is resized or re-compressed twice.
//
// Idempotent: values that are already absolute URLs are left alone, so a
// re-run after a partial failure only picks up what is still on disk.
const fs = require('fs/promises');
const path = require('path');
const { put } = require('@vercel/blob');
const prisma = require('../config/prisma');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const DRY_RUN = process.argv.includes('--dry-run');

// Every column in the schema that holds an image path, as
// [prisma model, field]. ProductImage.url is handled here too — it is the one
// that lives on a child table rather than the record itself.
const IMAGE_FIELDS = [
  ['category', 'image'],
  ['productImage', 'url'],
  ['gallery', 'image'],
  ['offer', 'banner'],
  ['heroBanner', 'image'],
  ['testimonial', 'photo'],
  ['websiteSettings', 'logo'],
  ['websiteSettings', 'favicon'],
];

const CONTENT_TYPES = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

const uploaded = new Map();

async function uploadOnce(relativeUrl) {
  // The same file can be referenced by more than one row (a logo reused as a
  // favicon, say). Upload it once and reuse the URL rather than creating
  // duplicate blobs that then have to be cleaned up by hand.
  if (uploaded.has(relativeUrl)) return uploaded.get(relativeUrl);

  const relativePath = relativeUrl.replace('/uploads/', '');
  const localPath = path.join(UPLOADS_ROOT, relativePath);

  let buffer;
  try {
    buffer = await fs.readFile(localPath);
  } catch {
    console.warn(`  ! missing on disk, leaving as-is: ${relativeUrl}`);
    uploaded.set(relativeUrl, null);
    return null;
  }

  if (DRY_RUN) {
    uploaded.set(relativeUrl, relativeUrl);
    return relativeUrl;
  }

  const { url } = await put(`uploads/${relativePath}`, buffer, {
    access: 'public',
    contentType: CONTENT_TYPES[path.extname(localPath).toLowerCase()] || 'application/octet-stream',
    addRandomSuffix: false,
    cacheControlMaxAge: 31536000,
  });

  uploaded.set(relativeUrl, url);
  return url;
}

async function main() {
  if (!DRY_RUN && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is required. Copy it from the Vercel Blob store, or pass --dry-run.');
    process.exit(1);
  }

  if (DRY_RUN) console.log('DRY RUN — nothing will be uploaded or written.\n');

  let migrated = 0;
  let skipped = 0;

  for (const [model, field] of IMAGE_FIELDS) {
    const rows = await prisma[model].findMany({
      where: { [field]: { startsWith: '/uploads/' } },
      select: { id: true, [field]: true },
    });

    if (rows.length === 0) {
      console.log(`${model}.${field}: nothing to migrate`);
      continue;
    }

    console.log(`${model}.${field}: ${rows.length} row(s)`);

    for (const row of rows) {
      const blobUrl = await uploadOnce(row[field]);
      if (!blobUrl) {
        skipped += 1;
        continue;
      }

      if (!DRY_RUN) {
        await prisma[model].update({ where: { id: row.id }, data: { [field]: blobUrl } });
      }

      migrated += 1;
      console.log(`  ${row[field]}\n    -> ${blobUrl}`);
    }
  }

  console.log(`\nDone. ${migrated} reference(s) rewritten, ${skipped} skipped (file not found on disk).`);
  if (skipped > 0) {
    console.log('Skipped rows still point at /uploads/ and will show the placeholder image until re-uploaded in the admin panel.');
  }
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Image migration failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
