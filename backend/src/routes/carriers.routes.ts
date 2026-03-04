import { Router } from 'express';
import { listCarriers, searchCarrierServices } from '../modules/carriers/controller';

export const carrierRouter = Router();

// GET /api/carriers          — list all carriers (for filter dropdown)
carrierRouter.get('/', listCarriers);

// GET /api/carriers/services — search carrier services
carrierRouter.get('/services', searchCarrierServices);
