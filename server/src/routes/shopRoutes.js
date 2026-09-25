import express from "express";
import {
  createShop,
  getShops,
  getShopById,
  updateShop,
  deleteShop,
} from "../controllers/shopController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { validateObjectId } from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(requireAuth);

router.post("/", createShop);
router.get("/", getShops);
router.get("/:id", validateObjectId("id"), getShopById);
router.patch("/:id", validateObjectId("id"), updateShop);
router.delete("/:id", validateObjectId("id"), deleteShop);

export default router;
