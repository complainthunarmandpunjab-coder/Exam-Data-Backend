const Joi = require('joi');

const loginSchema = Joi.object({
  username: Joi.string().required().trim().messages({
    'any.required': 'Username is required',
    'string.empty': 'Username cannot be empty'
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
    'string.empty': 'Password cannot be empty'
  })
});

module.exports = {
  loginSchema
};
