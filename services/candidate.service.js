const candidateRepository = require('../repositories/candidate.repository');
const { MasterUser, MasterChallan } = require('../config/db');
const ApiError = require('../utils/apiError');
const redisService = require('./redis.service');

class CandidateService {
  constructor() {
    // Delay backfill so MongoDB has time to connect first
    setTimeout(() => {
      this.backfillQR().catch(err => console.error('[Backfill Error]', err));
    }, 8000);
  }

  async backfillQR() {
    try {
      const candidates = await candidateRepository.find({ qrSecureToken: { $exists: false } });
      if (candidates.length > 0) {
        const crypto = require('crypto');
        console.log(`[Backfill] Found ${candidates.length} candidates without qrSecureToken. Backfilling now...`);
        for (const candidate of candidates) {
          const qrSecureToken = crypto.randomBytes(16).toString('hex');
          await candidateRepository.updateOne({ _id: candidate._id }, { qrSecureToken });
        }
        console.log(`[Backfill] Backfilled ${candidates.length} candidates successfully.`);
      }
    } catch (err) {
      // Silently skip if DB not ready yet — not critical for startup
      console.warn('[Backfill] Skipped (DB not ready):', err.message);
    }
  }

  async register(candidateData) {
    const { fullName, fatherName, cnic, email, rollNumber } = candidateData;
    const trimmedCnic = cnic.trim();
    const trimmedRoll = rollNumber.trim();

    // Flexible CNIC match (with or without dashes)
    const inputCnicClean = String(trimmedCnic).replace(/[^0-9]/g, '');
    const pattern = inputCnicClean.split('').join('-?');
    const regex = new RegExp(`^${pattern}$`);

    // Check local Exam DB to prevent duplicate registration
    const existingLocal = await candidateRepository.findOne({
      $or: [
        { cnic: { $regex: regex } },
        { rollNumber: trimmedRoll }
      ]
    });

    if (existingLocal) {
      const existingCnicClean = String(existingLocal.cnic).replace(/[^0-9]/g, '');
      if (existingCnicClean === inputCnicClean) {
        throw new ApiError(400, 'You have already submitted your form successfully. (آپ پہلے ہی کامیابی کے ساتھ فارم جمع کروا چکے ہیں، آپ دوبارہ اپلائی نہیں کر سکتے)');
      }
      if (existingLocal.rollNumber === trimmedRoll) {
        throw new ApiError(400, 'You have already submitted your form successfully. (آپ پہلے ہی کامیابی کے ساتھ فارم جمع کروا چکے ہیں، آپ دوبارہ اپلائی نہیں کر سکتے)');
      }
      throw new ApiError(400, 'You have already submitted your form successfully.');
    }

    const masterUser = await MasterUser.findOne({ cnic: { $regex: regex } });

    if (!masterUser) {
      throw new ApiError(450, 'Registration failed: Your CNIC does not match with the Hunarmand Punjab database. Please enter the same CNIC that you used at the time of admission. (آپ کا شناختی کارڈ ہنرمند پنجاب کے ریکارڈ سے میچ نہیں کر رہا، براہ کرم وہی شناختی کارڈ درج کریں جو آپ نے داخلے کے وقت دیا تھا)');
    }

    // Validate fields match strictly (ignoring dashes)
    const dbCnicClean = String(masterUser.cnic).replace(/[^0-9]/g, '');


    if (dbCnicClean !== inputCnicClean) {
      throw new ApiError(400, 'Registration failed: The CNIC you entered is wrong. (آپ نے غلط شناختی کارڈ نمبر درج کیا ہے، برائے مہربانی درست شناختی کارڈ لکھیں)');
    }

    // Verify the selected course exists in the student's Master database courses array
    const selectedCourse = candidateData.course.toLowerCase().trim();

    // Support both 'courses' (Array) and 'course' (String) fields from Master DB
    let studentCourses = [];
    if (masterUser.courses && Array.isArray(masterUser.courses)) {
      studentCourses = masterUser.courses;
    } else if (masterUser.course) {
      studentCourses = [masterUser.course];
    } else if (masterUser.courses && typeof masterUser.courses === 'string') {
      studentCourses = [masterUser.courses];
    }

    const hasCourse = studentCourses.length > 0 && studentCourses.some(c => {
      const dbCourse = String(c).toLowerCase().trim();
      // Match if equal, or if either string contains the other (e.g., handles "PYTHON PROGRAMIING" vs "Python Programming for Everyone")
      return dbCourse.includes(selectedCourse) || selectedCourse.includes(dbCourse) ||
        dbCourse.replace(/[^a-z0-9]/g, '').includes(selectedCourse.replace(/[^a-z0-9]/g, '')) ||
        selectedCourse.replace(/[^a-z0-9]/g, '').includes(dbCourse.replace(/[^a-z0-9]/g, ''));
    });

    if (!hasCourse) {
      throw new ApiError(400, `Registration failed: You selected the wrong course. You are not enrolled in "${candidateData.course}". (آپ نے غلط کورس کا انتخاب کیا ہے، برائے مہربانی اپنا درست کورس منتخب کریں)`);
    }

    // Enforce Enrollment Dates: 07 July 2025 to 31 March 2026
    const enrollmentDate = masterUser.createdAt ? new Date(masterUser.createdAt) : null;
    const startDate = new Date('2025-07-07T00:00:00.000Z');
    const endDate = new Date('2026-03-31T23:59:59.999Z');

    if (!enrollmentDate || enrollmentDate < startDate || enrollmentDate > endDate) {
      throw new ApiError(400, 'Registration failed: Only students enrolled between 07 July 2025 and 31 March 2026 are allowed. (صرف 07 جولائی 2025 سے 31 مارچ 2026 کے درمیان داخلہ لینے والے طلباء اپلائی کر سکتے ہیں)');
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
      throw new ApiError(400, 'Registration failed: Payment not completed. Only paid students are allowed. (آپ کی فیس ادا نہیں کی گئی، صرف فیس ادا کرنے والے طلباء اپلائی کر سکتے ہیں)');
    }

    // Extract district, tehsil, and institute if they exist in masterUser
    const district = masterUser.district || masterUser.city || '';
    const tehsil = masterUser.tehsil || '';
    const institute = masterUser.institute || masterUser.campus || '';

    // Handle profile image — store base64 directly or keep URL/path
    let imagePath = '';
    if (candidateData.profileImage) {
      if (candidateData.profileImage.startsWith('data:image') || candidateData.profileImage.startsWith('http') || candidateData.profileImage.startsWith('/')) {
        imagePath = candidateData.profileImage;
      } else {
        imagePath = candidateData.profileImage; // default keep it
      }
    }

    const crypto = require('crypto');
    const qrSecureToken = crypto.randomBytes(16).toString('hex');

    // Sequence number will be assigned at slip generation time
    const examSeqNumber = 0;

    const savedCandidate = await candidateRepository.create({
      ...candidateData,
      cnic: inputCnicClean,
      profileImage: imagePath,
      district,
      tehsil,
      institute,
      qrSecureToken,
      examSeqNumber,
      verificationStatus: 'verified'
    });

    // Removed automatic cache invalidation to prevent Redis KEYS command blocking under high load.
    // Dashboard cache will naturally expire every 10 minutes or admin can manually force-sync.

    return savedCandidate;
  }

