import Application from "../models/application.js";
import Shop from "../models/shop.js";
import Instrument from "../models/instrument.js";
import Certificate from "../models/certificate.js";
import User from "../models/user.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { generateApplicationNumber } from "../utils/idGenerator.js";
import { validateTransition } from "../services/workflowService.js";
import { issueCertificateForApplication } from "../services/certificateService.js";
import { createNotification } from "../services/notificationService.js";
import { processUploadedFile } from "../middleware/uploadMiddleware.js";
import { safeJsonParse, toAbsoluteUrl } from "../utils/urlHelper.js";

export const createApplication = async (req, res, next) => {
  try {
    const {
      shop,
      instrument,
      applicationType,
      reason,
      previousCertificate,
      remarks,
    } = req.body;

    if (!shop || !instrument || !applicationType) {
      throw new ApiError(400, "Please provide shop, instrument, and applicationType");
    }

    if (!["FRESH", "RE_VERIFICATION"].includes(applicationType)) {
      throw new ApiError(400, "Application type must be either 'FRESH' or 'RE_VERIFICATION'");
    }

    const shopDoc = await Shop.findById(shop);
    if (!shopDoc) {
      throw new ApiError(404, "Shop not found");
    }

    if (req.user.role === "USER" && shopDoc.owner.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You do not own this shop");
    }

    const instrumentDoc = await Instrument.findById(instrument);
    if (!instrumentDoc) {
      throw new ApiError(404, "Instrument not found");
    }

    if (instrumentDoc.shop.toString() !== shopDoc._id.toString()) {
      throw new ApiError(400, "Instrument does not belong to the specified shop");
    }

    // Active pending application check
    const activeApp = await Application.findOne({
      instrument: instrumentDoc._id,
      status: {
        $in: ["SUBMITTED", "UNDER_REVIEW", "SCHEDULED", "VERIFICATION_PENDING", "VERIFIED"],
      },
    });

    if (activeApp) {
      throw new ApiError(
        400,
        `An active verification application (${activeApp.applicationNumber}) already exists for this instrument in status '${activeApp.status}'`
      );
    }

    let linkedPrevCert = null;
    if (applicationType === "RE_VERIFICATION") {
      if (previousCertificate) {
        const cert = await Certificate.findById(previousCertificate);
        if (cert) {
          linkedPrevCert = cert._id;
        }
      }

      if (!linkedPrevCert) {
        // Automatically search for latest certificate of this instrument
        const lastCert = await Certificate.findOne({ instrument: instrumentDoc._id }).sort({
          createdAt: -1,
        });
        if (lastCert) {
          linkedPrevCert = lastCert._id;
        }
      }
    }

    const documents = [];

    // Direct Cloudinary URL from frontend
    if (req.body.documentUrl) {
      documents.push({
        title: req.body.documentTitle || "Supporting Document",
        documentType: req.body.documentType || "ID_PROOF",
        url: req.body.documentUrl,
      });
    }

    if (req.body.documents) {
      const parsedDocs = safeJsonParse(req.body.documents, []);
      if (Array.isArray(parsedDocs)) {
        parsedDocs.forEach((doc) => {
          if (doc && (typeof doc === "string" || doc.url)) {
            documents.push({
              title: doc.title || "Supporting Document",
              documentType: doc.documentType || "ID_PROOF",
              url: typeof doc === "string" ? doc : doc.url,
            });
          }
        });
      }
    }

    if (req.file) {
      const url = await processUploadedFile(req.file, "applications");
      documents.push({
        title: req.body.documentTitle || "Supporting Document",
        documentType: req.body.documentType || "ID_PROOF",
        url,
      });
    }

    const applicationNumber = generateApplicationNumber();

    const application = await Application.create({
      applicationNumber,
      applicant: req.user._id,
      shop: shopDoc._id,
      instrument: instrumentDoc._id,
      applicationType,
      reason: applicationType === "RE_VERIFICATION" ? reason || "ROUTINE_EXPIRY" : undefined,
      previousCertificate: linkedPrevCert,
      status: "SUBMITTED",
      remarks,
      documents,
    });

    // Update instrument status to PENDING_VERIFICATION
    instrumentDoc.status = "PENDING_VERIFICATION";
    await instrumentDoc.save();

    // Create notification for applicant
    await createNotification({
      user: req.user._id,
      application: application._id,
      type: "APPLICATION_UPDATE",
      title: "Application Submitted",
      message: `Your application ${applicationNumber} for instrument verification has been submitted successfully.`,
    });

    return sendSuccess(res, 201, "Application submitted successfully", application);
  } catch (error) {
    next(error);
  }
};

