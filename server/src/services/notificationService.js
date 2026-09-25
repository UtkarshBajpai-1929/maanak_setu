import Notification from "../models/notification.js";
import Certificate from "../models/certificate.js";

export const createNotification = async ({
  user,
  application = null,
  certificate = null,
  type,
  title,
  message,
  metadata = {},
  scheduledFor = null,
}) => {
  try {
    const notification = await Notification.create({
      user,
      application,
      certificate,
      type,
      title,
      message,
      metadata,
      scheduledFor,
    });
    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }
};

export const checkAndGenerateExpiryReminders = async () => {
  const now = new Date();
  const intervals = [30, 15, 7];
  const results = [];

  for (const days of intervals) {
    const targetStart = new Date(now);
    targetStart.setDate(targetStart.getDate() + days - 1);
    targetStart.setHours(0, 0, 0, 0);

    const targetEnd = new Date(now);
    targetEnd.setDate(targetEnd.getDate() + days);
    targetEnd.setHours(23, 59, 59, 999);

    const expiringCertificates = await Certificate.find({
      status: "ACTIVE",
      validUntil: { $gte: targetStart, $lte: targetEnd },
    }).populate({
      path: "application",
      select: "applicant instrument",
      populate: { path: "applicant", select: "name email phone" },
    });

    for (const cert of expiringCertificates) {
      const applicantId = cert.application?.applicant?._id;
      if (!applicantId) continue;

      const existingNotification = await Notification.findOne({
        user: applicantId,
        certificate: cert._id,
        type: "EXPIRY_REMINDER",
        "metadata.reminderDays": days,
      });

      if (!existingNotification) {
        const validUntilStr = new Date(cert.validUntil).toLocaleDateString("en-IN");
        const notif = await createNotification({
          user: applicantId,
          application: cert.application._id,
          certificate: cert._id,
          type: "EXPIRY_REMINDER",
          title: `Instrument Verification Expiry Reminder (${days} Days)`,
          message: `Verification Certificate ${cert.certificateNumber} will expire in approximately ${days} days on ${validUntilStr}. Please submit a Re-verification application before expiry.`,
          metadata: { reminderDays: days, certificateNumber: cert.certificateNumber },
        });
        results.push(notif);
      }
    }
  }

  // Also check if any active certificates have passed validUntil and update status to EXPIRED
  const expiredCount = await Certificate.updateMany(
    {
      status: "ACTIVE",
      validUntil: { $lt: now },
    },
    {
      $set: { status: "EXPIRED" },
    }
  );

  return { generatedCount: results.length, markedExpiredCount: expiredCount.modifiedCount || 0 };
};
