const BaseRepository = require('./base.repository');
const Verification = require('../models/verification.model');

class VerificationRepository extends BaseRepository {
  constructor() {
    super(Verification);
  }

  async paginate(query = {}, options = {}) {
    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 50;
    const skip = (page - 1) * limit;

    const findQuery = this.find(query, {
      sort: options.sort || { createdAt: -1 },
      skip,
      limit,
      lean: true
    });

    const [data, total] = await Promise.all([
      findQuery,
      this.countDocuments(query)
    ]);

    return {
      data,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    };
  }
}

module.exports = new VerificationRepository();
