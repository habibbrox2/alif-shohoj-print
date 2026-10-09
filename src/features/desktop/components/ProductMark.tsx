import React from 'react';
import { BRAND } from '../../../shared/config/brand';

/**
 * Temporary brand tile. The design references show a logo letter; this project
 * has no logo asset yet, so the letter comes from the shared brand config and
 * can be swapped for a real image in one place.
 */
export const ProductMark: React.FC<{ className?: string }> = ({ className = 'h-5 w-5 text-[11px]' }) => (
  <span
    className={`flex shrink-0 items-center justify-center rounded-md bg-brand font-bold text-on-brand ${className}`}
    aria-hidden="true"
  >
    {BRAND.logoLetter}
  </span>
);
