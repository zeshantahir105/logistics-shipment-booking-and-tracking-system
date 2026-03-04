import type { Request, Response, NextFunction } from 'express';
import { searchCarrierServicesInCatalogue } from './service';

export async function searchCarrierServices(req: Request, res: Response, next: NextFunction) {
  try {
    const { q, origin, destination, mode, carrierId, sort, page, pageSize } = req.query;

    const { results, total } = await searchCarrierServicesInCatalogue({
      q: q as string | undefined,
      origin: origin as string | undefined,
      destination: destination as string | undefined,
      mode: mode as any,
      carrierId: carrierId as string | undefined,
      sort: sort as any,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });

    res.json({
      data: results,
      total,
    });
  } catch (err) {
    next(err);
  }
}

