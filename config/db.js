const mongoose = require('mongoose');
const dns = require('dns');
const logger = require('./logger');
const config = require('./environment');

// Apply DNS resolver fix to resolve MongoDB SRV records correctly on local networks
dns.setDefaultResultOrder('ipv4first');
try {
  const osServers = dns.getServers().filter(s => s !== '127.0.0.1' && s !== '::1');
  const targetServers = osServers.length > 0 ? [...osServers, '8.8.8.8', '1.1.1.1'] : ['8.8.8.8', '1.1.1.1'];
  dns.setServers(targetServers);
} catch (err) {
  logger.error(`Failed to set dynamic DNS servers: ${err.message}`);
}

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodbUri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 10000,
    });
    logger.info(`✓ Primary MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    logger.error(`❌ Primary MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

// Create connection pool to Master Database
const masterConn = mongoose.createConnection(config.masterMongodbUri, {
  maxPoolSize: 20,
  minPoolSize: 5,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 10000,
});

masterConn.on('connected', () => {
  logger.info('✓ Master Database Connected (hunarmand-prd)');
});

masterConn.on('error', (err) => {
  logger.error(`❌ Master Database Connection Error: ${err.message}`);
  if (err.message.toLowerCase().includes('timeout') || err.message.includes('etimedout')) {
    logger.warn('👉 TIP: This is likely an IP Whitelist issue. Please verify IP whitelist in MongoDB Atlas.');
  }
});

// Master database models mapped to their respective collections
const MasterUser = masterConn.model('User', new mongoose.Schema({
  rollNumber: { type: String },
  email: { type: String },
  fullName: { type: String },
  fatherName: { type: String },
  cnic: { type: String },
  createdAt: { type: Date }
}, { strict: false, collection: 'users' }));

const MasterChallan = masterConn.model('Challan', new mongoose.Schema({
  userId: { type: String },
  rollNumber: { type: String },
  paid: { type: Boolean },
  createdAt: { type: Date }
}, { strict: false, collection: 'challans' }));

module.exports = {
  connectDB,
  MasterUser,
  MasterChallan
};
