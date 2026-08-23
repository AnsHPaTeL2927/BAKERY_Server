const path = require('path');
const multer = require('multer');
const { ApiError } = require('./errorHandler');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_LABEL = 'JPG, PNG, or WEBP';
// Vercel caps a serverless function's request body at 4.5MB, and that limit
// is enforced by the platform before Express ever sees the request — so the
// ceiling here sits below it, letting multer return a clean validation error
// instead of the upload dying with an opaque 413 from the edge.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_FILE_SIZE_LABEL = '4MB';

// Formats people actually try to upload and are then confused to have rejected.
// AVIF and HEIC are the common ones: HEIC is what an iPhone produces by
// default, and AVIF is what "save image as" now yields on many sites.
const FORMAT_NAMES = {
  'image/avif': 'AVIF images',
  'image/heic': 'HEIC images',
  'image/heif': 'HEIF images',
  'image/gif': 'GIF images',
  'image/bmp': 'BMP images',
  'image/tiff': 'TIFF images',
  'image/svg+xml': 'SVG files',
  'application/pdf': 'PDF files',
};

// Names the format the way the person who chose the file would recognise it,
// preferring the MIME type and falling back to the extension (some browsers
// send application/octet-stream for formats they do not themselves know).
function describeFormat(file) {
  const known = FORMAT_NAMES[file.mimetype];
  if (known) return `${known} are`;

  const ext = path.extname(file.originalname || '').replace('.', '').toUpperCase();
  if (ext) return `${ext} files are`;

  return 'That file type is';
}

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    // Must be an ApiError: a plain Error matches none of errorHandler's
    // branches and would surface to the admin as a generic 500 "Something went
    // wrong", which says nothing about what to do next.
    return cb(
      new ApiError(415, `${describeFormat(file)} not supported. Please upload a ${ALLOWED_LABEL} image instead.`),
    );
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = { upload, MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL, ALLOWED_LABEL };
