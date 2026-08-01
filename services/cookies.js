const env = require('../config/env');
const { parseDurationMs } = require('./duration');

const isProd = env.NODE_ENV === 'production';

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
};

function setOtpSessionCookie(res, token) {
  res.cookie('otp_session', token, { ...baseOptions, maxAge: parseDurationMs(env.OTP_SESSION_TTL) });
}

function setAccessTokenCookie(res, token) {
  res.cookie('access_token', token, { ...baseOptions, maxAge: parseDurationMs(env.ACCESS_TOKEN_TTL) });
}

function setRefreshTokenCookie(res, token) {
  res.cookie('refresh_token', token, { ...baseOptions, maxAge: parseDurationMs(env.REFRESH_TOKEN_TTL) });
}

function clearAuthCookies(res) {
  res.clearCookie('otp_session', baseOptions);
  res.clearCookie('access_token', baseOptions);
  res.clearCookie('refresh_token', baseOptions);
}

module.exports = {
  setOtpSessionCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
};
