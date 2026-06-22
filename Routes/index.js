const express = require('express');
const authRoutes = require('./auth.routes');
const candidateRoutes = require('./candidate.routes');
const verificationRoutes = require('./verification.routes');
const teamRoutes = require('./team.routes');
const auditRoutes = require('./audit.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', authRoutes); // Direct mapping for /login compatibility
router.use('/', candidateRoutes);
router.use('/', verificationRoutes);
router.use('/', teamRoutes);
router.use('/', auditRoutes);

module.exports = router;
