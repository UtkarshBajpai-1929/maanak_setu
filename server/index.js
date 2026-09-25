import express from "express";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import connectDB from "./src/db/index.js";
import authRoutes from "./src/routes/authRoutes.js";
import userRoutes from "./src/routes/userRoutes.js";
import shopRoutes from "./src/routes/shopRoutes.js";
import instrumentRoutes from "./src/routes/instrumentRoutes.js";
import applicationRoutes from "./src/routes/applicationRoutes.js";
import scheduleRoutes from "./src/routes/scheduleRoutes.js";
import certificateRoutes from "./src/routes/certificateRoutes.js";
import notificationRoutes from "./src/routes/notificationRoutes.js";

import { notFoundHandler, errorHandler } from "./src/middleware/errorMiddleware.js";

dotenv.config();

const app = express();

// Security middleware
app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, React Native, Flutter, Postman)
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);

// General middleware
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting on API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
});
app.use("/api", apiLimiter);

// Serve uploads directory statically
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// System health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "MaanakSetu Legal Metrology Verification System API is operational",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Mount modular API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/instruments", instrumentRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/notifications", notificationRoutes);

// Centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);
const PORT = process.env.PORT || 3000;
const isTest =
  process.env.NODE_ENV === "test" ||
  process.argv.some((arg) => arg.includes("test"));

if (!isTest) {
  connectDB();
  app.listen(PORT, () => {
    console.log(`MaanakSetu server running on port ${PORT}`);
  });
}

export default app;