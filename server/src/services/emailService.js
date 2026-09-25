import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import User from "../models/user.js";
import Shop from "../models/shop.js";

// Cached transporter instance
let transporterInstance = null;

/**
 * Creates or returns the cached SMTP transporter from environment variables.
 * Environment variables used:
 * - SMTP_HOST
 * - SMTP_PORT (default: 587)
 * - SMTP_USER
 * - SMTP_PASSWORD
 * - SMTP_FROM (default fallback provided)
 * - SMTP_SECURE ("true" for SSL port 465, false otherwise)
 */
export const createTransporter = () => {
  if (transporterInstance) {
    return transporterInstance;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user) {
    return null;
  }

  transporterInstance = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
  });

  return transporterInstance;
};

/**
 * Sets a custom transporter (useful for testing or dependency injection)
 */
export const setTransporter = (transporter) => {
  transporterInstance = transporter;
};

/**
 * Resets the cached transporter instance
 */
export const resetTransporter = () => {
  transporterInstance = null;
};

/**
 * Verifies the SMTP configuration connection.
 * Reports whether the SMTP server is reachable and credentials are valid.
 * Does not throw an error if the connection fails.
 */
export const verifyEmailTransport = async (transporterOverride = null) => {
  try {
    const transporter = transporterOverride || createTransporter();
    if (!transporter) {
      console.warn("[EmailService] SMTP transporter is not configured. Missing SMTP_HOST or SMTP_USER.");
      return {
        isConnected: false,
        error: "SMTP transporter is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in .env",
      };
    }

    await transporter.verify();
    console.log("[EmailService] SMTP connection established and verified successfully.");
    return { isConnected: true };
  } catch (error) {
    console.error("[EmailService] SMTP connection verification failed:", error.message);
    return {
      isConnected: false,
      error: error.message,
    };
  }
};

/**
 * Resolves the recipient (Shop Owner / User) using existing relationships:
 * Instrument -> Shop -> Shop Owner (User) -> Email (fallback to Application.applicant)
 */
export const resolveRecipient = async ({ application, instrument, shop }) => {
  try {
    let targetShop = shop || application?.shop;

    // If shop is an ObjectId or lacks owner details, fetch it
    if (targetShop && (!targetShop.owner || typeof targetShop.owner === "string")) {
      const foundShop = await Shop.findById(targetShop._id || targetShop).populate("owner", "name email phone");
      if (foundShop) {
        targetShop = foundShop;
      }
    }

    // If instrument is provided and shop still not found, check instrument.shop
    if (!targetShop && instrument?.shop) {
      targetShop = await Shop.findById(instrument.shop._id || instrument.shop).populate("owner", "name email phone");
    }

    let owner = targetShop?.owner;

    // If owner is an unpopulated ObjectId, populate it
    if (owner && (!owner.email || typeof owner === "string")) {
      const foundUser = await User.findById(owner._id || owner).select("name email phone");
      if (foundUser) {
        owner = foundUser;
      }
    }

    // Fallback to application applicant if shop owner or email is missing
    if (!owner?.email && application?.applicant) {
      if (application.applicant.email) {
        owner = application.applicant;
      } else {
        owner = await User.findById(application.applicant._id || application.applicant).select("name email phone");
      }
    }

    if (!owner || !owner.email) {
      return null;
    }

    return {
      _id: owner._id,
      name: owner.name || "Valued Merchant",
      email: owner.email,
      phone: owner.phone,
    };
  } catch (err) {
    console.warn("[EmailService] Error resolving recipient:", err.message);
    return null;
  }
};

/**
 * Formats verification date strings nicely for email display
 */
