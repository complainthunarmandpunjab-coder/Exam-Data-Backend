const express = require('express');
const candidateController = require('../controllers/candidate.controller');
const validate = require('../middleware/validate.middleware');
const candidateValidation = require('../validations/candidate.validation');
const auth = require('../middleware/auth.middleware');


const router = express.Router();

router.get(
  '/candidates/admit-card/:cnic',
  candidateController.getAdmitCardPdf
);

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

  candidateController.softDelete
);

router.post(
  '/candidates/:id/restore',
  auth,

  candidateController.restore
);

router.put(
  '/candidates/:id',
  auth,

  candidateController.update
);

router.post(
  '/candidates/bulk',
  auth,

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

  require('../controllers/export.controller').createExportJob
);

router.get(
  '/candidates/export/jobs',
  auth,
  require('../controllers/export.controller').getExportJobs
);

module.exports = router;
