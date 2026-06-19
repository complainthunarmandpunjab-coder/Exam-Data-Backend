const authService = require('../services/auth.service');
const ApiResponse = require('../utils/apiResponse');

class AuthController {
  login = async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const { token, message } = await authService.login(username, password);

      new ApiResponse(200, true, message, { token }).send(res);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AuthController();
