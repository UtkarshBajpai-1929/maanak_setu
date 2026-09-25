import Instrument from "../models/instrument.js";
import Shop from "../models/shop.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { processUploadedFile } from "../middleware/uploadMiddleware.js";
import { safeJsonParse } from "../utils/urlHelper.js";

const VALID_CATEGORIES = [
  "WEIGHING_SCALE",
  "WEIGHBRIDGE",
  "WATER_METER",
  "FUEL_DISPENSER",
  "TANK_LORRY",
  "LOAD_CELL",
  "GAS_METER",
  "ENERGY_METER",
  "FLOW_METER",
  "SPEED_GUN",
  "BREATH_ANALYZER",
  "MOISTURE_METER",
  "SPHYGMOMANOMETER",
  "CLINICAL_THERMOMETER",
  "TAPE_MEASURE",
  "OTHER",
];

export const createInstrument = async (req, res, next) => {
  try {
    const {
      shop,
      category,
      serialNumber,
      capacity,
      manufacturingDate,
      purchaseDate,
      installationType,
      modelApprovalCertificateNumber,
    } = req.body;

    if (!shop || !category || !serialNumber || !installationType) {
      throw new ApiError(
        400,
        "Please provide shop, category, serialNumber, and installationType"
      );
    }

    if (!VALID_CATEGORIES.includes(category)) {
      throw new ApiError(400, `Invalid category. Allowed: ${VALID_CATEGORIES.join(", ")}`);
    }

    if (!["FIXED", "MOVABLE"].includes(installationType)) {
      throw new ApiError(400, "Installation type must be either 'FIXED' or 'MOVABLE'");
    }

    const shopDoc = await Shop.findById(shop);
    if (!shopDoc) {
      throw new ApiError(404, "Shop not found");
    }

    if (req.user.role === "USER" && shopDoc.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You do not have permission to add instruments to this shop");
    }

    const existingSerial = await Instrument.findOne({ serialNumber: serialNumber.trim() });
    if (existingSerial) {
      throw new ApiError(409, "Instrument with this serial number already exists");
    }

    const documents = [];

    // Direct Cloudinary URL from frontend
    if (req.body.documentUrl) {
      documents.push({
        title: req.body.documentTitle || "Model Approval / Invoice Document",
        documentType: req.body.documentType || "MODEL_APPROVAL",
        url: req.body.documentUrl,
      });
    }

    // Direct array of Cloudinary document URLs/objects
    if (req.body.documents) {
      const parsedDocs = safeJsonParse(req.body.documents, []);
      if (Array.isArray(parsedDocs)) {
        parsedDocs.forEach((doc) => {
          if (doc && (typeof doc === "string" || doc.url)) {
            documents.push({
              title: doc.title || "Instrument Document",
              documentType: doc.documentType || "MODEL_APPROVAL",
              url: typeof doc === "string" ? doc : doc.url,
            });
          }
        });
      }
    }

    if (req.file) {
      const url = await processUploadedFile(req.file, "instruments");
      documents.push({
        title: req.body.documentTitle || "Model Approval / Invoice Document",
        documentType: req.body.documentType || "MODEL_APPROVAL",
        url,
      });
    }

    const instrument = await Instrument.create({
      shop,
      category,
      serialNumber: serialNumber.trim(),
      capacity,
      manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : undefined,
      purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
      installationType,
      modelApprovalCertificateNumber,
      status: "PENDING_VERIFICATION",
      documents,
    });

    return sendSuccess(res, 201, "Instrument registered successfully", instrument);
  } catch (error) {
    next(error);
  }
};

export const getInstruments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === "USER") {
      const userShops = await Shop.find({ owner: req.user._id }).select("_id");
      const shopIds = userShops.map((s) => s._id);
      query.shop = { $in: shopIds };
    } else if (req.query.shop) {
      query.shop = req.query.shop;
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.installationType) {
      query.installationType = req.query.installationType;
    }

    if (req.query.serialNumber) {
      query.serialNumber = new RegExp(req.query.serialNumber.trim(), "i");
    }

    const [instruments, total] = await Promise.all([
      Instrument.find(query)
        .populate({
          path: "shop",
          select: "shopName licenseNumber address owner",
          populate: { path: "owner", select: "name email phone" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Instrument.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, 200, "Instruments retrieved successfully", instruments, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getInstrumentById = async (req, res, next) => {
  try {
    const instrument = await Instrument.findById(req.params.id).populate({
      path: "shop",
      select: "shopName licenseNumber address owner",
      populate: { path: "owner", select: "name email phone" },
    });

    if (!instrument) {
      throw new ApiError(404, "Instrument not found");
    }

    if (
      req.user.role === "USER" &&
      instrument.shop?.owner?._id?.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to view this instrument");
    }

    return sendSuccess(res, 200, "Instrument retrieved successfully", instrument);
  } catch (error) {
    next(error);
  }
};

export const updateInstrument = async (req, res, next) => {
  try {
    const instrument = await Instrument.findById(req.params.id).populate("shop");

    if (!instrument) {
      throw new ApiError(404, "Instrument not found");
    }

    if (
      req.user.role === "USER" &&
      instrument.shop?.owner?.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to modify this instrument");
    }

    const {
      capacity,
      manufacturingDate,
      purchaseDate,
      installationType,
      modelApprovalCertificateNumber,
      status,
    } = req.body;

    if (capacity !== undefined) instrument.capacity = capacity;
    if (manufacturingDate) instrument.manufacturingDate = new Date(manufacturingDate);
    if (purchaseDate) instrument.purchaseDate = new Date(purchaseDate);
    if (installationType) instrument.installationType = installationType;
    if (modelApprovalCertificateNumber !== undefined) {
      instrument.modelApprovalCertificateNumber = modelApprovalCertificateNumber;
    }

    // Only OFFICER can directly update status
    if (status && req.user.role === "OFFICER") {
      instrument.status = status;
    }

    // Direct Cloudinary URL from frontend
    if (req.body.documentUrl) {
      instrument.documents.push({
        title: req.body.documentTitle || "Attached Document",
        documentType: req.body.documentType || "OTHER",
        url: req.body.documentUrl,
      });
    }

    if (req.body.documents) {
      const parsedDocs = safeJsonParse(req.body.documents, []);
      if (Array.isArray(parsedDocs)) {
        parsedDocs.forEach((doc) => {
          if (doc && (typeof doc === "string" || doc.url)) {
            instrument.documents.push({
              title: doc.title || "Attached Document",
              documentType: doc.documentType || "OTHER",
              url: typeof doc === "string" ? doc : doc.url,
            });
          }
        });
      }
    }

    if (req.file) {
      const url = await processUploadedFile(req.file, "instruments");
      instrument.documents.push({
        title: req.body.documentTitle || "Attached Document",
        documentType: req.body.documentType || "OTHER",
        url,
      });
    }

    await instrument.save();

    return sendSuccess(res, 200, "Instrument updated successfully", instrument);
  } catch (error) {
    next(error);
  }
};

export const deleteInstrument = async (req, res, next) => {
  try {
    const instrument = await Instrument.findById(req.params.id).populate("shop");

    if (!instrument) {
      throw new ApiError(404, "Instrument not found");
    }

    if (
      req.user.role === "USER" &&
      instrument.shop?.owner?.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to delete this instrument");
    }

    await Instrument.findByIdAndDelete(req.params.id);

    return sendSuccess(res, 200, "Instrument deleted successfully");
  } catch (error) {
    next(error);
  }
};
