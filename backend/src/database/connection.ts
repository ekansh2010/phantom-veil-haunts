import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { seedDatabase } from "./seed.js";

/**
 * Serverless-safe connection cache. Each warm function instance reuses the same
 * promise (connect + seed) instead of opening a connection per request.
 */
let connectionPromise: Promise<typeof mongoose> | null = null;

export const connectDb = async (uri: string = env.MONGODB_URI): Promise<typeof mongoose> => {
  if (connectionPromise) return connectionPromise;
  if (mongoose.connection.readyState === 1) return mongoose;

  mongoose.set("strictQuery", true);
  connectionPromise = mongoose
    .connect(uri, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 10 })
    .then(async (conn) => {
      logger.info("Connected to MongoDB");
      await seedDatabase();
      return conn;
    })
    .catch((err) => {
      // Reset so the next request retries instead of reusing a rejected promise.
      connectionPromise = null;
      throw err;
    });
  return connectionPromise;
};

export const disconnectDb = async (): Promise<void> => {
  connectionPromise = null;
  await mongoose.disconnect();
};

export const isDbConnected = (): boolean => mongoose.connection.readyState === 1;
