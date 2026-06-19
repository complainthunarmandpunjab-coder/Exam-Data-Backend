const ApiError = require('../utils/apiError');

const authorize = (allowedRoles = [], requiredPermission = null) => {
  return (req, res, next) => {
    if (!req.admin) {
      return next(new ApiError(401, 'Unauthorized: Access token required'));
    }

    const { role, permissions = [] } = req.admin;

    // superadmin has absolute access
    if (role === 'superadmin') {
      return next();
    }

    // If allowedRoles is specified, check if admin's role is allowed
    if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
      return next(new ApiError(403, 'Forbidden: Access denied for this role'));
    }

    // If a specific permission is required, check permissions array
    if (requiredPermission && !permissions.includes(requiredPermission)) {
      return next(new ApiError(403, `Forbidden: Missing required permission [${requiredPermission}]`));
    }

    next();
  };
};

module.exports = { authorize };
