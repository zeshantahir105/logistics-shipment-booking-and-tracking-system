import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type ShipmentStatus = 'Draft' | 'Booked' | 'InTransit' | 'Delivered' | 'Closed' | 'Exception';

export interface ShipperInfo {
  name: string;
  contactEmail: string;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  country: string;
}

export interface CargoInfo {
  type: string;
  weight: number;
  volume: number;
}

export interface ShipmentSnapshot {
  totalPrice: number;
  currency: string;
  totalTransitDays: number;
  estimatedArrivalDate: Date | null;
}

export interface ShipmentAttrs {
  shortId: string;
  shipper: ShipperInfo;
  pickupAddress: Address;
  deliveryAddress: Address;
  cargo: CargoInfo;
  requiredDeliveryDate: Date | null;
  carrierGroupId?: string;
  status: ShipmentStatus;
  version: number;
  snapshot?: ShipmentSnapshot | null;
  idempotencyKey?: string | null;
}

export interface ShipmentDoc extends Document, ShipmentAttrs {
  shipmentNumber?: string;
}

const addressSchema = new Schema<Address>(
  {
    line1: { type: String, required: true },
    line2: { type: String },
    city: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

const shipperSchema = new Schema<ShipperInfo>(
  {
    name: { type: String, required: true },
    contactEmail: { type: String, required: true },
  },
  { _id: false }
);

const cargoSchema = new Schema<CargoInfo>(
  {
    type: { type: String, required: true },
    weight: { type: Number, required: true },
    volume: { type: Number, required: true },
  },
  { _id: false }
);

const snapshotSchema = new Schema<ShipmentSnapshot>(
  {
    totalPrice: { type: Number, required: true },
    currency: { type: String, required: true },
    totalTransitDays: { type: Number, required: true },
    estimatedArrivalDate: { type: Date },
  },
  { _id: false }
);

const shipmentSchema = new Schema<ShipmentDoc>(
  {
    shortId: { type: String, required: true, unique: true },
    shipmentNumber: { type: String, unique: true, sparse: true },
    shipper: { type: shipperSchema, required: true },
    pickupAddress: { type: addressSchema, required: true },
    deliveryAddress: { type: addressSchema, required: true },
    cargo: { type: cargoSchema, required: true },
    requiredDeliveryDate: { type: Date },
    carrierGroupId: { type: String },
    status: {
      type: String,
      enum: ['Draft', 'Booked', 'InTransit', 'Delivered', 'Closed', 'Exception'],
      default: 'Draft',
    },
    version: { type: Number, default: 1 },
    snapshot: { type: snapshotSchema },
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

// shortId and shipmentNumber indexes are declared via `unique: true` on the fields above
shipmentSchema.index({ idempotencyKey: 1 }, { sparse: true });

export const Shipment: Model<ShipmentDoc> = mongoose.model<ShipmentDoc>('Shipment', shipmentSchema);

export type LegStatus = 'Draft' | 'Booked' | 'InTransit' | 'Delivered' | 'Exception';

export interface LegExceptionInfo {
  reasonCode: string;
  description?: string;
  resolvedAt?: Date;
}

export interface ShipmentLegAttrs {
  shipmentId: mongoose.Types.ObjectId;
  sequence: number;
  carrierServiceId: mongoose.Types.ObjectId;
  mode: 'air' | 'sea' | 'road';
  origin: string;
  destination: string;
  scheduledDeparture: Date;
  scheduledArrival: Date;
  transitDays: number;
  price: number;
  currency: string;
  status: LegStatus;
  exception?: LegExceptionInfo | null;
}

export interface ShipmentLegDoc extends Document, ShipmentLegAttrs {}

const legExceptionSchema = new Schema<LegExceptionInfo>(
  {
    reasonCode: { type: String, required: true },
    description: { type: String },
    resolvedAt: { type: Date },
  },
  { _id: false }
);

const shipmentLegSchema = new Schema<ShipmentLegDoc>(
  {
    shipmentId: { type: Schema.Types.ObjectId, ref: 'Shipment', required: true },
    sequence: { type: Number, required: true },
    carrierServiceId: { type: Schema.Types.ObjectId, ref: 'CarrierService', required: true },
    mode: { type: String, enum: ['air', 'sea', 'road'], required: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    scheduledDeparture: { type: Date, required: true },
    scheduledArrival: { type: Date, required: true },
    transitDays: { type: Number, required: true },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: ['Draft', 'Booked', 'InTransit', 'Delivered', 'Exception'],
      default: 'Draft',
    },
    exception: { type: legExceptionSchema },
  },
  { timestamps: true }
);

shipmentLegSchema.index({ shipmentId: 1, sequence: 1 }, { unique: true });
shipmentLegSchema.index({ carrierServiceId: 1 });

export const ShipmentLeg: Model<ShipmentLegDoc> = mongoose.model<ShipmentLegDoc>(
  'ShipmentLeg',
  shipmentLegSchema
);

export interface ShipmentStatusHistoryAttrs {
  shipmentId: mongoose.Types.ObjectId;
  changedAt: Date;
  fromStatus?: ShipmentStatus;
  toStatus: ShipmentStatus;
  reasonCode?: string;
  note?: string;
  changedBy?: string;
}

export interface ShipmentStatusHistoryDoc extends Document, ShipmentStatusHistoryAttrs {}

const shipmentStatusHistorySchema = new Schema<ShipmentStatusHistoryDoc>(
  {
    shipmentId: { type: Schema.Types.ObjectId, ref: 'Shipment', required: true },
    changedAt: { type: Date, required: true },
    fromStatus: {
      type: String,
      enum: ['Draft', 'Booked', 'InTransit', 'Delivered', 'Closed', 'Exception'],
    },
    toStatus: {
      type: String,
      enum: ['Draft', 'Booked', 'InTransit', 'Delivered', 'Closed', 'Exception'],
      required: true,
    },
    reasonCode: { type: String },
    note: { type: String },
    changedBy: { type: String },
  },
  { timestamps: false }
);

shipmentStatusHistorySchema.index({ shipmentId: 1, changedAt: 1 });

export const ShipmentStatusHistory: Model<ShipmentStatusHistoryDoc> =
  mongoose.model<ShipmentStatusHistoryDoc>('ShipmentStatusHistory', shipmentStatusHistorySchema);

