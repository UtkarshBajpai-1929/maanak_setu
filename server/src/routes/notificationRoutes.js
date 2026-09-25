import express from "express";
import {
  getMyNotifications,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead,
  triggerExpiryCheck,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateObjectId } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", getMyNotifications);
router.get("/unread", getUnreadNotifications);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", validateObjectId("id"), markAsRead);
router.post("/trigger-reminders", authorizeRoles("OFFICER"), triggerExpiryCheck);

export default router;
