// One-off: rewrites legacy absolute invoice URLs (which pointed at the
// world-readable /uploads/invoices/... path) to the relative, auth-gated API
// path. Safe to re-run.
const prisma = require('../config/prisma');

(async () => {
  const orders = await prisma.order.findMany({
    where: { invoicePath: { not: null } },
    select: { id: true, invoicePath: true },
  });

  let updated = 0;
  for (const order of orders) {
    const target = `/api/admin/orders/${order.id}/invoice`;
    if (order.invoicePath === target) continue;
    await prisma.order.update({ where: { id: order.id }, data: { invoicePath: target } });
    updated += 1;
  }

  console.log(`normalized ${updated} of ${orders.length} invoice path(s)`);
  await prisma.$disconnect();
})();
