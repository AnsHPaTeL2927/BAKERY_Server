class ApiError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Not found' });
}

function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ message: err.message, details: err.details });
  }

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'File is too large' });
  }

  if (err && err.name === 'MulterError') {
    return res.status(400).json({ message: err.message });
  }

  if (err && err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      const field = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target;
      return res.status(409).json({ message: `A record with this ${field || 'value'} already exists.` });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Record not found' });
    }
  }

  console.error(err);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}

module.exports = { ApiError, asyncHandler, notFoundHandler, errorHandler };
