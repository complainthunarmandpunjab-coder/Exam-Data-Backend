const logger = require('../config/logger');
const environment = require('../config/environment');

const errorHandler = (err, req, res, next) => {
  let { statusCode = 500, message } = err;

  if (environment.env === 'production' && !err.isOperational) {
    statusCode = 500;
    message = 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  const response = {
    success: false,
    statusCode,
    message,
    ...(environment.env === 'development' && { stack: err.stack })
  };

  if (statusCode === 500) {
    logger.error(err);
  } else {
    logger.warn(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }

  res.status(statusCode).send(response);
};

module.exports = errorHandler;
