const { verifyAccessToken } = require('../services/tokenService');
const { ApiError } = require('./errorHandler');

function requireAdminAuth(req, res, next) {
  const token = req.cookies?.access_token;

  if (!token) {
    return next(new ApiError(401, 'Not authenticated'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.admin = { id: payload.sub, email: payload.email };
    next();
  } catch {
    next(new ApiError(401, 'Session expired'));
  }
}

module.exports = { requireAdminAuth };
