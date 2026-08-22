const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

// Both token types are signed with a `purpose` claim AND verified against it,
// so one can never be replayed as the other. Without that check the only thing
// separating a half-authenticated OTP-session token from a fully authenticated
// access token is that they happen to use different secrets — the moment those
// are reused or unified (a very easy config mistake), the pre-OTP token would
// silently unlock the whole admin API.
const ACCESS_PURPOSE = 'admin-access';
const OTP_PURPOSE = 'otp-verify';
const JWT_ISSUER = 'cakes-by-tulsi-api';

function signAccessToken(admin) {
  return jwt.sign({ sub: admin.id, email: admin.email, purpose: ACCESS_PURPOSE }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: JWT_ISSUER,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: JWT_ISSUER });
  if (payload.purpose !== ACCESS_PURPOSE) {
    throw new jwt.JsonWebTokenError('Unexpected token purpose');
  }
  return payload;
}

function signOtpSessionToken(adminId) {
  return jwt.sign({ sub: adminId, purpose: OTP_PURPOSE }, env.OTP_SESSION_SECRET, {
    expiresIn: env.OTP_SESSION_TTL,
    issuer: JWT_ISSUER,
  });
}

function verifyOtpSessionToken(token) {
  const payload = jwt.verify(token, env.OTP_SESSION_SECRET, { issuer: JWT_ISSUER });
  if (payload.purpose !== OTP_PURPOSE) {
    throw new jwt.JsonWebTokenError('Unexpected token purpose');
  }
  return payload;
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
