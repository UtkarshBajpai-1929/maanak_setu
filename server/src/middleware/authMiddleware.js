import jwt from "jsonwebtoken";
import User from "../models/user.js";
import ApiError from "../utils/apiError.js";

export const requireAuth = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      token = authHeader.replace(/^Bearer\s+/i, "").trim();
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      throw new ApiError(401, "Authentication token is required");
    }

    const secret = process.env.JWT_SECRET || "maanak_setu_jwt_super_secret_key_2026";
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        throw new ApiError(401, "Token has expired, please log in again");
      }
      throw new ApiError(401, "Invalid authentication token");
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, "User belonging to this token no longer exists");
    }

    if (!user.isActive) {
      throw new ApiError(403, "User account has been deactivated");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
