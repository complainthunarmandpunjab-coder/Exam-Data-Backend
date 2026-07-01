const ExcelJS = require('exceljs');
const crypto = require('crypto');
const Result = require('../models/result.model');
const Candidate = require('../models/candidate.model');
const resultPdfService = require('../services/resultPdf.service');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

// Helper to calculate Grade and Status
const calculateResult = (theoryMarks, practicalMarks) => {
  const obtainedMarks = Number(theoryMarks) + Number(practicalMarks);
  const totalMarks = 100; // Fixed per your grading rules, or adjust if needed.
  const percentage = (obtainedMarks / totalMarks) * 100;
  
  let grade = 'FAIL';
  let status = 'FAIL';

  if (percentage >= 90) grade = 'A+';
  else if (percentage >= 80) grade = 'A';
  else if (percentage >= 70) grade = 'B';
  else if (percentage >= 60) grade = 'C';
  
  if (percentage >= 60) status = 'PASS';

  return { obtainedMarks, totalMarks, percentage, grade, status };
};

exports.uploadBulkResults = async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ApiError(400, 'Please upload an Excel file.');
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];

    const resultsToInsert = [];
    const errors = [];
    let successCount = 0;

    // Process rows (assuming row 1 is header)
    const rows = worksheet.getRows(2, worksheet.rowCount - 1) || [];

    for (const row of rows) {
      const rollNumber = row.getCell(1).value?.toString().trim();
      const theoryMarks = Number(row.getCell(2).value) || 0;
      const practicalMarks = Number(row.getCell(3).value) || 0;

      if (!rollNumber) continue; // Skip empty rows

      // Find the candidate
      const candidate = await Candidate.findOne({ rollNumber });
      if (!candidate) {
        errors.push(`Row ${row.number}: Roll Number ${rollNumber} not found.`);
        continue;
      }

      const { obtainedMarks, totalMarks, percentage, grade, status } = calculateResult(theoryMarks, practicalMarks);

      // Generate a secure, unique QR token for this result
      const resultQrToken = crypto.randomBytes(32).toString('hex');

      const resultData = {
        candidateId: candidate._id,
        rollNumber: candidate.rollNumber,
        studentName: candidate.fullName,
        CNIC: candidate.cnic,
        course: candidate.course,
        district: candidate.district,
        institute: candidate.institute,
        theoryMarks,
        practicalMarks,
        obtainedMarks,
        totalMarks,
        percentage,
        grade,
        status,
        resultQrToken
      };

      // Upsert: update if exists, otherwise create
      await Result.findOneAndUpdate(
        { rollNumber: candidate.rollNumber },
        { $set: resultData },
        { upsert: true, new: true }
      );

      successCount++;
    }

    new ApiResponse(200, true, 'Bulk upload processed.', {
      successCount,
      errorCount: errors.length,
      errors
    }).send(res);
  } catch (error) {
    next(error);
  }
};

exports.getAdminResults = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, status, district, course, published } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { rollNumber: { $regex: search, $options: 'i' } },
        { CNIC: { $regex: search, $options: 'i' } },
        { studentName: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (district) query.district = district;
    if (course) query.course = course;
    if (published !== undefined) query.published = published === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const results = await Result.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit));
    const total = await Result.countDocuments(query);

    new ApiResponse(200, true, 'Results fetched.', results, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }).send(res);
  } catch (error) {
    next(error);
  }
};

exports.publishResults = async (req, res, next) => {
  try {
    // Bulk publish all, or specified ones
    const { ids, publishState } = req.body; // publishState = true/false
    
    let query = {};
    if (ids && ids.length > 0) {
      query = { _id: { $in: ids } };
    }
    
    await Result.updateMany(query, { $set: { published: publishState } });
    
    new ApiResponse(200, true, `Results successfully ${publishState ? 'published' : 'unpublished'}.`).send(res);
  } catch (error) {
    next(error);
  }
};

exports.deleteResult = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Result.findByIdAndDelete(id);
    new ApiResponse(200, true, 'Result deleted successfully.').send(res);
  } catch (error) {
    next(error);
  }
};

