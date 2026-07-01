const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    cnic: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    contactNumber: { type: String, required: true, trim: true },
    gender: { type: String, required: true },
    city: { type: String, required: true, trim: true },
    preferredExamCity: { type: String, required: true, trim: true },
    district: { type: String, default: '', trim: true },
    tehsil: { type: String, default: '', trim: true },
    institute: { type: String, default: '', trim: true },
    batch: { type: String, required: true, default: 'Batch 1' },
    course: { type: String, required: true },
    rollNumber: { type: String, required: true, trim: true },
    profileImage: { type: String, default: '' },
    examSeqNumber: { type: Number, default: 0 },
    verificationStatus: { type: String, default: 'unverified' },
    status: { type: String, default: 'Pending' },
    qrSecureToken: { type: String, unique: true, sparse: true },
    examAttended: { type: Boolean, default: false },
    attendedAt: { type: Date, default: null },
    slipGenerated: { type: Boolean, default: false },
    slipGeneratedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
}, { timestamps: true });

// Optimized Compound & Single Indexes for 100k+ records
candidateSchema.index({ fullName: 1 });
candidateSchema.index({ rollNumber: 1 });
candidateSchema.index({ email: 1 });
candidateSchema.index({ verificationStatus: 1 });
candidateSchema.index({ batch: 1 });
candidateSchema.index({ preferredExamCity: 1 });
candidateSchema.index({ district: 1 });
candidateSchema.index({ tehsil: 1 });
candidateSchema.index({ institute: 1 });
candidateSchema.index({ district: 1, tehsil: 1, institute: 1 });
candidateSchema.index({ status: 1 });
candidateSchema.index({ isDeleted: 1 });
candidateSchema.index({ qrSecureToken: 1 });
candidateSchema.index({ slipGenerated: 1 });
candidateSchema.index({ createdAt: -1 });

// Compound Index for compound searching & filtering performance
candidateSchema.index({ verificationStatus: 1, batch: 1, preferredExamCity: 1 });

// Text indexing for admin dashboard unified search
candidateSchema.index({
  fullName: 'text',
  cnic: 'text',
  rollNumber: 'text',
  email: 'text'
}, {
  name: 'CandidateTextSearchIndex',
  weights: {
    fullName: 10,
    rollNumber: 5,
    cnic: 5,
    email: 2
  }
});

module.exports = mongoose.model('Candidate', candidateSchema);
