import mongoose from "mongoose";

const connectDB = async () => {
  try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Db connected successfully");
    
  } catch (err) {
    console.log(err);
  }
};

export default connectDB;