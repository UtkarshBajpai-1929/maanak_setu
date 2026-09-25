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
    licenseNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    address: {
      street: String,
      city: String,
      district: String,
      state: String,
      pincode: String,
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