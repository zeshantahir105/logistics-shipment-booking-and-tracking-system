import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI =
  process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/logistics?replicaSet=rs0';

/**
 * Cached connection promise — re-used across warm serverless invocations.
 * A new connection is only opened when the previous one is gone
 * (readyState 0 = disconnected, 3 = disconnecting).
 */
let connectionPromise: Promise<typeof mongoose> | null = null;

export function connectDB(): Promise<typeof mongoose> {
  const state = mongoose.connection.readyState;
  if (connectionPromise && state >= 1 && state <= 2) {
    // 1 = connected, 2 = connecting — reuse the existing promise
    return connectionPromise;
  }
  connectionPromise = mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10,
  });
  return connectionPromise;
}
