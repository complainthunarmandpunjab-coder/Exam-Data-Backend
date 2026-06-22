const Admin = require('../models/admin.model');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

class TeamController {
  list = async (req, res, next) => {
    try {
      // Find all admins
      const team = await Admin.find({}, '-password').sort({ createdAt: -1 });
      new ApiResponse(200, true, 'Team members fetched successfully', team).send(res);
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const { username, email, password, role, permissions } = req.body;
      
      const existingUser = await Admin.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        throw new ApiError(400, 'Username or Email is already registered');
      }

      const newAdmin = await Admin.create({
        username,
        email,
        password,
        role: role || 'admin',
        permissions: permissions || []
      });

      // Exclude password from response
      const responseData = {
        _id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
        createdAt: newAdmin.createdAt
      };

      new ApiResponse(201, true, 'Team member added successfully', responseData).send(res);
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { username, email, role, permissions } = req.body;

      const admin = await Admin.findById(id);
      if (!admin) {
        throw new ApiError(404, 'Team member not found');
      }

      if (username) admin.username = username;
      if (email) admin.email = email.toLowerCase().trim();
      if (role) admin.role = role;
      if (permissions) admin.permissions = permissions;

      await admin.save();

      const responseData = {
        _id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        updatedAt: admin.updatedAt
      };

      new ApiResponse(200, true, 'Team member updated successfully', responseData).send(res);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      const { id } = req.params;

      const admin = await Admin.findByIdAndDelete(id);
      if (!admin) {
        throw new ApiError(404, 'Team member not found');
      }

      new ApiResponse(200, true, 'Team member deleted successfully').send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new TeamController();
