const Joi = require('joi');

const verifyStudentSchema = Joi.object({
  fullName: Joi.string().required().trim().min(3).max(50),
  fatherName: Joi.string().required().trim().min(3).max(50),
  cnic: Joi.string().required().trim().regex(/^(\d{13}|\d{5}-\d{7}-\d{1})$/).message('Invalid CNIC Format'),
  email: Joi.string().required().trim().email(),
  course: Joi.string().required().trim(),
  rollNumber: Joi.string().required().trim()
});

const logQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  search: Joi.string().allow('').default(''),
  status: Joi.string().default('All'),
  payment: Joi.string().default('All')
});

module.exports = {
  verifyStudentSchema,
  logQuerySchema
};
