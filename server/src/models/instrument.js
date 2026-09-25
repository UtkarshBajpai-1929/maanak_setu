import mongoose from "mongoose";

const instrumentSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "WEIGHING_SCALE",
        "WEIGHBRIDGE",
        "WATER_METER",
        "FUEL_DISPENSER",
        "TANK_LORRY",
        "LOAD_CELL",
        "GAS_METER",
        "ENERGY_METER",
        "FLOW_METER",
        "SPEED_GUN",
        "BREATH_ANALYZER",
        "MOISTURE_METER",
        "SPHYGMOMANOMETER",
        "CLINICAL_THERMOMETER",
        "TAPE_MEASURE",
        "OTHER",
      ],
    },

    serialNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    capacity: {
      type: String,
    },

    manufacturingDate: {
      type: Date,
    },

    purchaseDate: {
      type: Date,
    },

    installationType: {
      type: String,
      enum: ["FIXED", "MOVABLE"],
      required: true,
    },

    modelApprovalCertificateNumber: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "PENDING_VERIFICATION",
        "VERIFIED",
        "REJECTED",
        "EXPIRED",
        "DUE_FOR_REVERIFICATION",
      ],
      default: "PENDING_VERIFICATION",
    },

    documents: [
      {
        title: { type: String, trim: true },
        documentType: { type: String, trim: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Instrument = mongoose.model("Instrument", instrumentSchema);

export default Instrument;