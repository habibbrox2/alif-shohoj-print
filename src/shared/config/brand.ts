/**
 * Single source of truth for product branding.
 *
 * The name used to be repeated as "ALIF SHOHOJ PRINT", "ALIF SHOHOJ PRINT 2026"
 * and "BP" across the renderer, the Electron main process and the packaging
 * config. Read it from here instead so a rename is one edit (plus
 * `electron-builder.yml`, which cannot import TypeScript).
 */
export const BRAND = {
  productName: 'Alif Shohoj Print',
  productNameBn: 'আলিফ সহজ প্রিন্ট',
  company: 'AAA Tech Solutions',
  /** Must stay in sync with `appId` in electron-builder.yml. */
  appId: 'com.aaatech.alifshohojprint',
  /**
   * Temporary text mark: the repository has no logo asset yet, so the shell
   * renders this letter in a teal tile until a real logo is added.
   */
  logoLetter: 'A'
} as const;
