import mongoose from "mongoose";
import ApiError from "../utils/apiError.js";

export const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return next(new ApiError(400, `Invalid ${paramName} parameter format`));
    }
    next();
  };
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

export const validatePhone = (phone) => {
  const re = /^[0-9+-\s()]{10}$/;
  return re.test(String(phone));
};
export const validateAdhar = (adhar) => {
  const re = /^[0-9+-\s()]{12}$/;
  return re.test(String(adhar));
};
export const validatePin = (pin) => {
  const re = /^[0-9+-\s()]{6}$/;
  return re.test(String(pin));
};
