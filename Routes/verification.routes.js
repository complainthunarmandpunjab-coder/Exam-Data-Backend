const express = require('express');
const verificationController = require('../controllers/verification.controller');
const validate = require('../middleware/validate.middleware');
const verificationValidation = require('../validations/verification.validation');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

router.post(
  '/verify-student',
  validate(verificationValidation.verifyStudentSchema),
  verificationController.verifyStudent
);

router.get(
  '/verifications',
  auth,
  validate(verificationValidation.logQuerySchema, 'query'),
  verificationController.getVerificationLogs
);

module.exports = router;
