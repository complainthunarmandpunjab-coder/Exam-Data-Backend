const candidateRepository = require('../repositories/candidate.repository');
const { MasterUser, MasterChallan } = require('../config/db');
const ApiError = require('../utils/apiError');
const redisService = require('./redis.service');

class CandidateService {
  async register(candidateData) {
    const { fullName, fatherName, cnic, email, rollNumber } = candidateData;
    const trimmedCnic = cnic.trim();
    const trimmedRoll = rollNumber.trim();

    // Enforce one-time registration by checking local database for duplicate CNIC, Email, or Roll Number
    const existingLocal = await candidateRepository.findOne({
      $or: [
        { cnic: trimmedCnic },
        { email: email.toLowerCase().trim() },
        { rollNumber: trimmedRoll }
      ]
    });
    
    if (existingLocal) {
      if (existingLocal.cnic === trimmedCnic) {
        throw new ApiError(400, 'Registration failed: This CNIC is already registered.');
      }
      if (existingLocal.email === email.toLowerCase().trim()) {
        throw new ApiError(400, 'Registration failed: This Email is already registered.');
      }
      if (existingLocal.rollNumber === trimmedRoll) {
        throw new ApiError(400, 'Registration failed: This Roll Number is already registered.');
      }
      throw new ApiError(400, 'Registration failed: You have already registered.');
    }

    // Retrieve Student from Master Database matching cnic, email, OR rollNumber
    const masterUser = await MasterUser.findOne({
      $or: [
        { cnic: trimmedCnic },
        { email: email.toLowerCase().trim() },
        { rollNumber: trimmedRoll }
      ]
    });

    if (!masterUser) {
      throw new ApiError(450, 'Registration failed: CNIC, Email, or Roll Number not found in Master Portal.');
    }

    // Validate fields match strictly
    const fieldsToMatch = [
      { key: 'fullName', label: 'Full Name', value: fullName },
      { key: 'fatherName', label: "Father's Name", value: fatherName },
      { key: 'email', label: 'Email', value: email }
    ];

    const isMatch = fieldsToMatch.every(field => 
      String(masterUser[field.key]).toLowerCase().trim() === String(field.value).toLowerCase().trim()
    );

    if (!isMatch) {
      const mismatches = fieldsToMatch.filter(field => 
        String(masterUser[field.key]).toLowerCase().trim() !== String(field.value).toLowerCase().trim()
      ).map(m => m.label).join(', ');
      throw new ApiError(400, `Registration failed: Data Mismatch (${mismatches}) with Master Portal.`);
    }

    // Verify the selected course exists in the student's Master database courses array
    const selectedCourse = candidateData.course.toLowerCase().trim();
    const hasCourse = masterUser.courses && masterUser.courses.some(c => {
      const dbCourse = String(c).toLowerCase().trim();
      // Match if equal, or if either string contains the other (e.g., handles "PYTHON PROGRAMIING" vs "Python Programming for Everyone")
      return dbCourse.includes(selectedCourse) || selectedCourse.includes(dbCourse) ||
             dbCourse.replace(/[^a-z0-9]/g, '').includes(selectedCourse.replace(/[^a-z0-9]/g, '')) ||
             selectedCourse.replace(/[^a-z0-9]/g, '').includes(dbCourse.replace(/[^a-z0-9]/g, ''));
    });

    if (!hasCourse) {
      throw new ApiError(400, `Registration failed: Selected course "${candidateData.course}" does not match your enrolled courses in Master Portal.`);
    }

    // Enforce Enrollment Dates: 07 July 2025 to 31 March 2026
    const enrollmentDate = masterUser.createdAt ? new Date(masterUser.createdAt) : null;
    const startDate = new Date('2025-07-07T00:00:00.000Z');
    const endDate = new Date('2026-03-31T23:59:59.999Z');

    if (!enrollmentDate || enrollmentDate < startDate || enrollmentDate > endDate) {
      throw new ApiError(400, 'Registration failed: Only students enrolled between 07 July 2025 and 31 March 2026 are allowed.');
    }

    // Check payment status on Master DB
    const challan = await MasterChallan.findOne({
      $or: [
        { rollNumber: masterUser.rollNumber },
        { userId: masterUser._id.toString() }
      ],
      paid: true
    });

    if (!challan) {
      throw new ApiError(400, 'Registration failed: Payment not completed. Only paid students are allowed.');
    }

    // Extract district, tehsil, and institute if they exist in masterUser
    const district = masterUser.district || masterUser.city || '';
    const tehsil = masterUser.tehsil || '';
    const institute = masterUser.institute || masterUser.campus || '';

    const savedCandidate = await candidateRepository.create({
      ...candidateData,
      district,
      tehsil,
      institute,
      verificationStatus: 'verified'
    });

    // Invalidate Redis dashboard statistics and candidate list caches
    await redisService.invalidatePrefix('stats:');
    await redisService.invalidatePrefix('candidates:');

    return savedCandidate;
  }

