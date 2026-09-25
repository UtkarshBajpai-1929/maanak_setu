import express from "express";
import {
  createInstrument,
  getInstruments,
  getInstrumentById,
  updateInstrument,
  deleteInstrument,
} from "../controllers/instrumentController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateObjectId } from "../middleware/validateMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", upload.single("document"), createInstrument);
router.get("/", getInstruments);
router.get("/:id", validateObjectId("id"), getInstrumentById);
router.patch("/:id", validateObjectId("id"), upload.single("document"), updateInstrument);
router.delete("/:id", validateObjectId("id"), deleteInstrument);

export default router;
