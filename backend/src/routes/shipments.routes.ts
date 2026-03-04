import { Router } from 'express';
import {
  createShipmentDraft,
  listShipments,
  getShipmentById,
  updateShipmentDraft,
  addOrUpdateLegs,
  deleteLeg,
  submitShipment,
  updateShipmentStatus,
  createException,
  resolveException,
} from '../modules/shipments/controller';

export const shipmentRouter = Router();

shipmentRouter.post('/drafts', createShipmentDraft);
shipmentRouter.get('/', listShipments);
shipmentRouter.get('/:id', getShipmentById);
shipmentRouter.patch('/:id', updateShipmentDraft);
shipmentRouter.post('/:id/legs', addOrUpdateLegs);
shipmentRouter.delete('/:id/legs/:legId', deleteLeg);
shipmentRouter.post('/:id/submit', submitShipment);
shipmentRouter.post('/:id/status', updateShipmentStatus);
shipmentRouter.post('/:id/exceptions', createException);
shipmentRouter.post('/:id/exceptions/:exceptionId/resolve', resolveException);

