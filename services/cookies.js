const env = require('../config/env');
const { parseDurationMs } = require('./duration');
const { generateCsrfToken, CSRF_COOKIE } = require('../middleware/csrf');

function getCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  };
}

function setOtpSessionCookie(res, token) {
  res.cookie('otp_session', token, getCookieOptions(parseDurationMs(env.OTP_SESSION_TTL)));
}

function setAccessTokenCookie(res, token) {
  res.cookie('access_token', token, getCookieOptions(parseDurationMs(env.ACCESS_TOKEN_TTL)));
}

function setRefreshTokenCookie(res, token) {
  res.cookie('refresh_token', token, getCookieOptions(parseDurationMs(env.REFRESH_TOKEN_TTL)));
}

// Deliberately NOT httpOnly: the SPA has to read this one to echo it back in
// the x-csrf-token header. It carries no authority on its own — it is only ever
// compared against the header on the same request.
function setCsrfCookie(res) {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE, token, {
    ...getCookieOptions(parseDurationMs(env.REFRESH_TOKEN_TTL)),
    httpOnly: false,
  });
  return token;
}

function clearAuthCookies(res) {
  const options = getCookieOptions();
  res.clearCookie('otp_session', options);
  res.clearCookie('access_token', options);
  res.clearCookie('refresh_token', options);
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}

module.exports = {
  getCookieOptions,
  setOtpSessionCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  setCsrfCookie,
  clearAuthCookies,
};
