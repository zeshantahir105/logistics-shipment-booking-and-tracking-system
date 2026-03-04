import mongoose from 'mongoose';
import { z } from 'zod';
import {
  Shipment,
  ShipmentLeg,
  ShipmentStatusHistory,
  type ShipmentDoc,
  type ShipmentLegDoc,
  type ShipmentStatus,
  type LegStatus,
} from './models';
import { CarrierService } from '../carriers/models';
import { AppError } from '../../common/AppError';

const draftSchema = z.object({
  shipper: z.object({
    name: z.string().min(1, 'Shipper name is required'),
    contactEmail: z.string().email('Invalid email address'),
  }),
  pickupAddress: z.object({
    line1: z.string().min(1, 'Pickup address line 1 is required'),
    line2: z.string().optional(),
    city: z.string().min(1, 'Pickup city is required'),
    country: z.string().min(1, 'Pickup country is required'),
  }),
  deliveryAddress: z.object({
    line1: z.string().min(1, 'Delivery address line 1 is required'),
    line2: z.string().optional(),
    city: z.string().min(1, 'Delivery city is required'),
    country: z.string().min(1, 'Delivery country is required'),
  }),
  cargo: z.object({
    type: z.string().min(1, 'Cargo type is required'),
    weight: z.number().positive('Weight must be greater than 0'),
    volume: z.number().positive('Volume must be greater than 0'),
  }),
  requiredDeliveryDate: z.string().datetime().nullable().optional(),
});

export async function createDraft(input: unknown): Promise<ShipmentDoc> {
  const parsed = draftSchema.parse(input);

  // Generate a short human-readable ID before insert so we can store it
  const tempId = new mongoose.Types.ObjectId();
  const shortId = tempId.toString().slice(-6).toUpperCase();

  const shipment = await Shipment.create({
    _id: tempId,
    shortId,
    shipper: parsed.shipper,
    pickupAddress: parsed.pickupAddress,
    deliveryAddress: parsed.deliveryAddress,
    cargo: parsed.cargo,
    requiredDeliveryDate: parsed.requiredDeliveryDate
      ? new Date(parsed.requiredDeliveryDate)
      : null,
    status: 'Draft',
    version: 1,
  });

  await ShipmentStatusHistory.create({
    shipmentId: shipment._id,
    changedAt: new Date(),
    fromStatus: 'Draft',
    toStatus: 'Draft',
    note: 'Draft created',
  });

  return shipment;
}

const updateDraftSchema = draftSchema.extend({
  version: z.number().int().positive(),
});

export async function updateDraft(
  shipmentId: string,
  input: unknown
): Promise<ShipmentDoc> {
  const parsed = updateDraftSchema.parse(input);

  const shipment = await Shipment.findOne({
    _id: shipmentId,
    status: 'Draft',
    version: parsed.version,
  });

  if (!shipment) {
    throw new AppError(
      'Draft not found or version conflict — the draft may have been modified by another request',
      409
    );
  }

  shipment.shipper = parsed.shipper;
  shipment.pickupAddress = parsed.pickupAddress;
  shipment.deliveryAddress = parsed.deliveryAddress;
  shipment.cargo = parsed.cargo;
  shipment.requiredDeliveryDate = parsed.requiredDeliveryDate
    ? new Date(parsed.requiredDeliveryDate)
    : null;
  shipment.version += 1;

  await shipment.save();
  return shipment;
}

export interface ListShipmentsParams {
  status?: ShipmentStatus;
  shipmentNumber?: string;
  page?: number;
  pageSize?: number;
}

