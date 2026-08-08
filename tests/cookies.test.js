const test = require('node:test');
const assert = require('node:assert/strict');

process.env.FRONTEND_URL = 'https://admin.example.com';

const { setOtpSessionCookie, setAccessTokenCookie, setRefreshTokenCookie } = require('../services/cookies');

test('auth cookies use cross-site compatible settings for browser-based sessions', () => {
  const cookies = [];
  const res = {
    cookie(name, value, options) {
      cookies.push({ name, value, options });
    },
  };

  setOtpSessionCookie(res, 'otp-token');
  setAccessTokenCookie(res, 'access-token');
  setRefreshTokenCookie(res, 'refresh-token');

  for (const cookie of cookies) {
    assert.equal(cookie.options.sameSite, 'none');
    assert.equal(cookie.options.secure, true);
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.path, '/');
  }
});
