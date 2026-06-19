const express = require('express');
const authRoutes = require('./auth.routes');
const candidateRoutes = require('./candidate.routes');
const verificationRoutes = require('./verification.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', authRoutes); // Direct mapping for /login compatibility
router.use('/', candidateRoutes);
router.use('/', verificationRoutes);

module.exports = router;
