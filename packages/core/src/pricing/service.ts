import { prisma, type Db, type Service, type Package, type AddOn } from '@studio/db';
import { DomainError, invalid, notFound } from '../errors';
import { getSetting } from '../settings';
import { calculatePrice, type PriceBreakdown } from './engine';

export interface QuoteRequest {
  serviceId: string;
  packageId?: string | null;
  addOnIds?: string[];
  durationMin?: number | null;
  locationId?: string | null;
}

export interface ResolvedQuote {
  service: Service;
  pkg: Package | null;
  addOns: AddOn[];
  durationMin: number;
  breakdown: PriceBreakdown;
}

/** Validate a requested duration against a service's rules. */
export function resolveDuration(service: Service, pkg: Package | null, requested?: number | null): number {
  if (pkg) {
    if (requested != null && requested !== pkg.durationMin) {
      throw invalid(`The ${pkg.name} package has a fixed duration of ${pkg.durationMin} minutes.`);
    }
    return pkg.durationMin;
  }
  const duration = requested ?? service.defaultDurationMin;
  if (!Number.isInteger(duration) || duration < service.minDurationMin || duration > service.maxDurationMin) {
    throw invalid(
      `Duration must be between ${service.minDurationMin} and ${service.maxDurationMin} minutes for ${service.name}.`,
    );
  }
  if ((duration - service.minDurationMin) % service.durationStepMin !== 0) {
    throw invalid(`Duration must be in steps of ${service.durationStepMin} minutes.`);
  }
  return duration;
}

/**
 * Build an authoritative quote from database records. Every price in the
 * output comes from the catalogue and configuration, never from the client.
 */
export async function quoteService(req: QuoteRequest, db: Db = prisma): Promise<ResolvedQuote> {
  const service = await db.service.findUnique({ where: { id: req.serviceId } });
  if (!service || !service.isActive) throw notFound('Service');
  if (service.bookingMode === 'ENQUIRY' || service.pricingModel === 'QUOTE') {
    throw new DomainError('VALIDATION', `${service.name} is priced by custom quotation. Please submit an enquiry.`);
  }

  if (req.locationId) {
    const link = await db.serviceLocation.findUnique({
      where: { serviceId_locationId: { serviceId: service.id, locationId: req.locationId } },
    });
    if (!link) throw invalid(`${service.name} is not offered at the selected location.`);
  }

  let pkg: Package | null = null;
  if (req.packageId) {
    pkg = await db.package.findUnique({ where: { id: req.packageId } });
    if (!pkg || !pkg.isActive || pkg.serviceId !== service.id) throw invalid('The selected package is not available for this service.');
  }

  const addOnIds = [...new Set(req.addOnIds ?? [])];
  let addOns: AddOn[] = [];
  if (addOnIds.length) {
    const links = await db.serviceAddOn.findMany({
      where: { serviceId: service.id, addOnId: { in: addOnIds } },
      include: { addOn: true },
    });
    addOns = links.map((l) => l.addOn).filter((a) => a.isActive);
    if (addOns.length !== addOnIds.length) throw invalid('One or more selected add-ons are not available for this service.');
  }

  const durationMin = resolveDuration(service, pkg, req.durationMin);
  const [pricing, regional] = await Promise.all([getSetting('pricing', db), getSetting('regional', db)]);

  const breakdown = calculatePrice({
    currency: regional.currency,
    durationMin,
    base: pkg
      ? { kind: 'PACKAGE', refId: pkg.id, label: `${service.name}: ${pkg.name}`, amountMinor: pkg.priceMinor }
      : service.pricingModel === 'HOURLY'
        ? { kind: 'HOURLY', refId: service.id, label: service.name, rateMinor: service.hourlyRateMinor }
        : { kind: 'FIXED', refId: service.id, label: service.name, amountMinor: service.basePriceMinor },
    addOns: addOns.map((a) => ({ refId: a.id, label: a.name, pricing: a.pricing, priceMinor: a.priceMinor })),
    taxRateBps: pricing.taxRateBps,
    taxLabel: pricing.taxLabel,
    fees: pricing.fees,
    depositBps: pricing.depositBps,
    minimumDepositMinor: pricing.minimumDepositMinor,
  });

  return { service, pkg, addOns, durationMin, breakdown };
}
