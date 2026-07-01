const express = require('express');
const authRoutes = require('./auth.routes');
const candidateRoutes = require('./candidate.routes');
const verificationRoutes = require('./verification.routes');
const resultRoutes = require('./result.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/results', resultRoutes);
router.use('/', candidateRoutes);
router.use('/', verificationRoutes);

module.exports = router;
