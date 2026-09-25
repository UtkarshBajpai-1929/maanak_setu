import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    applicationNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    instrument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Instrument",
      required: true,
    },

    applicationType: {
      type: String,
      enum: ["FRESH", "RE_VERIFICATION"],
      required: true,
    },

    reason: {
      type: String,
      enum: [
        "ROUTINE_EXPIRY",
        "REPAIR",
        "DISMANTLING",
        "REINSTALLATION",
      ],
    },

    previousCertificate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Certificate",
      default: null,
    },

    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: [
        "SUBMITTED",
        "UNDER_REVIEW",
        "SCHEDULED",
        "VERIFICATION_PENDING",
        "VERIFIED",
        "REJECTED",
        "CERTIFICATE_ISSUED",
        "COMPLETED",
      ],
      default: "SUBMITTED",
    },

    remarks: {
      type: String,
      trim: true,
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    documents: [
      {
        title: { type: String, trim: true },
        documentType: { type: String, trim: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    verificationDetails: {
      verificationDate: { type: Date },
      officer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      instrumentCondition: { type: String, trim: true },
      testReadings: [
        {
          parameter: { type: String, trim: true },
          standardValue: { type: String, trim: true },
          observedValue: { type: String, trim: true },
          error: { type: String, trim: true },
          pass: { type: Boolean, default: true },
        },
      ],
      outcome: {
        type: String,
        enum: ["PASS", "FAIL", "REJECTED"],
      },
      defectDescription: { type: String, trim: true },
      repairableStatus: {
        type: String,
        enum: ["REPAIRABLE", "NON_REPAIRABLE", "NOT_APPLICABLE"],
        default: "NOT_APPLICABLE",
      },
      resubmissionDeadline: { type: Date },
      stampCode: { type: String, trim: true },
      photographs: [{ type: String, trim: true }],
      defectPhotographs: [{ type: String, trim: true }],
      remarks: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

const Application = mongoose.model("Application", applicationSchema);

export default Application;