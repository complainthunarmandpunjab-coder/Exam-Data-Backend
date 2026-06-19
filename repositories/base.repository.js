class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async find(query = {}, options = {}) {
    let execution = this.model.find(query);
    if (options.select) execution.select(options.select);
    if (options.sort) execution.sort(options.sort);
    if (options.skip) execution.skip(options.skip);
    if (options.limit) execution.limit(options.limit);
    if (options.lean !== false) execution.lean();
    return execution.exec();
  }

  async findOne(query, options = {}) {
    let execution = this.model.findOne(query);
    if (options.select) execution.select(options.select);
    if (options.lean !== false) execution.lean();
    return execution.exec();
  }

  async findById(id, options = {}) {
    let execution = this.model.findById(id);
    if (options.select) execution.select(options.select);
    if (options.lean !== false) execution.lean();
    return execution.exec();
  }

  async create(data) {
    return this.model.create(data);
  }

  async updateOne(query, data, options = {}) {
    return this.model.updateOne(query, data, { new: true, ...options }).exec();
  }

  async findOneAndUpdate(query, data, options = { new: true }) {
    return this.model.findOneAndUpdate(query, data, options).exec();
  }

  async deleteOne(query) {
    return this.model.deleteOne(query).exec();
  }

  async countDocuments(query = {}) {
    return this.model.countDocuments(query).exec();
  }
}

module.exports = BaseRepository;
