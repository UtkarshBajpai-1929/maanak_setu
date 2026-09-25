import express from "express";
import {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  reschedule,
  cancelSchedule,
} from "../controllers/scheduleController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateObjectId } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", authorizeRoles("OFFICER"), createSchedule);
router.get("/", getSchedules);
router.get("/:id", validateObjectId("id"), getScheduleById);
router.patch(
  "/:id",
  validateObjectId("id"),
  authorizeRoles("OFFICER"),
  updateSchedule
);
router.patch(
  "/:id/reschedule",
  validateObjectId("id"),
  authorizeRoles("OFFICER"),
  reschedule
);
router.patch(
  "/:id/cancel",
  validateObjectId("id"),
  authorizeRoles("OFFICER"),
  cancelSchedule
);

export default router;