export const getApplications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === "USER") {
      query.applicant = req.user._id;
    } else if (req.user.role === "OFFICER") {
      // Officers see either their assigned applications, or unassigned applications under review
      if (req.query.assignedOnly === "true") {
        query.assignedOfficer = req.user._id;
      } else {
        query.$or = [{ assignedOfficer: req.user._id }, { assignedOfficer: null }];
      }
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.applicationType) {
      query.applicationType = req.query.applicationType;
    }

    if (req.query.shop) {
      query.shop = req.query.shop;
    }

    if (req.query.instrument) {
      query.instrument = req.query.instrument;
    }

    if (req.query.applicationNumber) {
      query.applicationNumber = new RegExp(req.query.applicationNumber.trim(), "i");
    }

    if (req.query.dateFrom || req.query.dateTo) {
      query.createdAt = {};
      if (req.query.dateFrom) query.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) query.createdAt.$lte = new Date(req.query.dateTo);
    }

    const [applications, total] = await Promise.all([
      Application.find(query)
        .populate("applicant", "name email phone")
        .populate("shop", "shopName licenseNumber address")
        .populate("instrument", "category serialNumber capacity installationType status")
        .populate("assignedOfficer", "name email phone role")
        .populate("previousCertificate", "certificateNumber validUntil status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Application.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, 200, "Applications retrieved successfully", applications, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate("applicant", "name email phone aadhar_no address")
      .populate("shop")
      .populate("instrument")
      .populate("assignedOfficer", "name email phone role")
      .populate("previousCertificate");

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    if (
      req.user.role === "USER" &&
      application.applicant._id.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to view this application");
    }

    return sendSuccess(res, 200, "Application retrieved successfully", application);
  } catch (error) {
    next(error);
  }
};

export const updateApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    if (
      req.user.role === "USER" &&
      application.applicant.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to modify this application");
    }

    const { remarks, reason } = req.body;

    if (remarks) application.remarks = remarks;
    if (reason && application.applicationType === "RE_VERIFICATION") {
      application.reason = reason;
    }

    // Direct Cloudinary URL from frontend
    if (req.body.documentUrl) {
      application.documents.push({
        title: req.body.documentTitle || "Additional Document",
        documentType: req.body.documentType || "OTHER",
        url: req.body.documentUrl,
      });
    }

    if (req.body.documents) {
      const parsedDocs = safeJsonParse(req.body.documents, []);
      if (Array.isArray(parsedDocs)) {
        parsedDocs.forEach((doc) => {
          if (doc && (typeof doc === "string" || doc.url)) {
            application.documents.push({
              title: doc.title || "Additional Document",
              documentType: doc.documentType || "OTHER",
              url: typeof doc === "string" ? doc : doc.url,
            });
          }
        });
      }
    }

    if (req.file) {
      const url = await processUploadedFile(req.file, "applications");
      application.documents.push({
        title: req.body.documentTitle || "Additional Document",
        documentType: req.body.documentType || "OTHER",
        url,
      });
    }

    await application.save();

    return sendSuccess(res, 200, "Application updated successfully", application);
  } catch (error) {
    next(error);
  }
};

// export const assignApplication = async (req, res, next) => {
//   try {
//     const { officerId } = req.body;

//     if (!officerId) {
//       throw new ApiError(400, "Officer ID is required for allocation");
//     }

//     const officer = await User.findById(officerId);
//     if (!officer) {
//       throw new ApiError(404, "Officer not found");
//     }

//     if (officer.role !== "OFFICER") {
//       throw new ApiError(400, `Assigned user must have role OFFICER, but has '${officer.role}'`);
//     }

//     const application = await Application.findById(req.params.id);
//     if (!application) {
//       throw new ApiError(404, "Application not found");
//     }

//     application.assignedOfficer = officer._id;
//     application.assignedAt = new Date();

//     if (application.status === "SUBMITTED") {
//       application.status = "UNDER_REVIEW";
//     }

//     await application.save();

//     // Notify assigned officer
//     await createNotification({
//       user: officer._id,
//       application: application._id,
//       type: "APPLICATION_UPDATE",
//       title: "New Application Assigned",
//       message: `Application ${application.applicationNumber} has been assigned to you for verification.`,
//     });

//     // Notify applicant
//     await createNotification({
//       user: application.applicant,
//       application: application._id,
//       type: "APPLICATION_UPDATE",
//       title: "Officer Assigned",
//       message: `Officer ${officer.name} (${officer.role}) has been assigned to review your application ${application.applicationNumber}.`,
//     });

//     return sendSuccess(res, 200, "Application assigned successfully", application);
//   } catch (error) {
//     next(error);
//   }
// };

