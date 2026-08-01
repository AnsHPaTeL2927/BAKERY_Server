const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { addDuration } = require('./duration');
const { sendMail } = require('../config/mailer');

const MAX_OTP_ATTEMPTS = 5;

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

async function issueOtp(admin) {
  // Invalidate any OTP still outstanding for this admin — only the newest one is ever valid.
  await prisma.otpCode.deleteMany({ where: { adminId: admin.id, consumedAt: null } });

  const otp = generateOtp();
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresAt = addDuration(new Date(), `${env.OTP_TTL_MINUTES}m`);

  await prisma.otpCode.create({
    data: { adminId: admin.id, codeHash, expiresAt },
  });

  await sendMail({
    to: admin.email,
    subject: 'Your Cakes by Tulsi admin verification code',
    html: `
      <p>Hello ${admin.name},</p>
      <p>Your one-time verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${otp}</p>
      <p>This code expires in ${env.OTP_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
    `,
  });

  return otp;
}

async function verifyOtp(adminId, submittedCode) {
  const otpRow = await prisma.otpCode.findFirst({
    where: { adminId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!otpRow) {
    return { ok: false, reason: 'No active verification code. Please log in again.' };
  }

  if (otpRow.expiresAt < new Date()) {
    return { ok: false, reason: 'Verification code has expired. Please log in again.' };
  }

  if (otpRow.attempts >= MAX_OTP_ATTEMPTS) {
    return { ok: false, reason: 'Too many incorrect attempts. Please log in again.' };
  }

  const matches = await bcrypt.compare(submittedCode, otpRow.codeHash);

  if (!matches) {
    await prisma.otpCode.update({ where: { id: otpRow.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: 'Incorrect verification code.' };
  }

  await prisma.otpCode.update({ where: { id: otpRow.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}

async function sendLoginNotification(admin, { ip, userAgent }) {
  await sendMail({
    to: admin.email,
    subject: 'New login to your Cakes by Tulsi admin account',
    html: `
      <p>Hello ${admin.name},</p>
      <p>Your admin account was just signed in successfully.</p>
      <ul>
        <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
        <li><strong>IP address:</strong> ${ip || 'unknown'}</li>
        <li><strong>Device:</strong> ${userAgent || 'unknown'}</li>
      </ul>
      <p>If this wasn't you, please change your password immediately.</p>
    `,
  });
}

module.exports = { issueOtp, verifyOtp, sendLoginNotification };
