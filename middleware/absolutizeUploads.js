const env = require('../config/env');

// Uploaded images are stored/returned as relative "/uploads/..." paths, but the
// frontend runs on a different origin (Vite dev server, a Cloudflare Tunnel
// hostname, or a production domain), so every response is walked here to turn
// those relative paths into fully-qualified URLs. Seed/demo data that already
// uses external URLs (e.g. Unsplash) passes through unchanged.
function rewrite(value, baseUrl) {
  if (typeof value === 'string') {
    return value.startsWith('/uploads/') ? `${baseUrl}${value}` : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewrite(item, baseUrl));
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = rewrite(val, baseUrl);
    }
    return out;
  }
  return value;
}

// Derives the base URL from the incoming request instead of a fixed env var,
// so the same deployment serves correct image URLs whether it's reached via
// localhost, a rotating Cloudflare Tunnel hostname, or a production domain
// behind a reverse proxy. `trust proxy` is enabled in index.js, so req.protocol
// already reflects X-Forwarded-Proto; the host is read explicitly because
// req.get('host') returns the raw Host header, not a forwarded one.
function resolveBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.get('host');
  if (!host) return env.PUBLIC_ASSET_URL;

  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  return `${protocol}://${host}`;
}

function absolutizeUploads(req, res, next) {
  const baseUrl = resolveBaseUrl(req);
  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(rewrite(body, baseUrl));
  next();
}

module.exports = { absolutizeUploads, resolveBaseUrl };