export const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, remarks } = req.body;

    if (!status) {
      throw new ApiError(400, "Status is required");
    }

    const application = await Application.findById(req.params.id);
    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    validateTransition(application.status, status);

    application.status = status;
    if (remarks) application.remarks = remarks;

    await application.save();

    await createNotification({
      user: application.applicant,
      application: application._id,
      type: "APPLICATION_UPDATE",
      title: "Application Status Update",
      message: `Your application ${application.applicationNumber} status changed to ${status}.`,
    });

    return sendSuccess(res, 200, `Application status updated to ${status}`, application);
  } catch (error) {
    next(error);
  }
};

export const submitVerificationResult = async (req, res, next) => {
  try {
    const {
      outcome,
      instrumentCondition,
      testReadings,
      defectDescription,
      repairableStatus,
      resubmissionDeadline,
      stampCode,
      photographs,
      defectPhotographs,
      remarks,
    } = req.body;

    if (!outcome || !["PASS", "FAIL", "REJECTED"].includes(outcome)) {
      throw new ApiError(400, "Valid outcome (PASS, FAIL, or REJECTED) is required");
    }

    const application = await Application.findById(req.params.id)
      .populate("instrument")
      .populate("applicant");

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    // Role check: Only assigned officer
    if (
      application.assignedOfficer &&
      application.assignedOfficer.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "Only the assigned verification officer can record verification results");
    }

    // Process file upload and safely parse mobile FormData fields
    const parsedTestReadings = Array.isArray(testReadings)
      ? testReadings
      : safeJsonParse(testReadings, []);

    const initialPhotos = Array.isArray(photographs)
      ? photographs
      : safeJsonParse(photographs, []);

    let photoUrls = Array.isArray(initialPhotos) ? [...initialPhotos] : [];
    if (req.file) {
      const uploadedUrl = await processUploadedFile(req.file, "verification");
      photoUrls.push(toAbsoluteUrl(uploadedUrl, req));
    }

    const parsedDefectPhotos = Array.isArray(defectPhotographs)
      ? defectPhotographs
      : safeJsonParse(defectPhotographs, []);

    application.verificationDetails = {
      verificationDate: new Date(),
      officer: req.user._id,
      instrumentCondition: instrumentCondition || "SATISFACTORY",
      testReadings: Array.isArray(parsedTestReadings) ? parsedTestReadings : [],
      outcome,
      defectDescription,
      repairableStatus: repairableStatus || "NOT_APPLICABLE",
      resubmissionDeadline: resubmissionDeadline ? new Date(resubmissionDeadline) : undefined,
      stampCode,
      photographs: photoUrls,
      defectPhotographs: Array.isArray(parsedDefectPhotos) ? parsedDefectPhotos : [],
      remarks,
    };

    if (outcome === "PASS") {
      application.status = "VERIFIED";
      await application.save();

      // Issue Certificate immediately
      const certificate = await issueCertificateForApplication(application._id, req.user);
      const updatedApplication = await Application.findById(application._id);

      return sendSuccess(res, 200, "Verification passed and certificate issued successfully", {
        application: updatedApplication,
        certificate,
      });
    } else {
      // Rejection or Fail
      application.status = "REJECTED";
      application.rejectionReason = defectDescription || remarks || "Instrument failed verification standards";
      await application.save();

      await Instrument.findByIdAndUpdate(application.instrument._id, {
        status: "REJECTED",
      });

      await createNotification({
        user: application.applicant._id,
        application: application._id,
        type: "REJECTED",
        title: "Verification Rejected",
        message: `Application ${application.applicationNumber} was rejected. Reason: ${application.rejectionReason}`,
      });

      return sendSuccess(res, 200, "Verification result recorded as REJECTED", {
        application,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const rejectApplication = async (req, res, next) => {
  try {
    const { rejectionReason, remarks } = req.body;

    if (!rejectionReason) {
      throw new ApiError(400, "Rejection reason is required");
    }

    const application = await Application.findById(req.params.id).populate("instrument");
    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    application.status = "REJECTED";
    application.rejectionReason = rejectionReason;
    if (remarks) application.remarks = remarks;

    await application.save();

    if (application.instrument) {
      await Instrument.findByIdAndUpdate(application.instrument._id, {
        status: "REJECTED",
      });
    }

    await createNotification({
      user: application.applicant,
      application: application._id,
      type: "REJECTED",
      title: "Application Rejected",
      message: `Your application ${application.applicationNumber} has been rejected. Reason: ${rejectionReason}`,
    });

    return sendSuccess(res, 200, "Application rejected successfully", application);
  } catch (error) {
    next(error);
  }
};
