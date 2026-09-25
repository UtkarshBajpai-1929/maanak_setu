import mongoose from "mongoose";

const connectDB = async (customUri = null) => {
  try {
    const uri = customUri || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/maanak_setu";
    await mongoose.connect(uri);
    console.log(`MongoDB connected successfully to ${uri.includes("@") ? uri.split("@")[1] : uri}`);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
    throw error;
  }
};

export default connectDB;