  async getCandidates(filters, paginationOptions) {
    const cacheKey = `candidates:${JSON.stringify(filters)}:${JSON.stringify(paginationOptions)}`;
    
    // Check Redis cache first
    const cachedResult = await redisService.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const query = {};

    // Soft delete filtering
    if (filters.showDeleted === 'true' || filters.showDeleted === true) {
      query.isDeleted = true;
    } else {
      query.isDeleted = { $ne: true };
    }

    if (filters.gender && filters.gender !== 'All') {
      query.gender = { $regex: `^${filters.gender}$`, $options: 'i' };
    }
    if (filters.city && filters.city !== 'All') {
      query.city = { $regex: `^${filters.city}$`, $options: 'i' };
    }
    if (filters.district && filters.district !== 'All') {
      query.district = { $regex: `^${filters.district}$`, $options: 'i' };
    }
    if (filters.tehsil && filters.tehsil !== 'All') {
      query.tehsil = { $regex: `^${filters.tehsil}$`, $options: 'i' };
    }
    if (filters.institute && filters.institute !== 'All') {
      query.institute = { $regex: `^${filters.institute}$`, $options: 'i' };
    }
    if (filters.batch && filters.batch !== 'All') {
      query.batch = { $regex: `^${filters.batch}$`, $options: 'i' };
    }
    if (filters.verification && filters.verification !== 'All') {
      query.verificationStatus = { $regex: `^${filters.verification}$`, $options: 'i' };
    }
    if (filters.course && filters.course !== 'All') {
      query.course = { $regex: filters.course, $options: 'i' };
    }
    if (filters.status && filters.status !== 'All') {
      query.status = { $regex: `^${filters.status}$`, $options: 'i' };
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const term = filters.search.trim();
      if (/^\d/.test(term) || /^HP-/i.test(term)) {
        // CNICs, Roll Numbers, and Phone Numbers scan via prefix indexing (O(log N))
        query.$or = [
          { cnic: { $regex: `^${term}`, $options: 'i' } },
          { rollNumber: { $regex: `^${term}`, $options: 'i' } },
          { contactNumber: { $regex: `^${term}`, $options: 'i' } }
        ];
      } else {
        // Text index search for Names, Emails, Courses (O(1))
        query.$text = { $search: term };
      }
    }

    const sortOptions = {};
    if (filters.sortBy) {
      sortOptions[filters.sortBy] = filters.sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions.createdAt = -1;
    }

    const result = await candidateRepository.paginate(query, {
      ...paginationOptions,
      sort: sortOptions
    });

    // Cache the query result for 30 seconds to throttle high concurrency spikes
    await redisService.set(cacheKey, result, 30);

    return result;
  }

