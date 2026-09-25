import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Application",
      required: true,
    },

    officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    scheduledDate: {
      type: Date,
      required: true,
    },

    verificationType: {
      type: String,
      enum: ["FIELD", "OFFICE"],
      required: true,
    },

    location: {
      address: String,
      district: String,
      state: String,
      pincode: String,
    },

    status: {
      type: String,
      enum: [
        "SCHEDULED",
        "RESCHEDULED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "SCHEDULED",
    },

    rescheduleReason: {
      type: String,
      trim: true,
    },

    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Schedule = mongoose.model("Schedule", scheduleSchema);

export default Schedule;