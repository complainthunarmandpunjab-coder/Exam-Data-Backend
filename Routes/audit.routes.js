const express = require('express');
const auditController = require('../controllers/audit.controller');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

router.use(auth);

router.get(
  '/audit-logs',
  auditController.getLogs
);

module.exports = router;
