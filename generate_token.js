const jwt = require('jsonwebtoken');
const environment = require('./config/environment');

const token = jwt.sign(
  { username: 'admin', role: 'superadmin', permissions: ['export'] }, 
  environment.jwtSecret, 
  { expiresIn: '24h' }
);

console.log(token);
