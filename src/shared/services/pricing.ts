import type { ColorMode, ServicePricing, StudioService } from '../types';

/**
 * Shared pricing formula for shop orders (audit improvement #3).
 *
 * Previously the unit-price mapping was duplicated in `CustomerPwaView.calculatePrice`,
 * `OrderCardModal.calculateRecalculatedPrice`, and `StudioContext.updatePricing` —
 * three copies that could silently drift. All of them now call this module.
 */

/** Unit price used for services without a dedicated pricing tier. */
const FALLBACK_UNIT_PRICE = 35;

export interface PriceQuery {
  copies?: number;
  gridCount?: number;
  colorMode?: ColorMode;
}

export const INITIAL_SERVICE_PRICING: ServicePricing = {
  passport4in1: 50,
  passport8in1: 80,
  stampPhoto: 30,
  nidSmartCard: 40,
  nidNormalA4: 15,
  photo4R: 35,
  photo6R: 60,
  docA4BW: 5,
  docA4Color: 15,
};

/** Price of a single unit of a service (one copy / one sheet). */
export const unitPriceForService = (
  serviceId: string,
  pricing: ServicePricing,
  query: PriceQuery = {}
): number => {
  switch (serviceId) {
    case 'passport_photo':
      return query.gridCount === 8 ? pricing.passport8in1 : pricing.passport4in1;
    case 'nid_card':
      return pricing.nidSmartCard;
    case 'stamp_photo':
      return pricing.stampPhoto;
    case 'photo_4r':
      return pricing.photo4R;
    case 'doc_a4':
      return query.colorMode === 'color' ? pricing.docA4Color : pricing.docA4BW;
    default:
      return FALLBACK_UNIT_PRICE;
  }
};

/** Total price for a service across `copies` units. */
export const priceForService = (
  serviceId: string,
  pricing: ServicePricing,
  query: PriceQuery = {}
): number =>
  unitPriceForService(serviceId, pricing, query) * (query.copies ?? 1);

/**
 * Total price for an order using the shop's live service definition.
 * Services created from a preset (or by hand) have no dedicated
 * `ServicePricing` tier, so they bill their own `basePriceBDT`; the built-in
 * services keep the shared tiered formula (passport grids, A4 colour, …).
 */
export const priceForServiceOrder = (
  service: Pick<StudioService, 'id' | 'basePriceBDT'> | undefined,
  pricing: ServicePricing,
  query: PriceQuery = {}
): number => {
  if (!service) return FALLBACK_UNIT_PRICE * (query.copies ?? 1);
  if (Object.prototype.hasOwnProperty.call(PRICING_KEY_BY_SERVICE, service.id)) {
    return priceForService(service.id, pricing, query);
  }
  return service.basePriceBDT * (query.copies ?? 1);
};

/**
 * Which `ServicePricing` key holds the base price of each built-in service.
 * `StudioContext.updatePricing` uses this to keep `StudioService.basePriceBDT`
 * in sync whenever the owner edits a price; services absent from this map
 * (custom services) keep their manually configured base price.
 */
export const PRICING_KEY_BY_SERVICE: Readonly<Record<string, keyof ServicePricing>> = {
  passport_photo: 'passport4in1',
  stamp_photo: 'stampPhoto',
  nid_card: 'nidSmartCard',
  photo_4r: 'photo4R',
  doc_a4: 'docA4BW',
};
