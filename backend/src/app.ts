import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { json } from 'body-parser';
import { carrierRouter } from './routes/carriers.routes';
import { shipmentRouter } from './routes/shipments.routes';
import { errorHandler } from './common/middleware/errorHandler';
import { connectDB } from './lib/db';

dotenv.config();

// Transform all Mongoose documents globally: expose `id` (string) instead of
// `_id`, and strip the internal `__v` version key from every API response.
mongoose.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: Record<string, unknown>) => {
    ret['id'] = (ret['_id'] as { toString(): string } | undefined)?.toString();
    delete ret['_id'];
    delete ret['__v'];
  },
});

export const app = express();

// Ensure a live MongoDB connection before every request.
// In serverless environments the connection is cached and reused across
// warm invocations; in long-running processes it is established once.
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(json());

app.use('/api/carriers', carrierRouter);
app.use('/api/shipments', shipmentRouter);

app.use(errorHandler);
