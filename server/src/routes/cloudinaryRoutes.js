import express from "express";
import { getUploadSignature } from "../controllers/cloudinaryController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/signature", getUploadSignature);

export default router;
