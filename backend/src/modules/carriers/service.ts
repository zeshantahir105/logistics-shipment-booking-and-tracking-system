import type { FilterQuery } from 'mongoose';
import { CarrierService, type CarrierServiceDoc, type TransportMode } from './models';

export interface CarrierServiceSearchParams {
  q?: string;           // free-text: matches origin OR destination
  origin?: string;
  destination?: string;
  mode?: TransportMode;
  carrierId?: string;
  sort?: 'price' | 'transitTime' | 'carrierName';
  page?: number;
  pageSize?: number;
}

export async function searchCarrierServicesInCatalogue(
  params: CarrierServiceSearchParams
): Promise<{ results: CarrierServiceDoc[]; total: number }> {
  const {
    q,
    origin,
    destination,
    mode,
    carrierId,
    sort = 'price',
    page = 1,
    pageSize = 20,
  } = params;

  const filter: FilterQuery<CarrierServiceDoc> = { active: true };

  // Free-text search across origin + destination
  if (q) {
    const re = { $regex: q.trim(), $options: 'i' };
    filter.$or = [{ origin: re }, { destination: re }];
  } else {
    if (origin) filter.origin = { $regex: origin.trim(), $options: 'i' };
    if (destination) filter.destination = { $regex: destination.trim(), $options: 'i' };
  }
  if (mode) filter.mode = mode;
  if (carrierId) filter.carrierId = carrierId;

  const sortSpec: Record<string, 1 | -1> = {};
  if (sort === 'price') sortSpec.basePrice = 1;
  if (sort === 'transitTime') sortSpec.transitDays = 1;
  // carrierName sort would require populate + sort, kept simple here

  const skip = (page - 1) * pageSize;

  const [results, total] = await Promise.all([
    CarrierService.find(filter).sort(sortSpec).skip(skip).limit(pageSize).exec(),
    CarrierService.countDocuments(filter),
  ]);

  return { results, total };
}

