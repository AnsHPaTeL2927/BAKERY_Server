const { ApiError } = require('./errorHandler');

function validate(schema) {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      const details = result.error.flatten().fieldErrors;
      return next(new ApiError(422, 'Validation failed', details));
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.query) {
      // Express 5 exposes req.query as a getter-only accessor (recomputed fresh
      // from the URL on every read), so a plain reassignment here is a silent
      // no-op. Defining an own property on this request instance shadows that
      // prototype getter for the rest of the request's lifecycle.
      Object.defineProperty(req, 'query', {
        value: result.data.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (result.data.params) req.params = result.data.params;
    next();
  };
}

module.exports = { validate };
