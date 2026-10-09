import type { ColorMode, ServicePricing } from '../types';

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
