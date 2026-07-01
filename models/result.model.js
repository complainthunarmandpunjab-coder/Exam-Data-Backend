const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true
  },
  rollNumber: {
    type: String,
    required: true,
    index: true
  },
  studentName: {
    type: String,
    required: true
  },
  CNIC: {
    type: String,
    required: true,
    index: true
  },
  course: {
    type: String,
    required: true,
    index: true
  },
  district: {
    type: String,
    required: true,
    index: true
  },
  institute: {
    type: String
  },
  theoryMarks: {
    type: Number,
    required: true,
    min: 0
  },
  practicalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  obtainedMarks: {
    type: Number,
    required: true,
    min: 0
  },
  totalMarks: {
    type: Number,
    required: true,
    min: 0
  },
  percentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  grade: {
    type: String,
    required: true,
    enum: ['A+', 'A', 'B', 'C', 'FAIL']
  },
  status: {
    type: String,
    required: true,
    enum: ['PASS', 'FAIL']
  },
  remarks: {
    type: String,
    default: ''
  },
  published: {
    type: Boolean,
    default: false,
    index: true
  },
  resultQrToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Result', resultSchema);
