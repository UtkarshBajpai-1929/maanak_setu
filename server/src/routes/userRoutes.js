import express from "express";
import { getMyProfile, updateMyProfile } from "../controllers/userController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);

export default router;
