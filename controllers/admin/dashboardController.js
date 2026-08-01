const { asyncHandler } = require('../../middleware/errorHandler');
const { getDashboardStats } = require('../../services/analyticsService');

const get = asyncHandler(async (req, res) => {
  const stats = await getDashboardStats();
  res.json(stats);
});

module.exports = { get };
