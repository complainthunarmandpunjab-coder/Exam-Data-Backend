const jwt = require('jsonwebtoken');
const environment = require('../config/environment');
const ApiError = require('../utils/apiError');

const auth = (req, res, next) => {
  let token = req.header('x-auth-token');
  
  if (!token && req.header('Authorization')) {
    const authHeader = req.header('Authorization');
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7, authHeader.length);
    }
  }

  // Fallback for file downloads via window.open
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return next(new ApiError(401, 'No token, authorization denied'));
  }

  try {
    const decoded = jwt.verify(token, environment.jwtSecret);
    req.admin = decoded;
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    next(new ApiError(401, 'Token is not valid'));
  }
};

module.exports = auth;
