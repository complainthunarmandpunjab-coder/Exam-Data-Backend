class ApiResponse {
  constructor(statusCode, success, message, data = null, meta = null) {
    this.statusCode = statusCode;
    this.success = success;
    this.message = message;
    if (data !== null) this.data = data;
    if (meta !== null) this.meta = meta;
  }

  send(res) {
    return res.status(this.statusCode).json(this);
  }
}

module.exports = ApiResponse;
