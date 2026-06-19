const exportService = require('../services/export.service');
const ApiResponse = require('../utils/apiResponse');

class ExportController {
  createExportJob = async (req, res, next) => {
    try {
      const adminUsername = req.admin ? req.admin.username : 'admin';
      const job = await exportService.createExportJob(adminUsername, req.body);
      new ApiResponse(202, true, 'Export job initiated successfully', job).send(res);
    } catch (error) {
      next(error);
    }
  };

  getExportJobs = async (req, res, next) => {
    try {
      const adminUsername = req.admin ? req.admin.username : 'admin';
      const jobs = await exportService.getExportJobs(adminUsername);
      new ApiResponse(200, true, 'Export jobs retrieved', jobs).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new ExportController();
