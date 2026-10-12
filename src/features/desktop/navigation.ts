import type { TranslationKey } from '../../shared/i18n/strings';

/** Top-level pages of the desktop shell, in tab-bar order. */
export type DesktopPage = 'status' | 'printers' | 'jobs' | 'reports' | 'settings' | 'counter' | 'studio';

export interface DesktopTabDefinition {
  page: DesktopPage;
  labelKey: TranslationKey;
}

/**
 * Master/shopkeeper PC tabs, in tab-bar order. Studio leads because it is the
 * shop's primary workspace; Settings and the Windows agent layer no longer live
 * in this strip — they open in their own auxiliary windows (see DesktopApp).
 */
export const MASTER_DESKTOP_TABS: readonly DesktopTabDefinition[] = [
  { page: 'studio', labelKey: 'nav.studio' },
  { page: 'status', labelKey: 'nav.dashboard' },
  { page: 'printers', labelKey: 'nav.printers' },
  { page: 'jobs', labelKey: 'nav.jobs' },
  { page: 'reports', labelKey: 'nav.reports' },
  { page: 'settings', labelKey: 'nav.settings' },
];

/** Auxiliary windows the shell can open next to the main window. */
export type AuxiliaryWindow = 'settings' | 'agent';

/**
 * A counter PC can access the counter inbox and the studio editor
 * to edit their own orders. Other admin tabs (printers, reports, settings)
 * belong to the master PC. Server-side per-counter access control is still
 * pending counter pairing, so this is a UI lock, not the security boundary.
 */
export const COUNTER_DESKTOP_TABS: readonly DesktopTabDefinition[] = [
  { page: 'counter', labelKey: 'nav.counterInbox' },
  { page: 'studio', labelKey: 'nav.studio' },
];

export const desktopTabsForRole = (isMaster: boolean): readonly DesktopTabDefinition[] =>
  isMaster ? MASTER_DESKTOP_TABS : COUNTER_DESKTOP_TABS;

export const defaultDesktopPage = (isMaster: boolean): DesktopPage =>
  isMaster ? 'studio' : 'counter';

/**
 * Pages that open in their own auxiliary window instead of switching the main
 * window's tab. Everything else still renders inline.
 */
export const AUXILIARY_WINDOW_BY_PAGE: Partial<Record<DesktopPage, AuxiliaryWindow>> = {
  settings: 'settings',
  printers: 'agent',
};