const formatDate = (date) => {
  if (!date) return "N/A";
  try {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
};

/**
 * Sends a verification success email with the digital certificate PDF attachment.
 * Only sends after successful verification and certificate generation.
 * Handles missing email, missing attachments, and SMTP failures gracefully without throwing.
 */
export const sendVerificationSuccessEmail = async ({
  application,
  certificate,
  instrument,
  shop,
  officer,
  transporterOverride = null,
}) => {
  try {
    if (!certificate || !certificate.certificateNumber) {
      console.warn("[EmailService] Missing certificate details. Email dispatch aborted.");
      return { success: false, reason: "MISSING_CERTIFICATE" };
    }

    // 1. Resolve recipient (Instrument -> Shop -> Shop Owner / User -> Email)
    const recipient = await resolveRecipient({ application, instrument, shop });

    if (!recipient || !recipient.email) {
      const machineNo = instrument?.serialNumber || "Unknown";
      console.warn(
        `[EmailService] Required user/shop email is missing for instrument [${machineNo}]. Email dispatch skipped.`
      );
      return {
        success: false,
        reason: "MISSING_RECIPIENT_EMAIL",
        message: "No valid recipient email associated with this instrument or shop owner",
      };
    }

    // 2. Obtain SMTP Transporter
    const transporter = transporterOverride || createTransporter();
    if (!transporter) {
      console.warn("[EmailService] SMTP transporter is not configured. Email notification skipped.");
      return {
        success: false,
        reason: "SMTP_NOT_CONFIGURED",
        message: "SMTP credentials not configured in environment variables",
      };
    }

    // 3. Locate certificate PDF attachment
    const attachments = [];
    const certNum = certificate.certificateNumber;
    const serialNum = instrument?.serialNumber || certNum;

    // Check potential locations on disk
    let pdfPath = null;
    if (certificate.pdfUrl) {
      const relativeClean = certificate.pdfUrl.replace(/^\//, "");
      const fullFromUrl = path.resolve(process.cwd(), relativeClean);
      if (fs.existsSync(fullFromUrl)) {
        pdfPath = fullFromUrl;
      }
    }

    if (!pdfPath) {
      const defaultPath = path.resolve(process.cwd(), "uploads", "certificates", `${certNum}.pdf`);
      if (fs.existsSync(defaultPath)) {
        pdfPath = defaultPath;
      }
    }

    if (pdfPath) {
      attachments.push({
        filename: `Verification_Certificate_${serialNum}.pdf`,
        path: pdfPath,
        contentType: "application/pdf",
      });
    } else {
      console.warn(
        `[EmailService] Certificate PDF file not found on disk for ${certNum}. Email will be sent without attachment.`
      );
    }

    // 4. Build email content
    const machineNumber = instrument?.serialNumber || "N/A";
    const instrumentType = instrument?.category || "Legal Metrology Equipment";
    const verificationDateStr = formatDate(
      application?.verificationDetails?.verificationDate || certificate.issueDate
    );
    const validUntilStr = formatDate(certificate.validUntil);
    const certificateNumber = certificate.certificateNumber;
    const recipientName = recipient.name || "Shop Owner";

    const subject = `Verification Successful - ${machineNumber}`;

    const textBody = `Dear ${recipientName},

We are pleased to inform you that the verification of your weighing/measuring instrument has been successfully completed.

Instrument Details:

Instrument/Machine No.: ${machineNumber}
Instrument Type: ${instrumentType}
Verification Date: ${verificationDateStr}
Valid Until: ${validUntilStr}
Certificate No.: ${certificateNumber}

Your digital verification certificate is attached to this email.

Please retain this certificate for your records.

Regards,
MaanakSetu
Legal Metrology Verification System`;

    const htmlBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2D3748; background-color: #F7FAFC; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #E2E8F0; }
    .header { background: #1A365D; color: #FFFFFF; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #CBD5E0; }
    .content { padding: 30px; }
    .badge-success { display: inline-block; background: #C6F6D5; color: #22543D; font-weight: 600; font-size: 13px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 16px; }
    .details-box { background: #F7FAFC; border: 1px solid #EDF2F7; border-radius: 6px; padding: 18px; margin: 20px 0; }
    .details-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #EDF2F7; font-size: 14px; }
    .details-row:last-child { border-bottom: none; }
    .details-label { color: #718096; font-weight: 500; }
    .details-value { color: #1A202C; font-weight: 600; text-align: right; }
    .footer { background: #EDF2F7; padding: 20px; text-align: center; font-size: 12px; color: #718096; }
    .footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Department of Legal Metrology</h1>
      <p>MaanakSetu Online Verification System</p>
    </div>
    <div class="content">
      <span class="badge-success">&#10003; Verification Passed</span>
      <p>Dear <strong>${recipientName}</strong>,</p>
      <p>We are pleased to inform you that the statutory verification of your weighing/measuring instrument has been successfully completed.</p>

      <div class="details-box">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; color: #718096; font-weight: 500; font-size: 14px;">Instrument/Machine No.:</td>
            <td style="padding: 6px 0; color: #1A202C; font-weight: 600; font-size: 14px; text-align: right;">${machineNumber}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #718096; font-weight: 500; font-size: 14px;">Instrument Type:</td>
            <td style="padding: 6px 0; color: #1A202C; font-weight: 600; font-size: 14px; text-align: right;">${instrumentType}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #718096; font-weight: 500; font-size: 14px;">Verification Date:</td>
            <td style="padding: 6px 0; color: #1A202C; font-weight: 600; font-size: 14px; text-align: right;">${verificationDateStr}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #718096; font-weight: 500; font-size: 14px;">Valid Until:</td>
            <td style="padding: 6px 0; color: #22543D; font-weight: 700; font-size: 14px; text-align: right;">${validUntilStr}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #718096; font-weight: 500; font-size: 14px;">Certificate No.:</td>
            <td style="padding: 6px 0; color: #2B6CB0; font-weight: 600; font-size: 14px; text-align: right;">${certificateNumber}</td>
          </tr>
        </table>
      </div>

      <p>Your official digital verification certificate is attached to this email as a PDF document. Please retain this certificate for your records and statutory compliance inspections.</p>
      
      <p style="margin-top: 24px;">
        Regards,<br>
        <strong>MaanakSetu</strong><br>
        Legal Metrology Verification System
      </p>
    </div>
    <div class="footer">
      <p>This is an automated system notification issued under the Legal Metrology Act, 2009.</p>
      <p>Government of India &bull; Department of Consumer Affairs</p>
    </div>
  </div>
</body>
</html>`;

    const fromAddress =
      process.env.SMTP_FROM ||
      `"MaanakSetu Legal Metrology" <${process.env.SMTP_USER || "no-reply@maanaksetu.gov.in"}>`;

    const mailOptions = {
      from: fromAddress,
      to: recipient.email,
      subject,
      text: textBody,
      html: htmlBody,
      attachments,
    };

    const sendResult = await transporter.sendMail(mailOptions);

    console.log(
      `[EmailService] Verification certificate email sent successfully to ${recipient.email} for instrument [${machineNumber}]. MessageId: ${sendResult.messageId}`
    );

    return {
      success: true,
      recipientEmail: recipient.email,
      messageId: sendResult.messageId,
      hasAttachment: attachments.length > 0,
      sentAt: new Date(),
    };
  } catch (error) {
    // Crucial requirement: Email failure must NOT throw or fail the verification
    console.error(
      `[EmailService] Failed to send verification certificate email for instrument ${instrument?.serialNumber || "unknown"}:`,
      error.message
    );

    return {
      success: false,
      error: error.message,
      status: "FAILED",
    };
  }
};
