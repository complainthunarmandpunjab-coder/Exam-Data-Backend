const Joi = require('joi');
require('dotenv').config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5001),
  MONGODB_URI: Joi.string().required().description('Primary MongoDB connection string'),
  MASTER_MONGODB_URI: Joi.string().required().description('Master Database connection string'),
  JWT_SECRET: Joi.string().default('hunarmand_secret_key'),
  ADMIN_USERNAME: Joi.string().default('admin'),
  ADMIN_PASSWORD: Joi.string().empty('').default('0@02'),
  REDIS_HOST: Joi.string().default('127.0.0.1'),
  REDIS_PORT: Joi.number().default(6379),
  SMTP_HOST: Joi.string().allow(''),
  SMTP_PORT: Joi.number().default(465),
  SMTP_PASSWORD: Joi.string().allow(''),
  VERIFICATION_EMAIL: Joi.string().allow(''),
  FROM_NAME: Joi.string().allow(''),
  FROM_EMAIL: Joi.string().allow(''),
  SKIP_EMAIL: Joi.boolean().default(false)
}).unknown().required();

const { value: envVars, error } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

if (envVars.NODE_ENV === 'production') {
  if (envVars.JWT_SECRET === 'hunarmand_secret_key') {
    throw new Error('Config validation error: JWT_SECRET must be set to a custom secure key in production mode.');
  }
  if (envVars.ADMIN_PASSWORD === '0@02') {
    console.warn('⚠️ WARNING: Default ADMIN_PASSWORD ("0@02") is active in production environment!');
  }
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  mongodbUri: envVars.MONGODB_URI,
  masterMongodbUri: envVars.MASTER_MONGODB_URI,
  jwtSecret: envVars.JWT_SECRET,
  adminUsername: envVars.ADMIN_USERNAME,
  adminPassword: envVars.ADMIN_PASSWORD,
  redis: {
    host: envVars.REDIS_HOST,
    port: envVars.REDIS_PORT
  },
  smtp: {
    host: envVars.SMTP_HOST,
    port: envVars.SMTP_PORT,
    password: envVars.SMTP_PASSWORD
  },
  emails: {
    verification: envVars.VERIFICATION_EMAIL,
    fromName: envVars.FROM_NAME,
    fromEmail: envVars.FROM_EMAIL,
    skipEmail: envVars.SKIP_EMAIL
  }
};
