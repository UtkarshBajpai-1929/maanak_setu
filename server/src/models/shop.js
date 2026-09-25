import mongoose from "mongoose";

const shopSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    shopName: {
      type: String,
      required: true,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    address: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      length: 6,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    operational_time:{
      closing: String,
      opening: String
    }
  },
  {
    timestamps: true,
  }
);

const Shop = mongoose.model("Shop", shopSchema);

export default Shop;