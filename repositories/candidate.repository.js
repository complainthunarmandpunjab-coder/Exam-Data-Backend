const BaseRepository = require('./base.repository');
const Candidate = require('../models/candidate.model');
const paginate = require('../utils/pagination');

class CandidateRepository extends BaseRepository {
  constructor() {
    super(Candidate);
  }

  async paginate(query = {}, options = {}) {
    return paginate(this.model, query, options);
  }
}

module.exports = new CandidateRepository();
