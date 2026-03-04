import type { Request, Response, NextFunction } from 'express';
import {
  createDraft,
  listShipmentsService,
  getShipmentDetail,
  updateDraft,
  addOrUpdateLegsService,
  deleteLegService,
  submitShipmentService,
  updateStatusService,
  createExceptionService,
  resolveExceptionService,
} from './service';

export async function createShipmentDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const shipment = await createDraft(req.body);
    res.status(201).json(shipment);
  } catch (err) {
    next(err);
  }
}

export async function listShipments(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, shipmentNumber, page, pageSize } = req.query;
    const result = await listShipmentsService({
      status: status as any,
      shipmentNumber: shipmentNumber as string | undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getShipmentById(req: Request, res: Response, next: NextFunction) {
  try {
    const detail = await getShipmentDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    next(err);
  }
}

export async function updateShipmentDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const shipmentId = req.params.id;
    const shipment = await updateDraft(shipmentId, req.body);
    res.json(shipment);
  } catch (err) {
    next(err);
  }
}

export async function addOrUpdateLegs(req: Request, res: Response, next: NextFunction) {
  try {
    const legs = await addOrUpdateLegsService(req.params.id, req.body);
    res.json(legs);
  } catch (err) {
    next(err);
  }
}

export async function deleteLeg(req: Request, res: Response, next: NextFunction) {
  try {
    const legs = await deleteLegService(req.params.id, req.params.legId);
    res.json(legs);
  } catch (err) {
    next(err);
  }
}

export async function submitShipment(req: Request, res: Response, next: NextFunction) {
  try {
    const idempotencyKey = req.header('Idempotency-Key') || undefined;
    const result = await submitShipmentService(req.params.id, idempotencyKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateShipmentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateStatusService(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function createException(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await createExceptionService(req.params.id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resolveException(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await resolveExceptionService(req.params.id, req.params.exceptionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

