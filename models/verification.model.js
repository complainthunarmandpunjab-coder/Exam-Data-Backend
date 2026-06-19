const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
    fullName: { type: String, required: true, trim: true },
    fatherName: { type: String, required: true, trim: true },
    cnic: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    course: { type: String, required: true },
    rollNumber: { type: String, required: true, trim: true },
    verificationStatus: { type: String, enum: ['verified', 'unverified'], default: 'unverified' },
    paymentStatus: { type: String },
    verifiedAt: { type: Date, default: Date.now },
    reason: { type: String }
}, { timestamps: true });

// Optimized indexes for auditing/reports
verificationSchema.index({ cnic: 1 });
verificationSchema.index({ rollNumber: 1 });
verificationSchema.index({ verificationStatus: 1 });
verificationSchema.index({ paymentStatus: 1 });
verificationSchema.index({ createdAt: -1 });

// Text Index for Admin search on verification logs
verificationSchema.index({
  fullName: 'text',
  cnic: 'text',
  rollNumber: 'text'
});

module.exports = mongoose.model('Verification', verificationSchema);
