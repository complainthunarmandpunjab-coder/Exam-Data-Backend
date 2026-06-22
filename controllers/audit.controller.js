const AuditLog = require('../models/auditLog.model');
const ApiResponse = require('../utils/apiResponse');

class AuditController {
  getLogs = async (req, res, next) => {
    try {
      const { tab } = req.query;
      let query = {};

      if (tab) {
        if (tab === 'grid') {
          query.action = { $in: ['soft_delete_candidate', 'restore_candidate', 'update_candidate', 'bulk_action_candidates'] };
        } else if (tab === 'team') {
          query.action = { $in: ['create_team_member', 'update_team_member', 'delete_team_member'] };
        } else if (tab === 'exports') {
          query.action = 'export_candidates';
        }
      }

      // Fetch latest 30 logs
      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(30);

      new ApiResponse(200, true, 'Audit logs fetched successfully', logs).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AuditController();
