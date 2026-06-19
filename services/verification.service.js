const verificationRepository = require('../repositories/verification.repository');
const { MasterUser, MasterChallan } = require('../config/db');

class VerificationService {
  async verifyStudent(verificationData) {
    const { fullName, fatherName, cnic, email, course, rollNumber } = verificationData;

    const masterUser = await MasterUser.findOne({
      cnic: cnic.trim(),
      rollNumber: rollNumber.trim()
    });

    let verificationStatus = 'unverified';
    let reason = '';
    let matched = false;
    let paymentStatus = 'unknown';

    if (!masterUser) {
      reason = 'Data Mismatch (Identity not found in Master Portal)';
    } else {
      const fieldsToMatch = [
        { key: 'fullName', label: 'Full Name', value: fullName },
        { key: 'fatherName', label: "Father's Name", value: fatherName },
        { key: 'email', label: 'Email', value: email }
      ];

      const mismatches = fieldsToMatch.filter(field => 
        String(masterUser[field.key]).toLowerCase().trim() !== String(field.value).toLowerCase().trim()
      );

      if (mismatches.length > 0) {
        reason = `Data Mismatch (${mismatches.map(m => m.label).join(', ')})`;
      } else {
        // Enforce Enrollment Dates: 07 July 2025 to 31 March 2026
        const enrollmentDate = masterUser.createdAt ? new Date(masterUser.createdAt) : null;
        const startDate = new Date('2025-07-07T00:00:00.000Z');
        const endDate = new Date('2026-03-31T23:59:59.999Z');

        if (!enrollmentDate || enrollmentDate < startDate || enrollmentDate > endDate) {
          reason = 'Enrollment Period Out of Range (Only 07 July 2025 to 31 March 2026 allowed)';
        } else {
          // Check payment status on Master DB
          const challan = await MasterChallan.findOne({
            $or: [
              { rollNumber: masterUser.rollNumber },
              { userId: masterUser._id.toString() }
            ],
            paid: true
          });

          if (!challan) {
            paymentStatus = 'unpaid';
            reason = 'Payment Not Completed (Challan not found or unpaid)';
          } else {
            paymentStatus = 'paid';
            verificationStatus = 'verified';
            matched = true;
          }
        }
      }
    }

    const savedVerification = await verificationRepository.create({
      fullName,
      fatherName,
      cnic,
      email,
      course,
      rollNumber,
      verificationStatus,
      paymentStatus,
      reason
    });

    return {
      verified: matched,
      status: verificationStatus,
      reason,
      data: savedVerification
    };
  }

  async getVerificationLogs(filters, paginationOptions) {
    const query = {};

    if (filters.status && filters.status !== 'All') {
      query.verificationStatus = filters.status.toLowerCase();
    }
    if (filters.payment && filters.payment !== 'All') {
      query.paymentStatus = filters.payment.toLowerCase();
    }
    if (filters.search) {
      query.$or = [
        { fullName: { $regex: filters.search, $options: 'i' } },
        { cnic: { $regex: filters.search, $options: 'i' } },
        { rollNumber: { $regex: filters.search, $options: 'i' } }
      ];
    }

    return verificationRepository.paginate(query, paginationOptions);
  }
}

module.exports = new VerificationService();
