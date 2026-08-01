const prisma = require('../config/prisma');

function startOfDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date) {
  const d = startOfDay(date);
  d.setUTCDate(1);
  return d;
}

function dateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function monthKey(date) {
  return new Date(date).toISOString().slice(0, 7);
}

async function track(type, refId) {
  await prisma.analytics.create({
    data: { type, refId: refId ?? null, date: startOfDay(new Date()) },
  });
}

const CLICK_TYPES = ['ORDER_CLICK', 'WHATSAPP_CLICK', 'CALL_CLICK'];

async function getDashboardStats() {
  const now = new Date();
  const today = startOfDay(now);
  const monthStart = startOfMonth(now);
  const last30Start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const last6MonthsStart = new Date(monthStart);
  last6MonthsStart.setUTCMonth(last6MonthsStart.getUTCMonth() - 5);

  const [
    visitorsToday,
    visitorsMonth,
    totalVisitors,
    orderClicks,
    whatsappClicks,
    callClicks,
    galleryViews,
    productViews,
    recentRows,
    recentActivity,
  ] = await Promise.all([
    prisma.analytics.count({ where: { type: 'PAGE_VIEW', date: { gte: today } } }),
    prisma.analytics.count({ where: { type: 'PAGE_VIEW', date: { gte: monthStart } } }),
    prisma.analytics.count({ where: { type: 'PAGE_VIEW' } }),
    prisma.analytics.count({ where: { type: 'ORDER_CLICK' } }),
    prisma.analytics.count({ where: { type: 'WHATSAPP_CLICK' } }),
    prisma.analytics.count({ where: { type: 'CALL_CLICK' } }),
    prisma.analytics.count({ where: { type: 'GALLERY_VIEW' } }),
    prisma.analytics.count({ where: { type: 'PRODUCT_VIEW' } }),
    prisma.analytics.findMany({ where: { date: { gte: last6MonthsStart } }, select: { type: true, refId: true, date: true } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { admin: { select: { name: true } } },
    }),
  ]);

  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);
  const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [orderStatusGroups, todayRevenueAgg, monthRevenueAgg, reminderRows] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { pickupDatetime: { gte: today, lt: todayEnd }, status: { not: 'CANCELLED' } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { pickupDatetime: { gte: monthStart, lt: nextMonthStart }, status: { not: 'CANCELLED' } },
    }),
    prisma.order.findMany({
      where: {
        pickupDatetime: { gte: today, lte: reminderWindowEnd },
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
      orderBy: { pickupDatetime: 'asc' },
      take: 10,
    }),
  ]);

  const orderStatusCounts = Object.fromEntries(orderStatusGroups.map((g) => [g.status, g._count._all]));
  const orders = {
    total: orderStatusGroups.reduce((sum, g) => sum + g._count._all, 0),
    pending: orderStatusCounts.PENDING || 0,
    confirmed: orderStatusCounts.CONFIRMED || 0,
    preparing: orderStatusCounts.PREPARING || 0,
    ready: orderStatusCounts.READY || 0,
    delivered: orderStatusCounts.DELIVERED || 0,
    cancelled: orderStatusCounts.CANCELLED || 0,
    todayRevenue: Number(todayRevenueAgg._sum.totalAmount || 0),
    monthlyRevenue: Number(monthRevenueAgg._sum.totalAmount || 0),
  };

  const reminders = reminderRows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    productName: o.productName,
    phone: o.phone,
    orderType: o.orderType,
    pickupDatetime: o.pickupDatetime,
    status: o.status,
    urgent: o.pickupDatetime.getTime() - now.getTime() <= 60 * 60 * 1000,
  }));

  const orderReminders = {
    today: reminders.filter((r) => new Date(r.pickupDatetime) < todayEnd),
    upcoming: reminders.filter((r) => new Date(r.pickupDatetime) >= todayEnd),
  };

  const visitorsByDay = new Map();
  const clicksByDay = new Map();
  const visitorsByMonth = new Map();
  const clicksByMonth = new Map();
  const productViewCounts = new Map();

  for (const row of recentRows) {
    const dKey = dateKey(row.date);
    const mKey = monthKey(row.date);

    if (row.type === 'PAGE_VIEW') {
      if (row.date >= last30Start) visitorsByDay.set(dKey, (visitorsByDay.get(dKey) || 0) + 1);
      visitorsByMonth.set(mKey, (visitorsByMonth.get(mKey) || 0) + 1);
    }

    if (CLICK_TYPES.includes(row.type)) {
      if (row.date >= last30Start) {
        const entry = clicksByDay.get(dKey) || { orderClicks: 0, whatsappClicks: 0, callClicks: 0 };
        if (row.type === 'ORDER_CLICK') entry.orderClicks += 1;
        if (row.type === 'WHATSAPP_CLICK') entry.whatsappClicks += 1;
        if (row.type === 'CALL_CLICK') entry.callClicks += 1;
        clicksByDay.set(dKey, entry);
      }
      clicksByMonth.set(mKey, (clicksByMonth.get(mKey) || 0) + 1);
    }

    if (row.type === 'PRODUCT_VIEW' && row.refId) {
      productViewCounts.set(row.refId, (productViewCounts.get(row.refId) || 0) + 1);
    }
  }

  const visitorsSeries = [];
  const clicksSeries = [];
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(last30Start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = dateKey(d);
    visitorsSeries.push({ date: key, count: visitorsByDay.get(key) || 0 });
    const clickEntry = clicksByDay.get(key) || { orderClicks: 0, whatsappClicks: 0, callClicks: 0 };
    clicksSeries.push({ date: key, ...clickEntry });
  }

  const monthlyAnalytics = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(monthStart);
    d.setUTCMonth(d.getUTCMonth() - i);
    const key = monthKey(d);
    monthlyAnalytics.push({
      month: key,
      visitors: visitorsByMonth.get(key) || 0,
      clicks: clicksByMonth.get(key) || 0,
    });
  }

  const topProductIds = [...productViewCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const topProductRows = topProductIds.length
    ? await prisma.product.findMany({ where: { id: { in: topProductIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(topProductRows.map((p) => [p.id, p.name]));
  const topProducts = topProductIds.map((id) => ({
    productId: id,
    name: nameById.get(id) || 'Unknown product',
    views: productViewCounts.get(id) || 0,
  }));

  return {
    cards: {
      visitorsToday,
      visitorsMonth,
      totalVisitors,
      orderClicks,
      whatsappClicks,
      callClicks,
      galleryViews,
      productViews,
    },
    visitorsSeries,
    clicksSeries,
    monthlyAnalytics,
    topProducts,
    orders,
    orderReminders,
    recentActivity: recentActivity.map((row) => ({
      id: row.id,
      action: row.action,
      adminName: row.admin?.name || 'System',
      createdAt: row.createdAt,
    })),
  };
}

module.exports = { track, getDashboardStats };