  async softDeleteCandidate(id) {
    const candidate = await candidateRepository.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { isDeleted: true, deletedAt: new Date() }
    );
    if (!candidate) {
      throw new ApiError(404, 'Candidate not found or already deleted');
    }
    await redisService.invalidatePrefix('stats:');
    await redisService.invalidatePrefix('candidates:');
    return candidate;
  }

  async restoreCandidate(id) {
    const candidate = await candidateRepository.findOneAndUpdate(
      { _id: id, isDeleted: true },
      { isDeleted: false, deletedAt: null }
    );
    if (!candidate) {
      throw new ApiError(404, 'Deleted candidate not found');
    }
    await redisService.invalidatePrefix('stats:');
    await redisService.invalidatePrefix('candidates:');
    return candidate;
  }

  async updateCandidate(id, updateData) {
    const candidate = await candidateRepository.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      updateData,
      { new: true }
    );
    if (!candidate) {
      throw new ApiError(404, 'Candidate not found or deleted');
    }
    await redisService.invalidatePrefix('stats:');
    await redisService.invalidatePrefix('candidates:');
    return candidate;
  }

  async bulkAction(action, ids, payload = {}) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ApiError(400, 'Invalid or empty list of candidate IDs');
    }

    let update = {};
    let query = { _id: { $in: ids } };

    if (action === 'softDelete') {
      update = { isDeleted: true, deletedAt: new Date() };
      query.isDeleted = { $ne: true };
    } else if (action === 'restore') {
      update = { isDeleted: false, deletedAt: null };
      query.isDeleted = true;
    } else if (action === 'updateStatus') {
      if (!payload.status) throw new ApiError(400, 'Status is required for status update');
      update = { status: payload.status };
    } else if (action === 'updateVerification') {
      if (!payload.verificationStatus) throw new ApiError(400, 'Verification status is required');
      update = { verificationStatus: payload.verificationStatus };
    } else {
      throw new ApiError(400, 'Invalid bulk action type');
    }

    const result = await candidateRepository.model.updateMany(query, update).exec();
    await redisService.invalidatePrefix('stats:');
    await redisService.invalidatePrefix('candidates:');
    return result;
  }

  async getReports(reportType, filters = {}) {
    const match = { isDeleted: { $ne: true } };

    if (filters.gender && filters.gender !== 'All') match.gender = { $regex: `^${filters.gender}$`, $options: 'i' };
    if (filters.city && filters.city !== 'All') match.city = { $regex: `^${filters.city}$`, $options: 'i' };
    if (filters.district && filters.district !== 'All') match.district = { $regex: `^${filters.district}$`, $options: 'i' };
    if (filters.tehsil && filters.tehsil !== 'All') match.tehsil = { $regex: `^${filters.tehsil}$`, $options: 'i' };
    if (filters.institute && filters.institute !== 'All') match.institute = { $regex: `^${filters.institute}$`, $options: 'i' };
    if (filters.batch && filters.batch !== 'All') match.batch = { $regex: `^${filters.batch}$`, $options: 'i' };
    if (filters.verification && filters.verification !== 'All') match.verificationStatus = { $regex: `^${filters.verification}$`, $options: 'i' };
    if (filters.course && filters.course !== 'All') match.course = { $regex: filters.course, $options: 'i' };
    if (filters.status && filters.status !== 'All') match.status = { $regex: `^${filters.status}$`, $options: 'i' };
    
    if (filters.startDate || filters.endDate) {
      match.createdAt = {};
      if (filters.startDate) match.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) match.createdAt.$lte = new Date(filters.endDate);
    }

    let pipeline = [];
    if (reportType === 'district') {
      pipeline = [
        { $match: match },
        { $group: { _id: '$district', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ];
    } else if (reportType === 'course') {
      pipeline = [
        { $match: match },
        { $group: { _id: '$course', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ];
    } else if (reportType === 'institute') {
      pipeline = [
        { $match: match },
        { $group: { _id: '$institute', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 }
      ];
    } else if (reportType === 'registration') {
      pipeline = [
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ];
    } else if (reportType === 'monthly') {
      pipeline = [
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ];
    } else if (reportType === 'custom') {
      const groupByField = filters.groupBy || 'course';
      const allowedFields = ['district', 'city', 'tehsil', 'institute', 'course', 'gender', 'batch', 'status', 'verificationStatus'];
      if (!allowedFields.includes(groupByField)) {
        throw new ApiError(400, 'Invalid custom report grouping field');
      }
      pipeline = [
        { $match: match },
        { $group: { _id: `$${groupByField}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ];
    } else {
      throw new ApiError(400, 'Invalid report type');
    }

    return candidateRepository.model.aggregate(pipeline).exec();
  }

  async getDashboardStats() {
    const cacheKey = 'stats:dashboard';
    
    // Check Redis cache first
    const cachedStats = await redisService.get(cacheKey);
    if (cachedStats) {
      return cachedStats;
    }

    // Date ranges for aggregation pipelines
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [
      totalCandidates,
      verifiedCount,
      pendingCount,
      citiesBreakdown,
      districtsBreakdown,
      coursesBreakdown,
      institutesBreakdown,
      dailyRegistrations,
      monthlyRegistrations
    ] = await Promise.all([
      candidateRepository.countDocuments({ isDeleted: { $ne: true } }),
      candidateRepository.countDocuments({ verificationStatus: 'verified', isDeleted: { $ne: true } }),
      candidateRepository.countDocuments({ status: 'Pending', isDeleted: { $ne: true } }),
      
      // Preferred Exam Cities Breakdown
      candidateRepository.model.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$preferredExamCity', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec(),

      // Districts Breakdown
      candidateRepository.model.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$district', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).exec(),

      // Courses Breakdown
      candidateRepository.model.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$course', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).exec(),

      // Institutes Breakdown
      candidateRepository.model.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        { $group: { _id: '$institute', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]).exec(),

      // Daily Registrations (Last 30 Days)
      candidateRepository.model.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo }, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).exec(),

      // Monthly Registrations (Last 12 Months)
      candidateRepository.model.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo }, isDeleted: { $ne: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).exec()
    ]);

    const stats = {
      totalCandidates,
      verifiedCount,
      pendingCount,
      citiesBreakdown,
      districtsBreakdown,
      coursesBreakdown,
      institutesBreakdown,
      dailyRegistrations,
      monthlyRegistrations
    };

    // Cache the result for 10 minutes (600 seconds)
    await redisService.set(cacheKey, stats, 600);

    return stats;
  }
}

module.exports = new CandidateService();
