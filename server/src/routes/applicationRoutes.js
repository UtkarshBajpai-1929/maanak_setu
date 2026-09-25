import express from "express";
import {
  createApplication,
  getApplications,
  getApplicationById,
  updateApplication,
  updateApplicationStatus,
  submitVerificationResult,
  rejectApplication,
} from "../controllers/applicationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { validateObjectId } from "../middleware/validateMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", upload.single("document"), createApplication);
router.get("/", getApplications);
router.get("/:id", validateObjectId("id"), getApplicationById);
router.patch("/:id", validateObjectId("id"), upload.single("document"), updateApplication);

// Officer workflow endpoints

router.patch(
  "/:id/status",
  validateObjectId("id"),
  authorizeRoles("OFFICER"),
  updateApplicationStatus
);

router.patch(
  "/:id/verify",
  validateObjectId("id"),
  authorizeRoles("OFFICER"),
  upload.single("photo"),
  submitVerificationResult
);

router.patch(
  "/:id/reject",
  validateObjectId("id"),
  authorizeRoles("OFFICER"),
  rejectApplication
);

export default router;
