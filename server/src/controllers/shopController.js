import User from "../models/user.js";
import Shop from "../models/shop.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";

import { safeJsonParse } from "../utils/urlHelper.js";

export const createShop = async (req, res, next) => {
  try {
    const { shopName, licenseNumber } = req.body;
    const address = safeJsonParse(req.body.address);
    const operational_time = safeJsonParse(req.body.operational_time);

    if (!shopName) {
      throw new ApiError(400, "Shop name is required");
    }

    if (licenseNumber) {
      const existingLicense = await Shop.findOne({ licenseNumber });
      if (existingLicense) {
        throw new ApiError(409, "Shop with this license number already exists");
      }
    }

    const shop = await Shop.create({
      owner: req.user._id,
      shopName,
      licenseNumber: licenseNumber || undefined,
      address,
      operational_time,
    });

    return sendSuccess(res, 201, "Shop created successfully", shop);
  } catch (error) {
    next(error);
  }
};

export const getShops = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    // Standard users only see their own shops
    if (req.user.role === "USER") {
      query.owner = req.user._id;
    } else if (req.query.owner) {
      query.owner = req.query.owner;
    }

    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === "true";
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, "i");
      query.$or = [
        { shopName: searchRegex },
        { licenseNumber: searchRegex },
        { "address.city": searchRegex },
        { "address.district": searchRegex },
      ];
    }

    const [shops, total] = await Promise.all([
      Shop.find(query)
        .populate("owner", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Shop.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, 200, "Shops retrieved successfully", shops, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getShopById = async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id).populate("owner", "name email phone");

    if (!shop) {
      throw new ApiError(404, "Shop not found");
    }

    // Role check: Only owner or official roles can view
    if (req.user.role === "USER" && shop.owner._id.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You do not have permission to view this shop");
    }

    return sendSuccess(res, 200, "Shop retrieved successfully", shop);
  } catch (error) {
    next(error);
  }
};

export const updateShop = async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      throw new ApiError(404, "Shop not found");
    }

    if (req.user.role === "USER" && shop.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You do not have permission to modify this shop");
    }

    const { shopName, licenseNumber, isActive } = req.body;
    const address = safeJsonParse(req.body.address);
    const operational_time = safeJsonParse(req.body.operational_time);

    if (licenseNumber && licenseNumber !== shop.licenseNumber) {
      const duplicate = await Shop.findOne({ licenseNumber, _id: { $ne: shop._id } });
      if (duplicate) {
        throw new ApiError(409, "License number is already in use by another shop");
      }
      shop.licenseNumber = licenseNumber;
    }

    if (shopName) shop.shopName = shopName;
    if (address && typeof address === "object") shop.address = { ...shop.address, ...address };
    if (operational_time && typeof operational_time === "object") shop.operational_time = { ...shop.operational_time, ...operational_time };
    if (isActive !== undefined && (req.user.role === "OFFICER" || shop.owner.toString() === req.user._id.toString())) {
      shop.isActive = isActive;
    }

    await shop.save();

    return sendSuccess(res, 200, "Shop updated successfully", shop);
  } catch (error) {
    next(error);
  }
};

export const deleteShop = async (req, res, next) => {
  try {
    const shop = await Shop.findById(req.params.id);

    if (!shop) {
      throw new ApiError(404, "Shop not found");
    }

    if (req.user.role === "USER" && shop.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You do not have permission to delete this shop");
    }

    // Soft delete
    shop.isActive = false;
    await shop.save();

    return sendSuccess(res, 200, "Shop deactivated successfully", shop);
  } catch (error) {
    next(error);
  }
};

export const getOfficerShops = async (req, res, next) => {
  try {
    if (req.user.role !== "OFFICER") {
      throw new ApiError(403, "Only officers can access this resource");
    }

    const officer = await User.findById(req.user._id).select("pin_code");

    if (!officer) {
      throw new ApiError(404, "Officer not found");
    }

    if (!officer.pin_code) {
      throw new ApiError(400, "Pincode is not assigned to this officer");
    }

    const shops = await Shop.find({
      "address.pincode": officer.pin_code,
      isActive: true,
    })
      .populate({
        path: "owner",
        select: "name email phone",
      })
      .sort({ createdAt: -1 });

    return sendSuccess(
      res,
      200,
      "Shops retrieved successfully",
      shops
    );
  } catch (error) {
    next(error);
  }
};