const candidateService = require('../services/candidate.service');
const ApiResponse = require('../utils/apiResponse');

class CandidateController {
  register = async (req, res, next) => {
    try {
      const candidate = await candidateService.register(req.body);
      new ApiResponse(201, true, 'Registration completed successfully!', candidate).send(res);
    } catch (error) {
      next(error);
    }
  };

  adminRegister = async (req, res, next) => {
    try {
      const candidate = await candidateService.adminRegisterCandidate(req.body);
      new ApiResponse(201, true, 'Admin manual registration successful', candidate).send(res);
    } catch (error) {
      next(error);
    }
  };

  getAdmitCardPdf = async (req, res, next) => {
    try {
      const { cnic } = req.params;
      // Strip any hyphens or spaces for clean lookup
      const cleanCnic = cnic.replace(/[^0-9]/g, '');
      const candidate = await candidateService.getCandidateByCnic(cleanCnic);
      if (!candidate) {
        return res.status(404).json({ 
          success: false, 
          message: 'No registration found for this CNIC. / اس شناختی کارڈ پر کوئی رجسٹریشن نہیں ملی۔' 
        });
      }

      // Assign sequence number at slip generation time (if not already assigned)
      const updatedCandidate = await candidateService.assignExamSeqNumber(candidate._id, candidate.course);

      const path = require('path');
      const fs = require('fs');
      const cacheDir = path.join(__dirname, '../exports_secure/slips');
      
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const cachedPdfPath = path.join(cacheDir, `${cleanCnic}.pdf`);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=RollNumberSlip_${cleanCnic}.pdf`);

      if (fs.existsSync(cachedPdfPath)) {
        // Serve from disk cache
        const pdfStream = fs.createReadStream(cachedPdfPath);
        pdfStream.pipe(res);
      } else {
        // Generate new PDF
        const pdfService = require('../services/pdf.service');
        const hostUrl = `${req.protocol}://${req.get('host')}`;
        const pdfBuffer = await pdfService.generateAdmitCard(updatedCandidate || candidate, hostUrl);
        
        // Save to disk cache asynchronously so we don't block the response
        fs.writeFile(cachedPdfPath, pdfBuffer, (err) => {
          if (err) console.error('Failed to cache PDF to disk', err);
        });

        res.send(pdfBuffer);
      }
      
      // Mark as generated
      try {
        await candidateService.markSlipGenerated(candidate._id);
      } catch (err) {
        console.error('Failed to mark slip generated', err);
      }
    } catch (error) {
      next(error);
    }
  };

  getCandidates = async (req, res, next) => {
    try {
      const { 
        page, limit, search, gender, city, preferredExamCity, district, tehsil, institute, 
        batch, verification, course, status, startDate, endDate, sortBy, sortOrder, showDeleted, slipGenerated
      } = req.query;
      
      const filters = { 
        search, gender, city, preferredExamCity, district, tehsil, institute, 
        batch, verification, course, status, startDate, endDate, sortBy, sortOrder, showDeleted, slipGenerated
      };
      const paginationOptions = { page, limit };

      const result = await candidateService.getCandidates(filters, paginationOptions);
      
      new ApiResponse(200, true, 'Candidates fetched successfully', result.data, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages
      }).send(res);
    } catch (error) {
      next(error);
    }
  };

  softDelete = async (req, res, next) => {
    try {
      const candidate = await candidateService.softDeleteCandidate(req.params.id);
      new ApiResponse(200, true, 'Candidate record soft deleted successfully', candidate).send(res);
    } catch (error) {
      next(error);
    }
  };

  restore = async (req, res, next) => {
    try {
      const candidate = await candidateService.restoreCandidate(req.params.id);
      new ApiResponse(200, true, 'Candidate record restored successfully', candidate).send(res);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const candidate = await candidateService.updateCandidate(req.params.id, req.body);
      new ApiResponse(200, true, 'Candidate record updated successfully', candidate).send(res);
    } catch (error) {
      next(error);
    }
  };

  bulkAction = async (req, res, next) => {
    try {
      const { action, ids, payload } = req.body;
      const result = await candidateService.bulkAction(action, ids, payload);
      new ApiResponse(200, true, `Bulk action [${action}] executed successfully`, result).send(res);
    } catch (error) {
      next(error);
    }
  };

  getReports = async (req, res, next) => {
    try {
      const { reportType, ...filters } = req.query;
      const data = await candidateService.getReports(reportType, filters);
      new ApiResponse(200, true, `${reportType} report fetched successfully`, data).send(res);
    } catch (error) {
      next(error);
    }
  };

  getDashboardStats = async (req, res, next) => {
    try {
      const stats = await candidateService.getDashboardStats();
      new ApiResponse(200, true, 'Dashboard statistics fetched successfully', stats).send(res);
    } catch (error) {
      next(error);
    }
  };

  // QR Code Scan: verify student identity + mark attendance
  verifyByQr = async (req, res, next) => {
    try {
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ success: false, message: 'Invalid QR code.' });
      }

      let isAdmin = false;
      let tokenHeader = req.header('x-auth-token');
      if (!tokenHeader && req.header('Authorization')) {
        const authHeader = req.header('Authorization');
        if (authHeader.startsWith('Bearer ')) {
          tokenHeader = authHeader.substring(7, authHeader.length);
        }
      }
      if (tokenHeader) {
        try {
          const jwt = require('jsonwebtoken');
          const environment = require('../config/environment');
          jwt.verify(tokenHeader, environment.jwtSecret);
          isAdmin = true;
        } catch(err) {
          // Ignore token error for public view
        }
      }

      const candidate = await candidateService.verifyByQrToken(token, isAdmin);
      if (!candidate) {
        return res.status(404).json({ success: false, message: 'Student not found. QR code is invalid or expired.' });
      }

      new ApiResponse(200, true, 'Student verified successfully', candidate).send(res);
    } catch (error) {
      next(error);
    }
  };

  // Admin: get list of students who attended exam
  getAttendance = async (req, res, next) => {
    try {
      const attendance = await candidateService.getAttendedCandidates();
      new ApiResponse(200, true, 'Attendance fetched successfully', attendance).send(res);
    } catch (error) {
      next(error);
    }
  };

  clearCache = async (req, res, next) => {
    try {
      await candidateService.clearAllCaches();
      new ApiResponse(200, true, 'Cache cleared successfully').send(res);
    } catch (error) {
      next(error);
    }
  };

  downloadExport = async (req, res, next) => {
    try {
      const { filename } = req.params;
      const path = require('path');
      const fs = require('fs');
      const filePath = path.join(__dirname, '../exports_secure', filename);
      
      if (fs.existsSync(filePath)) {
        res.download(filePath);
      } else {
        res.status(404).json({ success: false, message: 'Export file not found or expired.' });
      }
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new CandidateController();
