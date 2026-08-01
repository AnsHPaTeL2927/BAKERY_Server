const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

function signOtpSessionToken(adminId) {
  return jwt.sign({ sub: adminId, purpose: 'otp-verify' }, env.OTP_SESSION_SECRET, {
    expiresIn: env.OTP_SESSION_TTL,
  });
}

function verifyOtpSessionToken(token) {
  return jwt.verify(token, env.OTP_SESSION_SECRET);
}

// Refresh tokens are opaque, high-entropy random strings sent to the client as-is.
// Only a SHA-256 hash of the token is ever persisted, so a stolen DB dump cannot be
// replayed as a valid refresh token.
function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signOtpSessionToken,
  verifyOtpSessionToken,
  generateRefreshToken,
  hashRefreshToken,
};
