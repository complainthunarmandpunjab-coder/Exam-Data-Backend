const verificationService = require('../services/verification.service');
const ApiResponse = require('../utils/apiResponse');

class VerificationController {
  verifyStudent = async (req, res, next) => {
    try {
      const result = await verificationService.verifyStudent(req.body);
      new ApiResponse(200, true, 'Verification completed', result).send(res);
    } catch (error) {
      next(error);
    }
  };

  getVerificationLogs = async (req, res, next) => {
    try {
      const { page, limit, search, status, payment } = req.query;
      
      const filters = { search, status, payment };
      const paginationOptions = { page, limit };

      const result = await verificationService.getVerificationLogs(filters, paginationOptions);

      new ApiResponse(200, true, 'Verification logs fetched successfully', result.data, {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages
      }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new VerificationController();
