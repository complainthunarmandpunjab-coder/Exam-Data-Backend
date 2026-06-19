const express = require('express');
const authController = require('../controllers/auth.controller');
const validate = require('../middleware/validate.middleware');
const authValidation = require('../validations/auth.validation');

const router = express.Router();

router.post('/login', validate(authValidation.loginSchema), authController.login);

module.exports = router;
