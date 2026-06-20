/**
 * Reusable utility for Mongoose pagination.
 * Handles calculation of skips, limits, page numbers, and total pages.
 */
const paginate = async (model, query = {}, options = {}) => {
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 50;
  const skip = (page - 1) * limit;
  const sort = options.sort || { createdAt: -1 };

  const [data, total] = await Promise.all([
    model.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    model.countDocuments(query).exec()
  ]);

  return {
    data,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit)
  };
};

module.exports = paginate;
