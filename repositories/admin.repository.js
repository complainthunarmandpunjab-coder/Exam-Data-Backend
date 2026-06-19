const BaseRepository = require('./base.repository');
const Admin = require('../models/admin.model');

class AdminRepository extends BaseRepository {
  constructor() {
    super(Admin);
  }

  async findByUsername(username) {
    // Overriding findOne to keep document class methods (like comparePassword) by forcing lean: false
    return this.findOne({ username }, { lean: false });
  }
}

module.exports = new AdminRepository();
