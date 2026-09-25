import jwt from "jsonwebtoken";
import User from "../models/user.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { validateAdhar, validateEmail, validatePhone, validatePin } from "../middleware/validateMiddleware.js";

const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || "maanak_setu_jwt_super_secret_key_2026";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign({ id: user._id, role: user.role }, secret, { expiresIn });
};

const sendTokenResponse = (user, statusCode, message, res) => {
  const token = generateToken(user);

  // Set cookie for web/tool clients (mobile clients store token in secure storage)
  if (res.cookie) {
    const cookieOptions = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    };
    res.cookie("token", token, cookieOptions);
  }

  return sendSuccess(res, statusCode, message, {
    token,
    tokenType: "Bearer",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    user: user.toJSON ? user.toJSON() : user,
  });
};

export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, aadhar_no, pin_code, address, role } = req.body;

    if (!name || !email || !phone || !password || !aadhar_no) {
      throw new ApiError(400, "Please provide name, email, phone, password, and aadhar_no");
    }

    if (!validateEmail(email)) {
      throw new ApiError(400, "Please provide a valid email address");
    }

    if (!validatePhone(phone)) {
      throw new ApiError(400, "Please provide a valid phone number");
    }
     if (!validateAdhar(aadhar_no)) {
      throw new ApiError(400, "Please provide a valid aadhar number");
    }
     if (pin_code && !validatePin(pin_code)) {
      throw new ApiError(400, "Please provide a valid PIN code");
    }

    if (password.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters long");
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ApiError(409, "User with this email already exists");
    }

    let assignedRole = "USER";
    if (role && ["USER", "OFFICER"].includes(role)) {
      assignedRole = role;
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      aadhar_no: String(aadhar_no),
      pin_code: pin_code ? String(pin_code) : undefined,
      address,
      role: assignedRole,
    });

    return sendTokenResponse(user, 201, "User registered successfully", res);
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Please provide email and password");
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new ApiError(401, "Invalid email or password");
    }

    if (!user.isActive) {
      throw new ApiError(403, "Account has been deactivated");
    }

    return sendTokenResponse(user, 200, "Logged in successfully", res);
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.cookie("token", "", {
      httpOnly: true,
      expires: new Date(0),
    });

    return sendSuccess(res, 200, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, "Current user profile retrieved", {
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};
