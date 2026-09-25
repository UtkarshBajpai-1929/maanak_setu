import crypto from "crypto";
import Certificate from "../models/certificate.js";
import Application from "../models/application.js";
import Instrument from "../models/instrument.js";
import ApiError from "../utils/apiError.js";
import { generateCertificateNumber, generateStampCode } from "../utils/idGenerator.js";
import { calculateCertificateDates } from "./validityService.js";
import { buildVerificationUrl, generateQrDataUrl } from "./qrService.js";
import { generateCertificatePdf } from "./pdfService.js";
import { createNotification } from "./notificationService.js";

export const issueCertificateForApplication = async (applicationId, officerUser) => {
  const application = await Application.findById(applicationId)
    .populate("applicant", "name email phone")
    .populate("shop")
    .populate("instrument")
    .populate("assignedOfficer", "name email phone role");

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  if (application.status !== "VERIFIED") {
    throw new ApiError(
      400,
      `Cannot issue certificate. Application must be in 'VERIFIED' status, but is currently '${application.status}'`
    );
  }

  const existingCert = await Certificate.findOne({
    application: applicationId,
    status: "ACTIVE",
  });

  if (existingCert) {
    return existingCert;
  }

  const certificateNumber = generateCertificateNumber();
  const stampCode =
    application.verificationDetails?.stampCode || generateStampCode();

  const { validFrom, validUntil } = calculateCertificateDates(
    application.instrument.category,
    application.verificationDetails?.verificationDate || new Date()
  );

  const verificationUrl = buildVerificationUrl(certificateNumber);
  const qrCodeDataUrl = await generateQrDataUrl(verificationUrl);

  const digitalSignature = crypto
    .createHmac("sha256", process.env.JWT_SECRET || "maanak_setu_secret")
    .update(`${certificateNumber}-${application._id}-${stampCode}-${validUntil.toISOString()}`)
    .digest("hex");

  const certificate = new Certificate({
    certificateNumber,
    application: application._id,
    instrument: application.instrument._id,
    previousCertificate: application.previousCertificate || null,
    issueDate: new Date(),
    validFrom,
    validUntil,
    stampCode,
    certificateType: "VERIFICATION",
    qrCode: qrCodeDataUrl,
    digitalSignature,
    status: "ACTIVE",
  });

  await certificate.save();

  // If this was a re-verification and had a previous certificate, mark previous certificate as EXPIRED
  if (application.previousCertificate) {
    await Certificate.findByIdAndUpdate(application.previousCertificate, {
      status: "EXPIRED",
    });
  }

  // Generate PDF
  try {
    const pdfUrl = await generateCertificatePdf({
      certificate,
      application,
      instrument: application.instrument,
      shop: application.shop,
      officer: officerUser || application.assignedOfficer,
      qrDataUrl: qrCodeDataUrl,
    });
    certificate.pdfUrl = pdfUrl;
    await certificate.save();
  } catch (pdfErr) {
    console.error("PDF generation failed:", pdfErr.message);
  }

  // Update Application status to CERTIFICATE_ISSUED -> COMPLETED
  application.status = "COMPLETED";
  await application.save();

  // Update Instrument status to VERIFIED
  await Instrument.findByIdAndUpdate(application.instrument._id, {
    status: "VERIFIED",
  });

  // Notify applicant
  await createNotification({
    user: application.applicant._id,
    application: application._id,
    certificate: certificate._id,
    type: "CERTIFICATE_ISSUED",
    title: "Verification Certificate Issued",
    message: `Digital Verification Certificate ${certificate.certificateNumber} has been issued for instrument ${application.instrument.serialNumber}.`,
  });

  return certificate;
};
