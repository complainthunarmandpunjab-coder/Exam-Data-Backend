const AuditLog = require('../models/auditLog.model');
const logger = require('../config/logger');

const auditLog = (action) => async (req, res, next) => {
  // Capture response properties when request finishes
  res.on('finish', async () => {
    try {
      // Only log successful modifications
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const payload = { ...req.body };
        // Clean sensitive fields
        if (payload.password) payload.password = '***';

        await AuditLog.create({
          adminId: req.admin ? req.admin.id : null,
          adminUsername: req.admin ? req.admin.username : 'anonymous',
          action,
          endpoint: req.originalUrl,
          method: req.method,
          ipAddress: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
          payload
        });
      }
    } catch (err) {
      logger.error(`Failed to write audit log: ${err.message}`);
    }
  });

  next();
};

module.exports = auditLog;