export async function listShipmentsService(params: ListShipmentsParams) {
  const { status, shipmentNumber, page = 1, pageSize = 20 } = params;
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (shipmentNumber) {
    const term = shipmentNumber.trim();
    filter.$or = [
      { shipmentNumber: { $regex: term, $options: 'i' } },
      { shortId: { $regex: term, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    Shipment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    Shipment.countDocuments(filter),
  ]);

  return { items, total };
}

export async function getShipmentDetail(id: string) {
  const shipment = await Shipment.findById(id);
  if (!shipment) {
    throw new AppError('Shipment not found', 404);
  }

  const [legs, history] = await Promise.all([
    ShipmentLeg.find({ shipmentId: shipment._id }).sort({ sequence: 1 }),
    ShipmentStatusHistory.find({ shipmentId: shipment._id }).sort({ changedAt: 1 }),
  ]);

  return { shipment, legs, history };
}

const legInputSchema = z.object({
  id: z.string().optional(),
  sequence: z.number().int().positive(),
  carrierServiceId: z.string().min(1),
  scheduledDeparture: z.string().datetime(),
  scheduledArrival: z.string().datetime(),
});

const legsPayloadSchema = z.object({
  legs: z.array(legInputSchema).min(1, 'At least one leg is required'),
});

export async function addOrUpdateLegsService(
  shipmentId: string,
  body: unknown
): Promise<ShipmentLegDoc[]> {
  const { legs } = legsPayloadSchema.parse(body);

  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) {
    throw new AppError('Shipment not found', 404);
  }
  if (shipment.status !== 'Draft') {
    throw new AppError('Legs can only be modified while shipment is in Draft', 409);
  }

  const carrierServices = await CarrierService.find({
    _id: { $in: legs.map((l) => l.carrierServiceId) },
  });
  if (carrierServices.length !== legs.length) {
    throw new AppError('One or more carrier services not found', 400);
  }

  const groupIds = new Set(carrierServices.map((s) => s.carrierGroupId));
  if (groupIds.size > 1) {
    throw new AppError(
      'All legs must belong to a single carrier group — mixed carrier groups are not allowed',
      409
    );
  }

  const carrierGroupId = carrierServices[0].carrierGroupId;
  shipment.carrierGroupId = carrierGroupId;

  const totalWeight = shipment.cargo.weight;
  const totalVolume = shipment.cargo.volume;
  const maxWeight = Math.min(...carrierServices.map((s) => s.maxWeight));
  const maxVolume = Math.min(...carrierServices.map((s) => s.maxVolume));

  if (totalWeight > maxWeight || totalVolume > maxVolume) {
    throw new AppError('Shipment exceeds carrier service capacity limits', 400, {
      totalWeight,
      totalVolume,
      maxWeight,
      maxVolume,
    });
  }

  await shipment.save();

  for (const leg of legs) {
    const service = carrierServices.find((s) => s._id.equals(leg.carrierServiceId as string));
    if (!service) continue;

    const baseData = {
      shipmentId: shipment._id,
      sequence: leg.sequence,
      carrierServiceId: service._id,
      mode: service.mode,
      origin: service.origin,
      destination: service.destination,
      scheduledDeparture: new Date(leg.scheduledDeparture),
      scheduledArrival: new Date(leg.scheduledArrival),
      transitDays: service.transitDays,
      price: service.basePrice,
      currency: service.currency,
      status: 'Draft' as LegStatus,
    };

    if (leg.id) {
      await ShipmentLeg.findOneAndUpdate(
        { _id: leg.id, shipmentId: shipment._id },
        baseData,
        { new: true }
      );
    } else {
      await ShipmentLeg.create(baseData);
    }
  }

  return ShipmentLeg.find({ shipmentId: shipment._id }).sort({ sequence: 1 });
}

export async function deleteLegService(shipmentId: string, legId: string) {
  const shipment = await Shipment.findById(shipmentId);
  if (!shipment) {
    throw new AppError('Shipment not found', 404);
  }
  if (shipment.status !== 'Draft') {
    throw new AppError('Legs can only be deleted while shipment is in Draft', 409);
  }

  await ShipmentLeg.deleteOne({ _id: legId, shipmentId: shipment._id });
  return ShipmentLeg.find({ shipmentId: shipment._id }).sort({ sequence: 1 });
}

function rollupShipmentStatusFromLegs(legs: ShipmentLegDoc[]): ShipmentStatus {
  if (legs.some((l) => l.status === 'Exception')) return 'Exception';
  if (legs.every((l) => l.status === 'Delivered')) return 'Delivered';
  if (legs.some((l) => l.status === 'InTransit')) return 'InTransit';
  if (legs.some((l) => l.status === 'Booked')) return 'Booked';
  return 'Draft';
}

function generateShipmentNumber(id: mongoose.Types.ObjectId): string {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `SHP-${ts}-${id.toString().slice(-6)}`;
}

export async function submitShipmentService(
  shipmentId: string,
  idempotencyKey: string | undefined
) {
  if (!idempotencyKey) {
    throw new AppError('Idempotency-Key header is required', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const shipment = await Shipment.findById(shipmentId).session(session);
    if (!shipment) {
      throw new AppError('Shipment not found', 404);
    }

    // Idempotent: already submitted with the same key — return existing record
    if (shipment.status !== 'Draft' && shipment.idempotencyKey === idempotencyKey) {
      const legs = await ShipmentLeg.find({ shipmentId: shipment._id }).session(session);
      await session.commitTransaction();
      session.endSession();
      return { shipment, legs };
    }

    if (shipment.status !== 'Draft') {
      throw new AppError('Shipment has already been submitted', 409);
    }

    const legs = await ShipmentLeg.find({ shipmentId: shipment._id }).session(session);
    if (legs.length === 0) {
      throw new AppError('Shipment must have at least one leg before submission', 400);
    }

    const totalPrice = legs.reduce((sum, l) => sum + l.price, 0);
    const totalTransitDays = legs.reduce((sum, l) => sum + l.transitDays, 0);
    const lastArrival = [...legs]
      .sort((a, b) => a.scheduledArrival.getTime() - b.scheduledArrival.getTime())
      [legs.length - 1].scheduledArrival;

    shipment.snapshot = {
      totalPrice,
      currency: legs[0].currency,
      totalTransitDays,
      estimatedArrivalDate: lastArrival,
    };
    shipment.status = 'Booked';
    shipment.idempotencyKey = idempotencyKey;
    if (!shipment.shipmentNumber) {
      shipment.shipmentNumber = generateShipmentNumber(shipment._id);
    }
    shipment.version += 1;

    await shipment.save({ session });

    await ShipmentStatusHistory.create(
      [
        {
          shipmentId: shipment._id,
          changedAt: new Date(),
          fromStatus: 'Draft',
          toStatus: 'Booked',
          note: 'Shipment submitted',
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { shipment, legs };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

const updateStatusSchema = z.object({
  legId: z.string().optional(),
  status: z.enum(['Draft', 'Booked', 'InTransit', 'Delivered', 'Closed', 'Exception']),
});

export async function updateStatusService(
  shipmentId: string,
  body: unknown
): Promise<{ shipment: ShipmentDoc; legs: ShipmentLegDoc[] }> {
  const parsed = updateStatusSchema.parse(body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const shipment = await Shipment.findById(shipmentId).session(session);
    if (!shipment) {
      throw new AppError('Shipment not found', 404);
    }

    if (parsed.legId) {
      const leg = await ShipmentLeg.findOne({
        _id: parsed.legId,
        shipmentId: shipment._id,
      }).session(session);
      if (!leg) {
        throw new AppError('Leg not found', 404);
      }
      leg.status = parsed.status as LegStatus;
      await leg.save({ session });
    }

    // Always recompute shipment status from the current leg states
    const legs = await ShipmentLeg.find({ shipmentId: shipment._id }).session(session);
    const prevStatus = shipment.status;
    const nextStatus = legs.length > 0
      ? rollupShipmentStatusFromLegs(legs)
      : (parsed.status as ShipmentStatus);

    if (prevStatus !== nextStatus) {
      shipment.status = nextStatus;
      await shipment.save({ session });

      await ShipmentStatusHistory.create(
        [
          {
            shipmentId: shipment._id,
            changedAt: new Date(),
            fromStatus: prevStatus,
            toStatus: nextStatus,
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return { shipment, legs };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

const exceptionSchema = z.object({
  legId: z.string().min(1, 'Leg ID is required'),
  reasonCode: z.string().min(1, 'Reason code is required'),
  description: z.string().optional(),
});

export async function createExceptionService(
  shipmentId: string,
  body: unknown
): Promise<{ shipment: ShipmentDoc; leg: ShipmentLegDoc }> {
  const parsed = exceptionSchema.parse(body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const shipment = await Shipment.findById(shipmentId).session(session);
    if (!shipment) {
      throw new AppError('Shipment not found', 404);
    }

    const leg = await ShipmentLeg.findOne({
      _id: parsed.legId,
      shipmentId: shipment._id,
    }).session(session);
    if (!leg) {
      throw new AppError('Leg not found', 404);
    }

    leg.status = 'Exception';
    leg.exception = {
      reasonCode: parsed.reasonCode,
      description: parsed.description,
    };
    await leg.save({ session });

    const legs = await ShipmentLeg.find({ shipmentId: shipment._id }).session(session);
    const prevStatus = shipment.status;
    shipment.status = rollupShipmentStatusFromLegs(legs);
    await shipment.save({ session });

    await ShipmentStatusHistory.create(
      [
        {
          shipmentId: shipment._id,
          changedAt: new Date(),
          fromStatus: prevStatus,
          toStatus: shipment.status,
          reasonCode: parsed.reasonCode,
          note: parsed.description,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { shipment, leg };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

export async function resolveExceptionService(
  shipmentId: string,
  legId: string
): Promise<{ shipment: ShipmentDoc; leg: ShipmentLegDoc }> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const shipment = await Shipment.findById(shipmentId).session(session);
    if (!shipment) {
      throw new AppError('Shipment not found', 404);
    }

    const leg = await ShipmentLeg.findOne({
      _id: legId,
      shipmentId: shipment._id,
    }).session(session);
    if (!leg || !leg.exception) {
      throw new AppError('Leg or exception not found', 404);
    }

    leg.exception.resolvedAt = new Date();
    leg.status = 'InTransit';
    await leg.save({ session });

    const legs = await ShipmentLeg.find({ shipmentId: shipment._id }).session(session);
    const prevStatus = shipment.status;
    shipment.status = rollupShipmentStatusFromLegs(legs);
    await shipment.save({ session });

    await ShipmentStatusHistory.create(
      [
        {
          shipmentId: shipment._id,
          changedAt: new Date(),
          fromStatus: prevStatus,
          toStatus: shipment.status,
          note: 'Exception resolved',
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return { shipment, leg };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}
