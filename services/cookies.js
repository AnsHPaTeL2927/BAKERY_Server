const env = require('../config/env');
const { parseDurationMs } = require('./duration');

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

function clearAuthCookies(res) {
  const options = getCookieOptions();
  res.clearCookie('otp_session', options);
  res.clearCookie('access_token', options);
  res.clearCookie('refresh_token', options);
}

module.exports = {
  getCookieOptions,
  setOtpSessionCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
};
