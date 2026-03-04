import { api } from './client';

export interface Carrier {
  id: string;
  name: string;
  code: string;
  modes: ('air' | 'sea' | 'road')[];
}

export interface CarrierService {
  id: string;
  carrierId: string;
  carrierName: string;
  carrierGroupId: string;
  mode: 'air' | 'sea' | 'road';
  origin: string;
  destination: string;
  maxWeight: number;
  maxVolume: number;
  basePrice: number;
  currency: string;
  transitDays: number;
}

export interface CarrierSearchParams {
  q?: string;
  origin?: string;
  destination?: string;
  mode?: string;
  carrierId?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export async function listCarriers() {
  const res = await api.get<{ data: Carrier[] }>('/carriers');
  return res.data;
}

export async function searchCarrierServices(params: CarrierSearchParams) {
  const res = await api.get<{ data: CarrierService[]; total: number }>('/carriers/services', {
    params,
  });
  return res.data;
}