  async adminRegisterCandidate(candidateData) {
    const { cnic, rollNumber, email } = candidateData;
    const trimmedCnic = cnic.trim();
    const trimmedRoll = rollNumber.trim();

    // Flexible CNIC match
    const inputCnicClean = String(trimmedCnic).replace(/[^0-9]/g, '');
    const pattern = inputCnicClean.split('').join('-?');
    const regex = new RegExp(`^${pattern}$`);

    // Check local Exam DB to prevent duplicate registration
    const existingLocal = await candidateRepository.findOne({
      $or: [
        { cnic: { $regex: regex } },
        { rollNumber: trimmedRoll }
      ]
    });

    if (existingLocal) {
      const existingCnicClean = String(existingLocal.cnic).replace(/[^0-9]/g, '');
      if (existingCnicClean === inputCnicClean) {
        throw new ApiError(400, 'This CNIC is already registered in the system.');
      }
      if (existingLocal.rollNumber === trimmedRoll) {
        throw new ApiError(400, 'This Roll Number is already registered in the system.');
      }
      throw new ApiError(400, 'Student already registered.');
    }

    let imagePath = candidateData.profileImage || '';

    const crypto = require('crypto');
    const qrSecureToken = crypto.randomBytes(16).toString('hex');

    // Sequence number will be assigned at slip generation time
    const examSeqNumber = 0;

    // Save directly without Master DB checks
    const savedCandidate = await candidateRepository.create({
      ...candidateData,
      cnic: inputCnicClean,
      profileImage: imagePath,
      qrSecureToken,
      examSeqNumber,
      verificationStatus: 'verified',
      // Since it is an admin force-add, we set these as empty or derived if available
      district: candidateData.city || '',
      tehsil: '',
      institute: ''
    });

    // Removed automatic cache invalidation to prevent Redis blocking
    return savedCandidate;
  }

