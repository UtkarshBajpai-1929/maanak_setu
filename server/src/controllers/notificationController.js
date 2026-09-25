import Notification from "../models/notification.js";
import ApiError from "../utils/apiError.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { checkAndGenerateExpiryReminders } from "../services/notificationService.js";

export const getMyNotifications = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    if (req.query.isRead !== undefined) {
      query.isRead = req.query.isRead === "true";
    }

    if (req.query.type) {
      query.type = req.query.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate("application", "applicationNumber status")
        .populate("certificate", "certificateNumber validUntil status")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return sendSuccess(
      res,
      200,
      "Notifications retrieved successfully",
      {
        notifications,
        unreadCount,
      },
      {
        page,
        limit,
        total,
        totalPages,
      }
    );
  } catch (error) {
    next(error);
  }
};

export const getUnreadNotifications = async (req, res, next) => {
  try {
    const [unreadNotifications, count] = await Promise.all([
      Notification.find({ user: req.user._id, isRead: false })
        .populate("application", "applicationNumber status")
        .populate("certificate", "certificateNumber validUntil status")
        .sort({ createdAt: -1 })
        .limit(10),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    return sendSuccess(res, 200, "Unread notifications count and recent items retrieved", {
      unreadCount: count,
      notifications: unreadNotifications,
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!notification) {
      throw new ApiError(404, "Notification not found");
    }

    notification.isRead = true;
    await notification.save();

    return sendSuccess(res, 200, "Notification marked as read", notification);
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    return sendSuccess(res, 200, "All notifications marked as read", {
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

export const triggerExpiryCheck = async (req, res, next) => {
  try {
    const result = await checkAndGenerateExpiryReminders();
    return sendSuccess(res, 200, "Expiry reminders processed successfully", result);
  } catch (error) {
    next(error);
  }
};
