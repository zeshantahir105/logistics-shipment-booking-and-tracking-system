import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { json } from 'body-parser';
import { carrierRouter } from './routes/carriers.routes';
import { shipmentRouter } from './routes/shipments.routes';
import { errorHandler } from './common/middleware/errorHandler';

dotenv.config();

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(json());

app.use('/api/carriers', carrierRouter);
app.use('/api/shipments', shipmentRouter);

app.use(errorHandler);

