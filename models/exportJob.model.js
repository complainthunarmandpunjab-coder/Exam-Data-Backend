const mongoose = require('mongoose');

const exportJobSchema = new mongoose.Schema({
  adminUsername: { type: String, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  progress: { type: Number, default: 0 },
  fileUrl: { type: String },
  error: { type: String },
  filters: { type: mongoose.Schema.Types.Mixed },
  format: { type: String, default: 'csv' }, // csv, xlsx
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
}, { timestamps: false });

exportJobSchema.index({ adminUsername: 1 });
exportJobSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ExportJob', exportJobSchema);
