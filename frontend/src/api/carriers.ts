import { api } from './client';

export interface CarrierService {
  id: string;
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
  q?: string;           // free-text: matches origin OR destination
  origin?: string;
  destination?: string;
  mode?: string;
  carrierId?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export async function searchCarrierServices(params: CarrierSearchParams) {
  const res = await api.get<{ data: CarrierService[]; total: number }>('/carriers/services', {
    params,
  });
  return res.data;
}

