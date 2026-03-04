import { api } from './client';

export interface Shipment {
  id: string;
  shipmentNumber?: string | null;
  status: string;
  version: number;
  shipper: { name: string; contactEmail: string };
  pickupAddress: { line1: string; city: string; country: string };
  deliveryAddress: { line1: string; city: string; country: string };
  cargo: { type: string; weight: number; volume: number };
  requiredDeliveryDate?: string | null;
  carrierGroupId?: string | null;
}

export interface ShipmentDraftInput {
  shipper: {
    name: string;
    contactEmail: string;
  };
  pickupAddress: {
    line1: string;
    line2?: string;
    city: string;
    country: string;
  };
  deliveryAddress: {
    line1: string;
    line2?: string;
    city: string;
    country: string;
  };
  cargo: {
    type: string;
    weight: number;
    volume: number;
  };
  requiredDeliveryDate?: string | null;
}

export async function createDraft(input: ShipmentDraftInput) {
  const res = await api.post<Shipment>('/shipments/drafts', input);
  return res.data;
}

export interface LegInput {
  id?: string;
  sequence: number;
  carrierServiceId: string;
  scheduledDeparture: string;
  scheduledArrival: string;
}

export async function saveLegs(shipmentId: string, legs: LegInput[]) {
  const res = await api.post(`/shipments/${shipmentId}/legs`, { legs });
  return res.data as ShipmentLeg[];
}

export async function deleteLeg(shipmentId: string, legId: string) {
  const res = await api.delete(`/shipments/${shipmentId}/legs/${legId}`);
  return res.data as ShipmentLeg[];
}

export interface ShipmentLeg {
  id: string;
  sequence: number;
  carrierServiceId: string;
  mode: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  scheduledArrival: string;
  transitDays: number;
  price: number;
  currency: string;
  status: string;
}

