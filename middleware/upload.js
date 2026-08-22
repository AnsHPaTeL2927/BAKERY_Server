const multer = require('multer');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// Vercel caps a serverless function's request body at 4.5MB, and that limit
// is enforced by the platform before Express ever sees the request — so the
// ceiling here sits below it, letting multer return a clean validation error
// instead of the upload dying with an opaque 413 from the edge.
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = { upload };
