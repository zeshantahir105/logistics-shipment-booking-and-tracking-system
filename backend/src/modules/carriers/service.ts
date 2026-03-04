import type { FilterQuery } from 'mongoose';
import { Carrier, CarrierService, type CarrierServiceDoc, type TransportMode } from './models';

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

export async function listCarriersInCatalogue() {
  return Carrier.find().sort({ name: 1 });
}

export async function searchCarrierServicesInCatalogue(
  params: CarrierServiceSearchParams
): Promise<{ results: (CarrierServiceDoc & { carrierName?: string })[]; total: number }> {
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

  if (q) {
    const re = { $regex: q.trim(), $options: 'i' };
    filter.$or = [{ origin: re }, { destination: re }];
  } else {
    if (origin) filter.origin = { $regex: origin.trim(), $options: 'i' };
    if (destination) filter.destination = { $regex: destination.trim(), $options: 'i' };
  }
  if (mode) filter.mode = mode;
  if (carrierId) filter.carrierId = carrierId;

  const total = await CarrierService.countDocuments(filter);

  // Populate carrier name for display and carrier-name sorting
  const sortSpec: Record<string, 1 | -1> =
    sort === 'price' ? { basePrice: 1 } :
    sort === 'transitTime' ? { transitDays: 1 } :
    {};

  const skip = (page - 1) * pageSize;

  let query = CarrierService.find(filter)
    .populate<{ carrierId: { _id: unknown; name: string } }>('carrierId', 'name')
    .lean();

  if (sort !== 'carrierName') {
    query = (query as any).sort(sortSpec).skip(skip).limit(pageSize);
  }

  const docs = await query.exec();

  // Flatten: map _id → id (string) to match global toJSON transform,
  // attach carrierName, and unwrap the populated carrierId back to its ObjectId.
  let results = docs.map((doc: any) => ({
    ...doc,
    id: doc._id?.toString(),
    carrierId: doc.carrierId?._id?.toString() ?? doc.carrierId?.toString(),
    carrierName: doc.carrierId?.name ?? '',
  }));

  // Carrier-name sort must happen after populate (in-memory, dataset is small)
  if (sort === 'carrierName') {
    results = results
      .sort((a: any, b: any) => (a.carrierName as string).localeCompare(b.carrierName as string))
      .slice(skip, skip + pageSize);
  }

  return { results: results as any, total };
}
