const { verifyOtpSessionToken } = require('./tokenService');

function getOtpSessionToken(req) {
  const cookieToken = req.cookies?.otp_session;
  if (cookieToken) return cookieToken;

  const headerToken = req.get?.('x-otp-session-token') || req.headers?.['x-otp-session-token'];
  if (headerToken) return headerToken;

  const bodyToken = req.body?.otpSessionToken;
  if (bodyToken) return bodyToken;

  return null;
}

function getOtpSessionAdminId(req) {
  const token = getOtpSessionToken(req);
  if (!token) return null;

  try {
    const payload = verifyOtpSessionToken(token);
    return payload.sub;
  } catch {
    return null;
  }
}

module.exports = { getOtpSessionToken, getOtpSessionAdminId };
