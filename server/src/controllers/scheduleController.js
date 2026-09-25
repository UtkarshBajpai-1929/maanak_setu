import Schedule from "../models/schedule.js";
import Application from "../models/application.js";
import Instrument from "../models/instrument.js";
import User from "../models/user.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { createNotification } from "../services/notificationService.js";

export const createSchedule = async (req, res, next) => {
  try {
    const {
      application: applicationId,
      officer: officerId,
      scheduledDate,
      verificationType,
      location,
      remarks,
    } = req.body;

    if (!applicationId || !scheduledDate || !verificationType) {
      throw new ApiError(
        400,
        "Please provide application, scheduledDate, and verificationType (FIELD or OFFICE)"
      );
    }

    if (!["FIELD", "OFFICE"].includes(verificationType)) {
      throw new ApiError(400, "verificationType must be either 'FIELD' or 'OFFICE'");
    }

    const application = await Application.findById(applicationId)
      .populate("instrument")
      .populate("shop")
      .populate("applicant");

    if (!application) {
      throw new ApiError(404, "Application not found");
    }

    // Role check: Only OFFICER
    let designatedOfficerId = officerId || application.assignedOfficer || req.user._id;

    const officer = await User.findById(designatedOfficerId);
    if (!officer) {
      throw new ApiError(404, "Assigned officer not found");
    }

    if (officer.role !== "OFFICER") {
      throw new ApiError(400, `Assigned user must be an officer with role OFFICER, has '${officer.role}'`);
    }

    // Determine location if not passed
    let scheduleLocation = location;
    if (!scheduleLocation && application.shop?.address) {
      scheduleLocation = application.shop.address;
    }

    const schedule = await Schedule.create({
      application: application._id,
      officer: officer._id,
      scheduledDate: new Date(scheduledDate),
      verificationType,
      location: scheduleLocation,
      status: "SCHEDULED",
      remarks,
    });

    // Update application
    application.assignedOfficer = officer._id;
    application.status = "SCHEDULED";
    await application.save();

    const formattedDate = new Date(scheduledDate).toLocaleString("en-IN");

    // Notify applicant
    await createNotification({
      user: application.applicant._id,
      application: application._id,
      type: "SCHEDULED",
      title: "Verification Scheduled",
      message: `Your verification for application ${application.applicationNumber} is scheduled for ${formattedDate} (${verificationType} verification).`,
    });

    return sendSuccess(res, 201, "Verification schedule created successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const getSchedules = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const query = {};

    if (req.user.role === "USER") {
      const userApps = await Application.find({ applicant: req.user._id }).select("_id");
      const appIds = userApps.map((a) => a._id);
      query.application = { $in: appIds };
    } else if (req.user.role === "OFFICER") {
      if (req.query.assignedOnly !== "false") {
        query.officer = req.user._id;
      }
    }

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.verificationType) {
      query.verificationType = req.query.verificationType;
    }

    if (req.query.application) {
      query.application = req.query.application;
    }

    const [schedules, total] = await Promise.all([
      Schedule.find(query)
        .populate({
          path: "application",
          select: "applicationNumber applicationType status applicant shop instrument",
          populate: [
            { path: "applicant", select: "name email phone" },
            { path: "shop", select: "shopName address" },
            { path: "instrument", select: "category serialNumber capacity" },
          ],
        })
        .populate("officer", "name email phone role")
        .sort({ scheduledDate: 1 })
        .skip(skip)
        .limit(limit),
      Schedule.countDocuments(query),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(res, 200, "Schedules retrieved successfully", schedules, {
      page,
      limit,
      total,
      totalPages,
    });
  } catch (error) {
    next(error);
  }
};

export const getScheduleById = async (req, res, next) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .populate({
        path: "application",
        populate: [
          { path: "applicant", select: "name email phone" },
          { path: "shop", select: "shopName address" },
          { path: "instrument", select: "category serialNumber capacity" },
        ],
      })
      .populate("officer", "name email phone role");

    if (!schedule) {
      throw new ApiError(404, "Schedule not found");
    }

    if (
      req.user.role === "USER" &&
      schedule.application?.applicant?._id?.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(403, "You do not have permission to view this schedule");
    }

    return sendSuccess(res, 200, "Schedule retrieved successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const updateSchedule = async (req, res, next) => {
  try {
    const { remarks, location } = req.body;
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      throw new ApiError(404, "Schedule not found");
    }

    if (remarks) schedule.remarks = remarks;
    if (location) schedule.location = { ...schedule.location, ...location };

    await schedule.save();

    return sendSuccess(res, 200, "Schedule updated successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const reschedule = async (req, res, next) => {
  try {
    const { scheduledDate, rescheduleReason } = req.body;

    if (!scheduledDate) {
      throw new ApiError(400, "New scheduledDate is required");
    }

    const schedule = await Schedule.findById(req.params.id).populate({
      path: "application",
      populate: { path: "applicant" },
    });

    if (!schedule) {
      throw new ApiError(404, "Schedule not found");
    }

    schedule.scheduledDate = new Date(scheduledDate);
    schedule.status = "RESCHEDULED";
    schedule.rescheduleReason = rescheduleReason || "Operational requirement";
    await schedule.save();

    const formattedDate = new Date(scheduledDate).toLocaleString("en-IN");

    if (schedule.application?.applicant) {
      await createNotification({
        user: schedule.application.applicant._id,
        application: schedule.application._id,
        type: "SCHEDULED",
        title: "Verification Rescheduled",
        message: `Your verification for application ${schedule.application.applicationNumber} has been rescheduled to ${formattedDate}. Reason: ${schedule.rescheduleReason}`,
      });
    }

    return sendSuccess(res, 200, "Verification rescheduled successfully", schedule);
  } catch (error) {
    next(error);
  }
};

export const cancelSchedule = async (req, res, next) => {
  try {
    const { remarks } = req.body;
    const schedule = await Schedule.findById(req.params.id).populate({
      path: "application",
      populate: { path: "applicant" },
    });

    if (!schedule) {
      throw new ApiError(404, "Schedule not found");
    }

    schedule.status = "CANCELLED";
    if (remarks) schedule.remarks = remarks;
    await schedule.save();

    if (schedule.application?.applicant) {
      await createNotification({
        user: schedule.application.applicant._id,
        application: schedule.application._id,
        type: "APPLICATION_UPDATE",
        title: "Verification Schedule Cancelled",
        message: `The scheduled verification for application ${schedule.application.applicationNumber} was cancelled.`,
      });
    }

    return sendSuccess(res, 200, "Schedule cancelled successfully", schedule);
  } catch (error) {
    next(error);
  }
};
