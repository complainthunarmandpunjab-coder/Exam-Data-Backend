const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const candidateRepository = require('../repositories/candidate.repository');
const ExportJob = require('../models/exportJob.model');
const logger = require('../config/logger');

class ExportService {
  async createExportJob(adminUsername, filters) {
    const job = await ExportJob.create({
      adminUsername,
      filters,
      status: 'pending',
      progress: 0,
      format: 'xlsx'
    });

    // Run export process in background (do not await)
    this.processExportJob(job._id).catch(err => {
      logger.error(`Export Job ${job._id} failed in background: ${err.message}`);
    });

    return job;
  }

  async processExportJob(jobId) {
    const job = await ExportJob.findById(jobId);
    if (!job) return;

    try {
      job.status = 'processing';
      await job.save();

      // Setup directories
      const exportsDir = path.join(__dirname, '../public/exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const fileName = `export_${jobId}_${Date.now()}.xlsx`;
      const filePath = path.join(exportsDir, fileName);

      // Options for WorkbookWriter (Streaming)
      const options = {
        filename: filePath,
        useStyles: true,
        useSharedStrings: true
      };
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(options);
      const worksheet = workbook.addWorksheet('Enrolled Candidates');

      // Define Columns with headers
      worksheet.columns = [
        { header: 'Full Name', key: 'fullName', width: 25 },
        { header: 'Father Name', key: 'fatherName', width: 25 },
        { header: 'CNIC', key: 'cnic', width: 18 },
        { header: 'Email', key: 'email', width: 25 },
        { header: 'Contact', key: 'contactNumber', width: 15 },
        { header: 'Gender', key: 'gender', width: 10 },
        { header: 'City', key: 'city', width: 15 },
        { header: 'Preferred Exam City', key: 'preferredExamCity', width: 20 },
        { header: 'District', key: 'district', width: 20 },
        { header: 'Tehsil', key: 'tehsil', width: 20 },
        { header: 'Institute', key: 'institute', width: 30 },
        { header: 'Batch', key: 'batch', width: 12 },
        { header: 'Course', key: 'course', width: 20 },
        { header: 'Roll Number', key: 'rollNumber', width: 15 },
        { header: 'Verification Status', key: 'verificationStatus', width: 15 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Created At', key: 'createdAt', width: 22 }
      ];

      // Format Header style to feel premium
      worksheet.getRow(1).font = { name: 'Arial', family: 4, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00703A' } // Sleek Emerald Green theme
      };

      // Map filters to Mongo query (exclude soft deleted records by default)
      const query = { isDeleted: { $ne: true } };
      const { filters } = job;
      
      if (filters.gender && filters.gender !== 'All') query.gender = { $regex: `^${filters.gender}$`, $options: 'i' };
      if (filters.city && filters.city !== 'All') query.city = { $regex: `^${filters.city}$`, $options: 'i' };
      if (filters.district && filters.district !== 'All') query.district = { $regex: `^${filters.district}$`, $options: 'i' };
      if (filters.tehsil && filters.tehsil !== 'All') query.tehsil = { $regex: `^${filters.tehsil}$`, $options: 'i' };
      if (filters.institute && filters.institute !== 'All') query.institute = { $regex: `^${filters.institute}$`, $options: 'i' };
      if (filters.batch && filters.batch !== 'All') query.batch = { $regex: `^${filters.batch}$`, $options: 'i' };
      if (filters.verification && filters.verification !== 'All') query.verificationStatus = { $regex: `^${filters.verification}$`, $options: 'i' };
      if (filters.course && filters.course !== 'All') query.course = { $regex: filters.course, $options: 'i' };
      if (filters.status && filters.status !== 'All') query.status = { $regex: `^${filters.status}$`, $options: 'i' };
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
        if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
      }
      if (filters.search) {
        query.$or = [
          { fullName: { $regex: filters.search, $options: 'i' } },
          { cnic: { $regex: filters.search, $options: 'i' } },
          { rollNumber: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } },
          { contactNumber: { $regex: filters.search, $options: 'i' } },
          { institute: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const totalCount = await candidateRepository.countDocuments(query);
      if (totalCount === 0) {
        worksheet.addRow({ fullName: 'No records found matching criteria.' }).commit();
        await workbook.commit();
        job.status = 'completed';
        job.progress = 100;
        job.fileUrl = `/exports/${fileName}`;
        job.completedAt = new Date();
        await job.save();
        return;
      }

      // Query database using stream cursor for optimal memory
      const cursor = candidateRepository.model.find(query).lean().cursor();
      
      let processed = 0;
      let lastProgressUpdate = 0;

      for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        worksheet.addRow({
          fullName: doc.fullName,
          fatherName: doc.fatherName,
          cnic: doc.cnic,
          email: doc.email,
          contactNumber: doc.contactNumber,
          gender: doc.gender,
          city: doc.city,
          preferredExamCity: doc.preferredExamCity,
          district: doc.district || '',
          tehsil: doc.tehsil || '',
          institute: doc.institute || '',
          batch: doc.batch || '',
          course: doc.course,
          rollNumber: doc.rollNumber,
          verificationStatus: doc.verificationStatus,
          status: doc.status,
          createdAt: doc.createdAt ? doc.createdAt.toISOString() : ''
        }).commit();

        processed++;
        const currentProgress = Math.round((processed / totalCount) * 100);
        
        // Batch progress updates every 5% to avoid high DB write lock
        if (currentProgress - lastProgressUpdate >= 5) {
          job.progress = currentProgress;
          await job.save();
          lastProgressUpdate = currentProgress;
        }
      }

      // Finalize the Excel Workbook
      await workbook.commit();

      // Finalize job status
      job.status = 'completed';
      job.progress = 100;
      job.fileUrl = `/exports/${fileName}`;
      job.completedAt = new Date();
      await job.save();

      logger.info(`✓ Export Job ${jobId} completed successfully. ${processed} records exported.`);
    } catch (error) {
      logger.error(`❌ Export Job ${jobId} failed: ${error.message}`);
      job.status = 'failed';
      job.error = error.message;
      await job.save();
    }
  }

  async getExportJobs(adminUsername) {
    return ExportJob.find({ adminUsername }).sort({ createdAt: -1 }).limit(10).lean();
  }
}

module.exports = new ExportService();
