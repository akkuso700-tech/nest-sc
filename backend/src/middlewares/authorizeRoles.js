const { AppError } = require('../utils/AppError')

function authorizeRoles(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.user) {
      next(new AppError('Authentication required.', 401))
      return
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError('You do not have permission for this action.', 403))
      return
    }

    next()
  }
}

module.exports = { authorizeRoles }
