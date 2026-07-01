const express = require('express');
const multer = require('multer');
const resultController = require('../controllers/result.controller');
const auth = require('../middleware/auth.middleware');

const router = express.Router();

// Setup Multer for Excel upload in memory
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for large excel files
});

// Admin Routes
router.post('/upload', auth, upload.single('file'), resultController.uploadBulkResults);
router.get('/', auth, resultController.getAdminResults);
router.post('/publish', auth, resultController.publishResults);
router.get('/analytics', auth, resultController.getAnalytics);
router.get('/export', auth, resultController.exportResults);
router.delete('/:id', auth, resultController.deleteResult);
router.put('/:id', auth, resultController.updateResult);

// Public Routes (No Auth)
router.get('/public/verify-qr', resultController.verifyResultByQr);
router.get('/public/:query', resultController.getPublicResult);
router.get('/public/:id/pdf', resultController.getPublicResultPdf);

module.exports = router;
