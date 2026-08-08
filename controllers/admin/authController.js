const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const env = require('../../config/env');
const { asyncHandler, ApiError } = require('../../middleware/errorHandler');
const { issueOtp, verifyOtp, sendLoginNotification } = require('../../services/otpService');
const { issuePasswordReset, verifyResetCode } = require('../../services/passwordResetService');
const { logAction } = require('../../services/auditService');
const { addDuration } = require('../../services/duration');
const {
  signAccessToken,
  signOtpSessionToken,
  generateRefreshToken,
  hashRefreshToken,
} = require('../../services/tokenService');
const {
  getCookieOptions,
  setOtpSessionCookie,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
} = require('../../services/cookies');
const { getOtpSessionAdminId } = require('../../services/otpSession');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION = '15m';

function toPublicAdmin(admin) {
  return { id: admin.id, name: admin.name, email: admin.email };
}


const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const admin = await prisma.admin.findUnique({ where: { email } });

  if (!admin) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
    throw new ApiError(423, `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`);
  }

  const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

  if (!passwordMatches) {
    const failedAttempts = admin.failedAttempts + 1;
    const lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? addDuration(new Date(), LOCK_DURATION) : null;

    await prisma.admin.update({
      where: { id: admin.id },
      data: { failedAttempts, lockedUntil },
    });

    await logAction({ adminId: admin.id, action: 'LOGIN_FAILED', ip: req.ip });

    if (lockedUntil) {
      throw new ApiError(423, 'Account locked due to too many failed attempts. Try again in 15 minutes.');
    }
    throw new ApiError(401, 'Invalid email or password');
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  await issueOtp(admin);

  const otpSessionToken = signOtpSessionToken(admin.id);
  setOtpSessionCookie(res, otpSessionToken);

  res.json({
    message: 'A verification code has been sent to your email.',
    email: admin.email,
    otpSessionToken,
  });
});

const verify = asyncHandler(async (req, res) => {
  const adminId = getOtpSessionAdminId(req);
  if (!adminId) {
    throw new ApiError(400, 'Your session has expired. Please log in again.');
  }

  const result = await verifyOtp(adminId, req.body.otp);
  if (!result.ok) {
    throw new ApiError(401, result.reason);
  }

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    throw new ApiError(401, 'Account not found');
  }

  const accessToken = signAccessToken(admin);
  const refreshTokenRaw = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshTokenRaw);

  await prisma.refreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: refreshTokenHash,
      expiresAt: addDuration(new Date(), env.REFRESH_TOKEN_TTL),
      userAgent: req.get('user-agent')?.slice(0, 512),
      ip: req.ip,
    },
  });

  await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

  res.clearCookie('otp_session', getCookieOptions());
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshTokenRaw);

  await logAction({ adminId: admin.id, action: 'LOGIN_SUCCESS', ip: req.ip });
  await sendLoginNotification(admin, { ip: req.ip, userAgent: req.get('user-agent') });

  res.json({ admin: toPublicAdmin(admin) });
});

const resendOtp = asyncHandler(async (req, res) => {
  const adminId = getOtpSessionAdminId(req);
  if (!adminId) {
    throw new ApiError(400, 'Your session has expired. Please log in again.');
  }

  const admin = await prisma.admin.findUnique({ where: { id: adminId } });
  if (!admin) {
    throw new ApiError(400, 'Your session has expired. Please log in again.');
  }

  await issueOtp(admin);
  res.json({ message: 'A new verification code has been sent to your email.' });
});

const me = asyncHandler(async (req, res) => {
  const admin = await prisma.admin.findUnique({ where: { id: req.admin.id } });
  if (!admin) {
    throw new ApiError(401, 'Not authenticated');
  }
  res.json({ admin: toPublicAdmin(admin) });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    throw new ApiError(401, 'Not authenticated');
  }

  const tokenHash = hashRefreshToken(token);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!existing) {
    clearAuthCookies(res);
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  const admin = await prisma.admin.findUnique({ where: { id: existing.adminId } });
  if (!admin) {
    clearAuthCookies(res);
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });

  const newRefreshRaw = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      adminId: admin.id,
      tokenHash: hashRefreshToken(newRefreshRaw),
      expiresAt: addDuration(new Date(), env.REFRESH_TOKEN_TTL),
      userAgent: req.get('user-agent')?.slice(0, 512),
      ip: req.ip,
    },
  });

  setAccessTokenCookie(res, signAccessToken(admin));
  setRefreshTokenCookie(res, newRefreshRaw);

  res.json({ admin: toPublicAdmin(admin) });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    const tokenHash = hashRefreshToken(token);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  if (req.admin) {
    await logAction({ adminId: req.admin.id, action: 'LOGOUT', ip: req.ip });
  }

  clearAuthCookies(res);
  res.json({ ok: true });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const admin = await prisma.admin.findUnique({ where: { email } });

  if (admin) {
    await issuePasswordReset(admin);
    await logAction({ adminId: admin.id, action: 'PASSWORD_RESET_REQUESTED', ip: req.ip });
  }

  // Identical response whether or not the email is registered, so this
  // endpoint can't be used to enumerate admin accounts.
  res.json({ message: 'If that email is registered, a reset code has been sent.' });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;
  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin) {
    throw new ApiError(400, 'Invalid or expired reset code.');
  }

  const result = await verifyResetCode(admin, code);
  if (!result.ok) {
    throw new ApiError(400, result.reason);
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash, failedAttempts: 0, lockedUntil: null },
  });

  // A password reset should invalidate every existing session, not just force a re-login on this device.
  await prisma.refreshToken.updateMany({ where: { adminId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });

  await logAction({ adminId: admin.id, action: 'PASSWORD_RESET_COMPLETED', ip: req.ip });
  res.json({ ok: true, message: 'Password updated. Please log in with your new password.' });
});

module.exports = { login, verify, resendOtp, me, refresh, logout, forgotPassword, resetPassword };
