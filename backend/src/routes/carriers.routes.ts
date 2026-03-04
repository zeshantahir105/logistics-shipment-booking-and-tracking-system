import { Router } from 'express';
import { searchCarrierServices } from '../modules/carriers/controller';

export const carrierRouter = Router();

// GET /api/carriers/services
carrierRouter.get('/services', searchCarrierServices);

