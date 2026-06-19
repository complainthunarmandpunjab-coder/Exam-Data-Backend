const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
// Custom MongoDB Query Injection Sanitization Middleware (Express 5 Compatible)
const mongoSanitize = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (obj instanceof Object) {
      for (const key in obj) {
        if (/^\$/.test(key)) {
          delete obj[key];
        } else {
          sanitizeObject(obj[key]);
        }
      }
    }
  };
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};

const rateLimit = require('express-rate-limit');

const config = require('./config/environment');
const { connectDB } = require('./config/db');
const logger = require('./config/logger');
const routes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const requestLogger = require('./middleware/requestLogger.middleware');
const ApiResponse = require('./utils/apiResponse');
const ApiError = require('./utils/apiError');

const app = express();

// Set security HTTP headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Parse request body parsing limit to protect against large payload attacks
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitize data against MongoDB Query Injection
app.use(mongoSanitize);

// Serve static assets (e.g. exports folder)
app.use(express.static('public'));

// Request logging middleware
app.use(requestLogger);

// Rate Limiting to prevent brute-force attacks on verification and submission routes
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs in production
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/register', submissionLimiter);
app.use('/api/v1/verify-student', submissionLimiter);
app.use('/api/register', submissionLimiter);
app.use('/api/verify-student', submissionLimiter);

// API Routes
app.use('/api/v1', routes);
app.use('/api', routes); // Backward compatibility fallback for existing frontend

// Health Check Endpoint
app.get('/health', (req, res) => {
  new ApiResponse(200, true, 'System is healthy', {
    uptime: process.uptime(),
    timestamp: new Date()
  }).send(res);
});

// Fallback for undefined routes
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// Centralized Global Error Handler Middleware
app.use(errorHandler);

// Bootstrap Database and Start Express Server
const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(config.port, () => {
      logger.info(`✓ Server running on port ${config.port} in [${config.env}] mode`);
    });

    // Graceful Shutdown configurations
    const exitHandler = () => {
      if (server) {
        server.close(() => {
          logger.info('Server closed gracefully');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    const unexpectedErrorHandler = (error) => {
      logger.error('Unexpected error detected:', error);
      exitHandler();
    };

    process.on('uncaughtException', unexpectedErrorHandler);
    process.on('unhandledRejection', unexpectedErrorHandler);

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, closing server...');
      if (server) server.close();
    });
  } catch (error) {
    logger.error('Database connection failed to start server:', error);
    process.exit(1);
  }
};

startServer();
