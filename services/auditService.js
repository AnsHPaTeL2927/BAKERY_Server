const prisma = require('../config/prisma');

async function logAction({ adminId, action, entityType, entityId, meta, ip }) {
  await prisma.auditLog.create({
    data: {
      adminId: adminId ?? null,
      action,
      entityType: entityType ?? null,
      entityId: entityId ?? null,
      meta: meta ?? undefined,
      ip: ip ?? null,
    },
  });
}

module.exports = { logAction };