exports.updateResult = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { theoryMarks, practicalMarks, remarks } = req.body;
    
    const result = await Result.findById(id);
    if (!result) throw new ApiError(404, 'Result not found');

    if (theoryMarks !== undefined && practicalMarks !== undefined) {
      const calc = calculateResult(theoryMarks, practicalMarks);
      Object.assign(result, calc, { theoryMarks, practicalMarks });
    }
    if (remarks !== undefined) result.remarks = remarks;

    await result.save();
    new ApiResponse(200, true, 'Result updated successfully.', result).send(res);
  } catch (error) {
    next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    const totalResults = await Result.countDocuments();
    const publishedResults = await Result.countDocuments({ published: true });
    const passCount = await Result.countDocuments({ status: 'PASS' });
    const failCount = totalResults - passCount;
    const passPercentage = totalResults > 0 ? ((passCount / totalResults) * 100).toFixed(2) : 0;

    // Aggregate by course
    const courseStats = await Result.aggregate([
      { $group: { _id: '$course', total: { $sum: 1 }, passed: { $sum: { $cond: [{ $eq: ['$status', 'PASS'] }, 1, 0] } } } }
    ]);

    // Aggregate by district
    const districtStats = await Result.aggregate([
      { $group: { _id: '$district', total: { $sum: 1 }, passed: { $sum: { $cond: [{ $eq: ['$status', 'PASS'] }, 1, 0] } } } }
    ]);

    new ApiResponse(200, true, 'Analytics fetched.', {
      totalResults,
      publishedResults,
      passCount,
      failCount,
      passPercentage,
      courseStats,
      districtStats
    }).send(res);
  } catch (error) {
    next(error);
  }
};

exports.exportResults = async (req, res, next) => {
  try {
    const { status, district, course, published } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (district) query.district = district;
    if (course) query.course = course;
    if (published !== undefined) query.published = published === 'true';

    const results = await Result.find(query).lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Results');

    worksheet.columns = [
      { header: 'Roll Number', key: 'rollNumber', width: 20 },
      { header: 'Name', key: 'studentName', width: 25 },
      { header: 'CNIC', key: 'CNIC', width: 20 },
      { header: 'Course', key: 'course', width: 30 },
      { header: 'District', key: 'district', width: 20 },
      { header: 'Theory', key: 'theoryMarks', width: 10 },
      { header: 'Practical', key: 'practicalMarks', width: 10 },
      { header: 'Total', key: 'obtainedMarks', width: 10 },
      { header: '%', key: 'percentage', width: 10 },
      { header: 'Grade', key: 'grade', width: 10 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Published', key: 'published', width: 10 }
    ];

    worksheet.addRows(results);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=results_export.xlsx');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

// --- PUBLIC PORTAL ENDPOINTS ---

exports.getPublicResult = async (req, res, next) => {
  try {
    const { query } = req.params; // Roll Number or CNIC
    
    const result = await Result.findOne({
      $or: [{ rollNumber: query }, { CNIC: query }],
      published: true
    }).populate('candidateId', 'profileImage fatherName examAttended attendedAt');

    if (!result) {
      throw new ApiError(404, 'Result not found or not published yet.');
    }

    new ApiResponse(200, true, 'Result fetched.', result).send(res);
  } catch (error) {
    next(error);
  }
};

exports.getPublicResultPdf = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await Result.findOne({ _id: id, published: true }).populate('candidateId');
    
    if (!result) throw new ApiError(404, 'Result not found.');

    const hostUrl = `${req.protocol}://${req.get('host')}`; // Adjust if behind proxy
    const customHost = req.headers['x-forwarded-host'] ? `https://${req.headers['x-forwarded-host']}` : hostUrl;

    const pdfBuffer = await resultPdfService.generateResultCard(result, customHost);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ResultCard_${result.rollNumber}.pdf"`
    });

    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

exports.verifyResultByQr = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) throw new ApiError(400, 'Token is required.');

    const result = await Result.findOne({ resultQrToken: token, published: true });
    
    if (!result) {
      return new ApiResponse(404, false, 'Invalid QR code or result not published.').send(res);
    }

    new ApiResponse(200, true, 'Result verified successfully.', result).send(res);
  } catch (error) {
    next(error);
  }
};
