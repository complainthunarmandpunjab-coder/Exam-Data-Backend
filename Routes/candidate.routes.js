const express = require('express');
const candidateController = require('../controllers/candidate.controller');
const validate = require('../middleware/validate.middleware');
const candidateValidation = require('../validations/candidate.validation');
const auth = require('../middleware/auth.middleware');
const auditLog = require('../middleware/audit.middleware');
const { authorize } = require('../middleware/permission.middleware');

const router = express.Router();

router.post(
  '/register',
  validate(candidateValidation.registerSchema),
  candidateController.register
);

router.get(
  '/candidates',
  auth,
  candidateController.getCandidates
);

router.delete(
  '/candidates/:id',
  auth,
  authorize(['superadmin', 'admin']),
  auditLog('soft_delete_candidate'),
  candidateController.softDelete
);

router.post(
  '/candidates/:id/restore',
  auth,
  authorize(['superadmin', 'admin']),
  auditLog('restore_candidate'),
  candidateController.restore
);

router.put(
  '/candidates/:id',
  auth,
  authorize(['superadmin', 'admin']),
  auditLog('update_candidate'),
  candidateController.update
);

router.post(
  '/candidates/bulk',
  auth,
  authorize(['superadmin', 'admin']),
  auditLog('bulk_action_candidates'),
  candidateController.bulkAction
);

router.get(
  '/candidates/reports',
  auth,
  candidateController.getReports
);

router.get(
  '/dashboard/stats',
  auth,
  candidateController.getDashboardStats
);

router.post(
  '/candidates/export',
  auth,
  authorize(['superadmin', 'admin'], 'export'),
  auditLog('export_candidates'),
  require('../controllers/export.controller').createExportJob
);

router.get(
  '/candidates/export/jobs',
  auth,
  require('../controllers/export.controller').getExportJobs
);

module.exports = router;
