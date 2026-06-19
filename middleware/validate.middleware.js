const ApiError = require('../utils/apiError');

const validate = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: true
  });

  if (error) {
    const errorMessage = error.details.map((details) => details.message).join(', ');
    return next(new ApiError(400, errorMessage));
  }

  // Update request source with validated and sanitized data
  if (source === 'query') {
    // req.query is read-only getter in Express 5, so we copy properties instead of overwriting the reference
    for (const key in req.query) {
      delete req.query[key];
    }
    Object.assign(req.query, value);
  } else {
    req[source] = value;
  }
  return next();
};

module.exports = validate;
