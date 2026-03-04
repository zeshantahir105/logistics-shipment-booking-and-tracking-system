/**
 * Seed script — run once to populate carriers and carrier services.
 * Idempotent: uses upsert so it can be re-run safely.
 *
 * Usage:  npm run seed
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Carrier, CarrierService } from './modules/carriers/models';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/logistics';

const carriers = [
  { name: 'Maersk Line',       code: 'MAERSK', modes: ['sea'] as const },
  { name: 'Emirates SkyCargo', code: 'EMSKY',  modes: ['air'] as const },
  { name: 'Aramex Freight',    code: 'ARAMEX', modes: ['road', 'air'] as const },
  { name: 'MSC Logistics',     code: 'MSC',    modes: ['sea', 'road'] as const },
  { name: 'DHL Express',       code: 'DHL',    modes: ['air', 'road'] as const },
];

// carrierGroupId ties multiple route legs to one carrier
const serviceTemplates = [
  // ── Maersk Line — Sea ────────────────────────────────────────────────────
  {
    carrierCode: 'MAERSK', carrierGroupId: 'MAERSK-SEA-1',
    mode: 'sea' as const,
    origin: 'Karachi', destination: 'Jebel Ali',
    maxWeight: 50000, maxVolume: 300,
    basePrice: 1800, currency: 'USD', transitDays: 4,
  },
  {
    carrierCode: 'MAERSK', carrierGroupId: 'MAERSK-SEA-1',
    mode: 'sea' as const,
    origin: 'Jebel Ali', destination: 'Dammam',
    maxWeight: 50000, maxVolume: 300,
    basePrice: 900, currency: 'USD', transitDays: 2,
  },
  {
    carrierCode: 'MAERSK', carrierGroupId: 'MAERSK-SEA-2',
    mode: 'sea' as const,
    origin: 'Karachi', destination: 'Muscat',
    maxWeight: 40000, maxVolume: 250,
    basePrice: 1500, currency: 'USD', transitDays: 5,
  },
  {
    carrierCode: 'MAERSK', carrierGroupId: 'MAERSK-SEA-2',
    mode: 'sea' as const,
    origin: 'Muscat', destination: 'Riyadh',
    maxWeight: 40000, maxVolume: 250,
    basePrice: 700, currency: 'USD', transitDays: 3,
  },

  // ── MSC Logistics — Sea + Road ──────────────────────────────────────────
  {
    carrierCode: 'MSC', carrierGroupId: 'MSC-MIX-1',
    mode: 'sea' as const,
    origin: 'Karachi', destination: 'Jebel Ali',
    maxWeight: 60000, maxVolume: 350,
    basePrice: 1600, currency: 'USD', transitDays: 4,
  },
  {
    carrierCode: 'MSC', carrierGroupId: 'MSC-MIX-1',
    mode: 'road' as const,
    origin: 'Jebel Ali', destination: 'Riyadh',
    maxWeight: 20000, maxVolume: 120,
    basePrice: 1100, currency: 'USD', transitDays: 2,
  },
  {
    carrierCode: 'MSC', carrierGroupId: 'MSC-MIX-1',
    mode: 'road' as const,
    origin: 'Jebel Ali', destination: 'Abu Dhabi',
    maxWeight: 20000, maxVolume: 120,
    basePrice: 400, currency: 'USD', transitDays: 1,
  },

  // ── Emirates SkyCargo — Air ─────────────────────────────────────────────
  {
    carrierCode: 'EMSKY', carrierGroupId: 'EMSKY-AIR-1',
    mode: 'air' as const,
    origin: 'Karachi', destination: 'Dubai',
    maxWeight: 10000, maxVolume: 80,
    basePrice: 4200, currency: 'USD', transitDays: 1,
  },
  {
    carrierCode: 'EMSKY', carrierGroupId: 'EMSKY-AIR-1',
    mode: 'air' as const,
    origin: 'Dubai', destination: 'Riyadh',
    maxWeight: 10000, maxVolume: 80,
    basePrice: 2100, currency: 'USD', transitDays: 1,
  },
  {
    carrierCode: 'EMSKY', carrierGroupId: 'EMSKY-AIR-2',
    mode: 'air' as const,
    origin: 'Karachi', destination: 'Doha',
    maxWeight: 8000, maxVolume: 60,
    basePrice: 3800, currency: 'USD', transitDays: 1,
  },
  {
    carrierCode: 'EMSKY', carrierGroupId: 'EMSKY-AIR-2',
    mode: 'air' as const,
    origin: 'Doha', destination: 'Riyadh',
    maxWeight: 8000, maxVolume: 60,
    basePrice: 1200, currency: 'USD', transitDays: 1,
  },

  // ── DHL Express — Air + Road ────────────────────────────────────────────
  {
    carrierCode: 'DHL', carrierGroupId: 'DHL-MIX-1',
    mode: 'air' as const,
    origin: 'Karachi', destination: 'Dubai',
    maxWeight: 5000, maxVolume: 40,
    basePrice: 5500, currency: 'USD', transitDays: 1,
  },
  {
    carrierCode: 'DHL', carrierGroupId: 'DHL-MIX-1',
    mode: 'road' as const,
    origin: 'Dubai', destination: 'Abu Dhabi',
    maxWeight: 5000, maxVolume: 40,
    basePrice: 300, currency: 'USD', transitDays: 1,
  },
  {
    carrierCode: 'DHL', carrierGroupId: 'DHL-MIX-1',
    mode: 'road' as const,
    origin: 'Dubai', destination: 'Riyadh',
    maxWeight: 5000, maxVolume: 40,
    basePrice: 1000, currency: 'USD', transitDays: 2,
  },

  // ── Aramex — Road ──────────────────────────────────────────────────────
  {
    carrierCode: 'ARAMEX', carrierGroupId: 'ARAMEX-ROAD-1',
    mode: 'road' as const,
    origin: 'Dubai', destination: 'Riyadh',
    maxWeight: 25000, maxVolume: 150,
    basePrice: 1300, currency: 'USD', transitDays: 2,
  },
  {
    carrierCode: 'ARAMEX', carrierGroupId: 'ARAMEX-ROAD-1',
    mode: 'road' as const,
    origin: 'Riyadh', destination: 'Jeddah',
    maxWeight: 25000, maxVolume: 150,
    basePrice: 800, currency: 'USD', transitDays: 1,
  },
  {
    carrierCode: 'ARAMEX', carrierGroupId: 'ARAMEX-ROAD-2',
    mode: 'road' as const,
    origin: 'Jebel Ali', destination: 'Muscat',
    maxWeight: 15000, maxVolume: 100,
    basePrice: 600, currency: 'USD', transitDays: 1,
  },
  {
    carrierCode: 'ARAMEX', carrierGroupId: 'ARAMEX-ROAD-2',
    mode: 'road' as const,
    origin: 'Muscat', destination: 'Salalah',
    maxWeight: 15000, maxVolume: 100,
    basePrice: 500, currency: 'USD', transitDays: 1,
  },
];

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB:', MONGO_URI);

  // ── Upsert carriers ──────────────────────────────────────────────────────
  const carrierIdMap: Record<string, mongoose.Types.ObjectId> = {};

  for (const c of carriers) {
    const doc = await Carrier.findOneAndUpdate(
      { code: c.code },
      { $set: { name: c.name, modes: c.modes } },
      { upsert: true, new: true }
    );
    carrierIdMap[c.code] = doc._id as mongoose.Types.ObjectId;
    console.log(`  carrier: ${c.code} (${doc._id})`);
  }

  // ── Upsert carrier services ──────────────────────────────────────────────
  for (const svc of serviceTemplates) {
    const carrierId = carrierIdMap[svc.carrierCode];
    const { carrierCode, ...rest } = svc;
    await CarrierService.findOneAndUpdate(
      {
        carrierId,
        carrierGroupId: rest.carrierGroupId,
        mode: rest.mode,
        origin: rest.origin,
        destination: rest.destination,
      },
      {
        $set: {
          ...rest,
          carrierId,
          active: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(
      `  service: [${svc.carrierCode}/${svc.carrierGroupId}] ${svc.origin} → ${svc.destination} (${svc.mode})`
    );
  }

  console.log(`\nSeeded ${carriers.length} carriers and ${serviceTemplates.length} services.`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
