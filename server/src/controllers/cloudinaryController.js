import { v2 as cloudinary } from "cloudinary";
import { sendSuccess } from "../utils/apiResponse.js";

export const getUploadSignature = async (req, res, next) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const folder = req.query.folder || "maanak_setu";

    if (!cloudName || !apiKey || !apiSecret) {
      return sendSuccess(res, 200, "Cloudinary upload configuration (Unsigned mode)", {
        cloudName: cloudName || null,
        folder,
        isConfigured: false,
        note: "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend .env for signed uploads",
      });
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });

    const timestamp = Math.round(new Date().getTime() / 1000);
    const paramsToSign = {
      timestamp,
      folder,
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return sendSuccess(res, 200, "Cloudinary upload signature generated successfully", {
      cloudName,
      apiKey,
      timestamp,
      signature,
      folder,
      isConfigured: true,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    });
  } catch (error) {
    next(error);
  }
};
