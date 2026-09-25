import path from "path";
import fs from "fs";
import Certificate from "../models/certificate.js";
import Application from "../models/application.js";
import Instrument from "../models/instrument.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { generateCertificatePdf } from "../services/pdfService.js";
import { toAbsoluteUrl } from "../utils/urlHelper.js";

const syncCertificateStatus = (cert) => {
  const now = new Date();
  if (cert.status === "ACTIVE" && new Date(cert.validUntil) < now) {
    cert.status = "EXPIRED";
    cert.save().catch((err) => console.error("Error auto-expiring cert:", err.message));
  }
  return cert;
};

export const getCertificates = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === "USER") {
      const userApps = await Application.find({ applicant: req.user._id }).select("_id");
      const appIds = userApps.map((a) => a._id);
      query.application = { $in: appIds };
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.instrument) {
      query.instrument = req.query.instrument;
    }

    if (req.query.certificateNumber) {
      query.certificateNumber = new RegExp(req.query.certificateNumber.trim(), "i");
    }

    const [certificates, total] = await Promise.all([
      Certificate.find(query)
        .populate({
          path: "application",
          select: "applicationNumber applicant shop",
          populate: [
            { path: "applicant", select: "name email phone" },
            { path: "shop", select: "shopName address licenseNumber" },
          ],
        })
        .populate("instrument", "category serialNumber capacity installationType status")
        .populate("previousCertificate", "certificateNumber validUntil status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Certificate.countDocuments(query),
    ]);

    certificates.forEach(syncCertificateStatus);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, 200, "Certificates retrieved successfully", certificates, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getCertificateById = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate({
        path: "application",
        populate: [
          { path: "applicant", select: "name email phone" },
          { path: "shop", select: "shopName address licenseNumber" },
          { path: "assignedOfficer", select: "name email phone role" },
        ],
      })
      .populate("instrument")
      .populate("previousCertificate");

    if (!certificate) {
      throw new ApiError(404, "Certificate not found");
    }

    syncCertificateStatus(certificate);

    if (
      req.user.role === "USER" &&
      certificate.application?.applicant?._id?.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to view this certificate");
    }

    const certData = certificate.toObject ? certificate.toObject() : { ...certificate };
    if (certData.pdfUrl) {
      certData.pdfDownloadUrl = toAbsoluteUrl(certData.pdfUrl, req);
    }

    return sendSuccess(res, 200, "Certificate retrieved successfully", certData);
  } catch (error) {
    next(error);
  }
};

export const downloadCertificatePdf = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id)
      .populate({
        path: "application",
        populate: [
          { path: "applicant", select: "name email phone" },
          { path: "shop", select: "shopName address licenseNumber" },
          { path: "assignedOfficer", select: "name email phone role" },
        ],
      })
      .populate("instrument");

    if (!certificate) {
      throw new ApiError(404, "Certificate not found");
    }

    if (
      req.user.role === "USER" &&
      certificate.application?.applicant?._id?.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to download this certificate");
    }

    let filePath = certificate.pdfUrl
      ? (certificate.pdfUrl.startsWith("/") ? certificate.pdfUrl.slice(1) : certificate.pdfUrl)
      : null;

    if (!filePath || !fs.existsSync(filePath)) {
      // Regenerate PDF if file missing
      const newPdfUrl = await generateCertificatePdf({
        certificate,
        application: certificate.application,
        instrument: certificate.instrument,
        shop: certificate.application?.shop,
        officer: certificate.application?.assignedOfficer,
        qrDataUrl: certificate.qrCode,
      });
      certificate.pdfUrl = newPdfUrl;
      await certificate.save();
      filePath = newPdfUrl.startsWith("/") ? newPdfUrl.slice(1) : newPdfUrl;
    }

    res.download(filePath, `${certificate.certificateNumber}.pdf`);
  } catch (error) {
    next(error);
  }
};

export const verifyCertificatePublic = async (req, res, next) => {
  try {
    const { certificateNumber } = req.params;

    if (!certificateNumber) {
      throw new ApiError(400, "Certificate number is required");
    }

    const certificate = await Certificate.findOne({
      certificateNumber: certificateNumber.trim(),
    })
      .populate({
        path: "application",
        select: "verificationDetails",
        populate: [
          {
            path: "shop",
            select: "shopName address",
          },
        ],
      })
      .populate("instrument", "category serialNumber capacity installationType");

    if (!certificate) {
      throw new ApiError(404, "Certificate not found. The certificate number is invalid.");
    }

    syncCertificateStatus(certificate);

    const now = new Date();
    const isCurrentlyValid =
      certificate.status === "ACTIVE" &&
      new Date(certificate.validUntil) >= now;

    // Return only safe public info
    const safeData = {
      certificateNumber: certificate.certificateNumber,
      certificateType: certificate.certificateType,
      status: certificate.status,
      isCurrentlyValid,
      issueDate: certificate.issueDate,
      validFrom: certificate.validFrom,
      validUntil: certificate.validUntil,
      stampCode: certificate.stampCode,
      issuingAuthority: "Department of Legal Metrology, Government of India",
      instrument: {
        category: certificate.instrument?.category,
        serialNumber: certificate.instrument?.serialNumber,
        capacity: certificate.instrument?.capacity,
        installationType: certificate.instrument?.installationType,
      },
      establishment: {
        shopName: certificate.application?.shop?.shopName,
        district: certificate.application?.shop?.address?.district,
        state: certificate.application?.shop?.address?.state,
      },
      verificationResult: certificate.application?.verificationDetails?.outcome || "PASS",
    };

    return sendSuccess(res, 200, "Certificate authenticity verified", safeData);
  } catch (error) {
    next(error);
  }
};
