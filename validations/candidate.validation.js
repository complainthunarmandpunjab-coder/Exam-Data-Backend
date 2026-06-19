const Joi = require('joi');

const registerSchema = Joi.object({
  fullName: Joi.string().required().trim().min(3).max(50),
  fatherName: Joi.string().required().trim().min(3).max(50),
  cnic: Joi.string().required().trim().regex(/^(\d{13}|\d{5}-\d{7}-\d{1})$/).message('Invalid CNIC Format'),
  email: Joi.string().required().trim().email(),
  contactNumber: Joi.string().required().trim().min(10).max(15),
  gender: Joi.string().required().valid('Male', 'Female', 'Other'),
  city: Joi.string().required().trim(),
  preferredExamCity: Joi.string().required().trim(),
  batch: Joi.string().required().trim(),
  course: Joi.string().required().trim(),
  rollNumber: Joi.string().required().trim()
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().allow('').default(''),
  gender: Joi.string().default('All'),
  city: Joi.string().default('All'),
  district: Joi.string().default('All'),
  tehsil: Joi.string().default('All'),
  institute: Joi.string().default('All'),
  batch: Joi.string().default('All'),
  verification: Joi.string().default('All'),
  course: Joi.string().default('All'),
  status: Joi.string().default('All'),
  startDate: Joi.string().isoDate().allow(''),
  endDate: Joi.string().isoDate().allow(''),
  sortBy: Joi.string().valid('fullName', 'rollNumber', 'email', 'createdAt').allow(''),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
  registerSchema,
  querySchema
};
