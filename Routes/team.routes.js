const express = require('express');
const teamController = require('../controllers/team.controller');
const auth = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/permission.middleware');
const auditLog = require('../middleware/audit.middleware');

const router = express.Router();

router.use(auth);

router.get(
  '/team-members',
  authorize(['superadmin']),
  teamController.list
);

router.post(
  '/team-members',
  authorize(['superadmin']),
  auditLog('create_team_member'),
  teamController.create
);

router.put(
  '/team-members/:id',
  authorize(['superadmin']),
  auditLog('update_team_member'),
  teamController.update
);

router.delete(
  '/team-members/:id',
  authorize(['superadmin']),
  auditLog('delete_team_member'),
  teamController.delete
);

module.exports = router;
