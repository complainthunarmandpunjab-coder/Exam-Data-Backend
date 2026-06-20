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

  getCandidates = async (req, res, next) => {
    try {
      const { 
        page, limit, search, gender, city, preferredExamCity, district, tehsil, institute, 
        batch, verification, course, status, startDate, endDate, sortBy, sortOrder, showDeleted
      } = req.query;
      
      const filters = { 
        search, gender, city, preferredExamCity, district, tehsil, institute, 
        batch, verification, course, status, startDate, endDate, sortBy, sortOrder, showDeleted
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
}

module.exports = new CandidateController();
