import mongoose, { Schema, type Document, type Model } from 'mongoose';

export type TransportMode = 'air' | 'sea' | 'road';

export interface CarrierAttrs {
  name: string;
  code: string;
  modes: TransportMode[];
}

export interface CarrierDoc extends Document, CarrierAttrs {}

const carrierSchema = new Schema<CarrierDoc>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    modes: [{ type: String, enum: ['air', 'sea', 'road'], required: true }],
  },
  { timestamps: true }
);

// index on `code` is already declared via `unique: true` in the field definition above

export const Carrier: Model<CarrierDoc> = mongoose.model<CarrierDoc>('Carrier', carrierSchema);

export interface CarrierServiceAttrs {
  carrierId: mongoose.Types.ObjectId;
  carrierGroupId: string;
  mode: TransportMode;
  origin: string;
  destination: string;
  maxWeight: number;
  maxVolume: number;
  basePrice: number;
  currency: string;
  transitDays: number;
  active: boolean;
}

export interface CarrierServiceDoc extends Document, CarrierServiceAttrs {}

const carrierServiceSchema = new Schema<CarrierServiceDoc>(
  {
    carrierId: { type: Schema.Types.ObjectId, ref: 'Carrier', required: true },
    carrierGroupId: { type: String, required: true },
    mode: { type: String, enum: ['air', 'sea', 'road'], required: true },
    origin: { type: String, required: true },
    destination: { type: String, required: true },
    maxWeight: { type: Number, required: true },
    maxVolume: { type: Number, required: true },
    basePrice: { type: Number, required: true },
    currency: { type: String, required: true },
    transitDays: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

carrierServiceSchema.index({ origin: 1, destination: 1, mode: 1 });
carrierServiceSchema.index({ carrierId: 1 });

export const CarrierService: Model<CarrierServiceDoc> = mongoose.model<CarrierServiceDoc>(
  'CarrierService',
  carrierServiceSchema
);

