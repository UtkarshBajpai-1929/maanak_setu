import User from "../models/user.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { validatePhone } from "../middleware/validateMiddleware.js";

export const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, 200, "Profile retrieved successfully", user);
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (req, res, next) => {
  try {
    const { name, phone, pin_code, address } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (phone) {
      if (!validatePhone(phone)) {
        throw new ApiError(400, "Please provide a valid phone number");
      }
      updates.phone = phone;
    }
    if (pin_code !== undefined) updates.pin_code = String(pin_code);
    if (address) updates.address = address;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, 200, "Profile updated successfully", updatedUser);
  } catch (error) {
    next(error);
  }
};
