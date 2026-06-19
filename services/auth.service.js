const jwt = require('jsonwebtoken');
const environment = require('../config/environment');
const adminRepository = require('../repositories/admin.repository');
const ApiError = require('../utils/apiError');

class AuthService {
  async login(username, password) {
    // Support login from environment variables directly
    if (username === environment.adminUsername && password === environment.adminPassword) {
      const token = jwt.sign(
        { username, role: 'superadmin', permissions: ['export'] }, 
        environment.jwtSecret, 
        { expiresIn: '24h' }
      );
      return { token, message: 'Login successful (Env Auth)' };
    }

    const admin = await adminRepository.findByUsername(username);
    if (!admin) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, 'Invalid credentials');
    }

    const token = jwt.sign(
      { 
        id: admin._id, 
        username: admin.username, 
        role: admin.role || 'admin', 
        permissions: admin.permissions.length > 0 ? admin.permissions : ['export'] 
      }, 
      environment.jwtSecret, 
      { expiresIn: '24h' }
    );
    return { token, message: 'Login successful' };
  }
}

module.exports = new AuthService();