  async getCandidateByCnic(cnic) {
    // Yeh line student ka bheja hua data terminal par print karegi
    console.log("=== SLIP REQUEST ===", { cnic: cnic });

    // CNIC ko string aur number dono shaklon mein convert karein
    const cnicString = String(cnic).trim();
    const cleanCnic = cnicString.replace(/[^0-9]/g, ''); // Saare dashes mita kar sirf number
    const cnicNumber = Number(cleanCnic);

    // Ab database mein sirf clean cnic se dhoondein (script already sari dashes remove kar de gi)
    return await candidateRepository.findOne({
      $or: [
        { cnic: cleanCnic },
        { cnic: cnicNumber },
        { cnic: cnicString }, // Fallback in case migration script hasn't run on everything
        { cnic: { $regex: cleanCnic, $options: 'i' } }
      ],
      isDeleted: { $ne: true }
    });
  }

  // QR scan: find by token, mark attended if admin, return safe student data
  async verifyByQrToken(token, isAdmin = false) {
    const candidate = await candidateRepository.findOne({
      qrSecureToken: token,
      isDeleted: { $ne: true }
    });
    if (!candidate) return null;

    let justMarked = false;

    // Mark as attended if not already AND if it is an admin scanning
    if (isAdmin && !candidate.examAttended) {
      await candidateRepository.updateOne(
        { _id: candidate._id },
        { examAttended: true, attendedAt: new Date() }
      );
      candidate.examAttended = true;
      candidate.attendedAt = new Date();
      justMarked = true;
    }

    const getCourseInitials = (courseName) => {
      if (!courseName) return 'EXAM';
      const words = courseName.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 0);
      if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
      return words.map(w => w[0].toUpperCase()).join('').substring(0, 4);
    };

    const courseInitials = getCourseInitials(candidate.course);
    const seqNum = String(candidate.examSeqNumber || 1).padStart(5, '0');
    const examId = `HP-EXAM-${courseInitials}-${seqNum}`;
    const examCenter = 'Punjab University, Lahore';

