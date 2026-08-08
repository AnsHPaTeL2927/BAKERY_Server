const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { addDuration } = require('./duration');
const { sendMail } = require('../config/mailer');

const MAX_RESET_ATTEMPTS = 5;
const RESET_TTL_MINUTES = 15;

function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function issuePasswordReset(admin) {
  // Only the newest outstanding reset code is ever valid, same rule as login OTPs.
  await prisma.passwordResetToken.deleteMany({ where: { adminId: admin.id, consumedAt: null } });

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = addDuration(new Date(), `${RESET_TTL_MINUTES}m`);

  await prisma.passwordResetToken.create({ data: { adminId: admin.id, codeHash, expiresAt } });

  await sendMail({
    to: admin.email,
    subject: 'Reset your Cakes by Tulsi admin password',
    html: `
      <p>Hello ${admin.name},</p>
      <p>Use this code to reset your admin password:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>
      <p>This code expires in ${RESET_TTL_MINUTES} minutes. If you didn't request this, you can ignore this email.</p>
    `,
  });
}

async function verifyResetCode(admin, submittedCode) {
  const row = await prisma.passwordResetToken.findFirst({
    where: { adminId: admin.id, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!row) {
    return { ok: false, reason: 'No active reset code. Please request a new one.' };
  }
  if (row.expiresAt < new Date()) {
    return { ok: false, reason: 'Reset code has expired. Please request a new one.' };
  }
  if (row.attempts >= MAX_RESET_ATTEMPTS) {
    return { ok: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  }

  const matches = await bcrypt.compare(submittedCode, row.codeHash);
  if (!matches) {
    await prisma.passwordResetToken.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, reason: 'Incorrect reset code.' };
  }

  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}

module.exports = { issuePasswordReset, verifyResetCode };
