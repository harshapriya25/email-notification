
import mongoose from "mongoose";

let isConnected = false;

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing.");
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(process.env.MONGODB_URI);

  isConnected = mongoose.connection.readyState === 1;

  console.log("MongoDB connected");
}
