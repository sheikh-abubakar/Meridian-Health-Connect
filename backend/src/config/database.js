import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDatabase() {
  await mongoose.connect(env.mongodbUri, {
    minPoolSize: 2,
    maxPoolSize: 20,
    maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  });
  await mongoose.connection.db.admin().ping();
  console.log("MongoDB connected");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
