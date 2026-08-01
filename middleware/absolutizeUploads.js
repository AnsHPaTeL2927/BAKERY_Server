const env = require('../config/env');

// Uploaded images are stored/returned as relative "/uploads/..." paths, but the
// frontend runs on a different origin (Vite dev server), so every response is
// walked here to turn those relative paths into fully-qualified URLs. Seed/demo
// data that already uses external URLs (e.g. Unsplash) passes through unchanged.
function rewrite(value) {
  if (typeof value === 'string') {
    return value.startsWith('/uploads/') ? `${env.PUBLIC_ASSET_URL}${value}` : value;
  }
  if (Array.isArray(value)) {
    return value.map(rewrite);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = rewrite(val);
    }
    return out;
  }
  return value;
}

function absolutizeUploads(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(rewrite(body));
  next();
}

module.exports = { absolutizeUploads };
