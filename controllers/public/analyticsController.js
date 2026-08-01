const { asyncHandler } = require('../../middleware/errorHandler');
const { track } = require('../../services/analyticsService');

const trackEvent = asyncHandler(async (req, res) => {
  await track(req.body.type, req.body.refId);
  res.status(204).end();
});

module.exports = { trackEvent };
