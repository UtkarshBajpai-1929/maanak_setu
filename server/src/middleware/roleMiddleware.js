import ApiError from "../utils/apiError.js";

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    const userRole = req.user.role;

    const allowed = roles.includes(userRole);

    if (!allowed) {
      return next(
        new ApiError(
          403,
          `Access denied. Role '${userRole}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
