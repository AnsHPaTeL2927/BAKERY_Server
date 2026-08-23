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

  // Multer's own messages ("File too large", "Unexpected field") are written
  // for developers and tell an admin nothing about how to fix the upload, so
  // each one is restated in terms of what they should actually do.
  if (err && err.name === 'MulterError') {
    const { MAX_FILE_SIZE_LABEL } = require('./upload');

    if (err.code === 'LIMIT_FILE_SIZE') {
      const which = err.field ? `The image for "${err.field}"` : 'That image';
      return res.status(413).json({
        message: `${which} is larger than the ${MAX_FILE_SIZE_LABEL} limit. Please compress it or choose a smaller file.`,
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: `This form does not accept a file in "${err.field}". Please use the provided upload fields.`,
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({ message: 'Too many files in one upload. Please add them a few at a time.' });
    }

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