    // Return only safe fields (no base64 image in response for speed)
    return {
      _id: candidate._id,
      fullName: candidate.fullName,
      fatherName: candidate.fatherName,
      cnic: candidate.cnic,
      rollNumber: candidate.rollNumber,
      course: candidate.course,
      batch: candidate.batch,
      gender: candidate.gender,
      city: candidate.city,
      profileImage: candidate.profileImage || null,
      examAttended: candidate.examAttended,
      attendedAt: candidate.attendedAt,
      alreadyAttended: candidate.examAttended && !justMarked,
      justMarked: justMarked,
      isAdminScan: isAdmin,
      verificationStatus: candidate.verificationStatus,
      examId,
      examCenter
    };
  }

  async assignExamSeqNumber(id, course) {
    // Check if the candidate already has an assigned sequence number
    const candidate = await candidateRepository.findById(id);
    if (!candidate) return null;
    if (candidate.examSeqNumber && candidate.examSeqNumber > 0) {
      return candidate; // Already assigned
    }

    const Counter = require('../models/counter.model');

    // Atomically increment the sequence number for this specific course
    const counterId = `course_${course}`;
    const counterDoc = await Counter.findByIdAndUpdate(
      { _id: counterId },
      { $inc: { sequence_value: 1 } },
      { returnDocument: 'after', upsert: true }
    );

    const nextSeq = counterDoc.sequence_value;

    // Assign the sequence number (only if it's still 0)
    const updatedCandidate = await candidateRepository.findOneAndUpdate(
      { _id: id, examSeqNumber: { $in: [0, null] }, isDeleted: { $ne: true } },
      { $set: { examSeqNumber: nextSeq } },
      { returnDocument: 'after' }
    );

    return updatedCandidate || candidate;
  }

  async markSlipGenerated(id) {
    const candidate = await candidateRepository.findOneAndUpdate(
      { _id: id, isDeleted: { $ne: true } },
      { $set: { slipGenerated: true, slipGeneratedAt: new Date() } },
      { returnDocument: 'after' }
    );
    if (candidate) {
      console.log('Slip generated marked for', id);
      // Removed automatic cache invalidation to prevent Redis KEYS command blocking under load
      // await redisService.invalidatePrefix('stats:');
      // await redisService.invalidatePrefix('candidates:');
    } else {
      console.log('Failed to find candidate to mark slip generated:', id);
    }
    return candidate;
  }

  // Admin: all students who scanned QR and attended exam
  async getAttendedCandidates() {
    return await candidateRepository.find(
      { examAttended: true, isDeleted: { $ne: true } },
      { sort: { attendedAt: -1 } }
    );
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

    const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    if (filters.gender && filters.gender !== 'All') {
      query.gender = { $regex: `^${escapeRegex(filters.gender)}$`, $options: 'i' };
    }
    if (filters.city && filters.city !== 'All') {
      query.city = { $regex: `^${escapeRegex(filters.city)}$`, $options: 'i' };
    }
    if (filters.email && filters.email.trim() !== '') {
      query.email = { $regex: escapeRegex(filters.email.trim()), $options: 'i' };
    }
    if (filters.phone && filters.phone.trim() !== '') {
      query.contactNumber = { $regex: escapeRegex(filters.phone.trim()), $options: 'i' };
    }
    if (filters.preferredExamCity && filters.preferredExamCity !== 'All') {
      query.preferredExamCity = { $regex: `^${escapeRegex(filters.preferredExamCity)}$`, $options: 'i' };
    }
    if (filters.district && filters.district !== 'All') {
      query.district = { $regex: `^${escapeRegex(filters.district)}$`, $options: 'i' };
    }
    if (filters.tehsil && filters.tehsil !== 'All') {
      query.tehsil = { $regex: `^${escapeRegex(filters.tehsil)}$`, $options: 'i' };
    }
    if (filters.institute && filters.institute !== 'All') {
      query.institute = { $regex: `^${escapeRegex(filters.institute)}$`, $options: 'i' };
    }
    if (filters.batch && filters.batch !== 'All') {
      query.batch = { $regex: `^${escapeRegex(filters.batch)}$`, $options: 'i' };
    }
    if (filters.verification && filters.verification !== 'All') {
      query.verificationStatus = { $regex: `^${escapeRegex(filters.verification)}$`, $options: 'i' };
    }
    if (filters.course && filters.course !== 'All') {
      query.course = { $regex: escapeRegex(filters.course), $options: 'i' };
    }
    if (filters.status && filters.status !== 'All') {
      query.status = { $regex: `^${escapeRegex(filters.status)}$`, $options: 'i' };
    }

    if (filters.slipGenerated === 'true' || filters.slipGenerated === true) {
      query.slipGenerated = true;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    if (filters.search) {
      const term = filters.search.trim();
      query.$or = [
        { fullName: { $regex: term, $options: 'i' } },
        { rollNumber: { $regex: term, $options: 'i' } },
        { cnic: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { contactNumber: { $regex: term, $options: 'i' } }
      ];
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

    const escapeRegex = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    if (filters.gender && filters.gender !== 'All') match.gender = { $regex: `^${escapeRegex(filters.gender)}$`, $options: 'i' };
    if (filters.city && filters.city !== 'All') match.city = { $regex: `^${escapeRegex(filters.city)}$`, $options: 'i' };
    if (filters.preferredExamCity && filters.preferredExamCity !== 'All') match.preferredExamCity = { $regex: `^${escapeRegex(filters.preferredExamCity)}$`, $options: 'i' };
    if (filters.district && filters.district !== 'All') match.district = { $regex: `^${escapeRegex(filters.district)}$`, $options: 'i' };
    if (filters.tehsil && filters.tehsil !== 'All') match.tehsil = { $regex: `^${escapeRegex(filters.tehsil)}$`, $options: 'i' };
    if (filters.institute && filters.institute !== 'All') match.institute = { $regex: `^${escapeRegex(filters.institute)}$`, $options: 'i' };
    if (filters.batch && filters.batch !== 'All') match.batch = { $regex: `^${escapeRegex(filters.batch)}$`, $options: 'i' };
    if (filters.verification && filters.verification !== 'All') match.verificationStatus = { $regex: `^${escapeRegex(filters.verification)}$`, $options: 'i' };
    if (filters.course && filters.course !== 'All') match.course = { $regex: escapeRegex(filters.course), $options: 'i' };
    if (filters.status && filters.status !== 'All') match.status = { $regex: `^${escapeRegex(filters.status)}$`, $options: 'i' };

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
    } else if (reportType === 'slipGeneratedByCourse') {
      match.slipGenerated = true;
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

    const statsAggregation = await candidateRepository.model.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $facet: {
          totalCandidates: [{ $count: "count" }],
          verifiedCount: [
            { $match: { verificationStatus: 'verified' } },
            { $count: "count" }
          ],
          pendingCount: [
            { $match: { status: 'Pending' } },
            { $count: "count" }
          ],
          citiesBreakdown: [
            { $group: { _id: '$preferredExamCity', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          districtsBreakdown: [
            { $group: { _id: '$district', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          coursesBreakdown: [
            { $group: { _id: '$course', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          institutesBreakdown: [
            { $group: { _id: '$institute', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          dailyRegistrations: [
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          monthlyRegistrations: [
            { $match: { createdAt: { $gte: twelveMonthsAgo } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]).exec();

    const facetResult = statsAggregation[0] || {};

    const stats = {
      totalCandidates: facetResult.totalCandidates?.[0]?.count || 0,
      verifiedCount: facetResult.verifiedCount?.[0]?.count || 0,
      pendingCount: facetResult.pendingCount?.[0]?.count || 0,
      citiesBreakdown: facetResult.citiesBreakdown || [],
      districtsBreakdown: facetResult.districtsBreakdown || [],
      coursesBreakdown: facetResult.coursesBreakdown || [],
      institutesBreakdown: facetResult.institutesBreakdown || [],
      dailyRegistrations: facetResult.dailyRegistrations || [],
      monthlyRegistrations: facetResult.monthlyRegistrations || []
    };

    // Cache the result for 10 minutes (600 seconds)
    await redisService.set(cacheKey, stats, 600);

    return stats;
  }

  async clearAllCaches() {
    await redisService.invalidatePrefix('stats:');
    await redisService.invalidatePrefix('candidates:');
    return true;
  }
}

module.exports = new CandidateService();
