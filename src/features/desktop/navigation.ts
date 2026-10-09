import type { TranslationKey } from '../../shared/i18n/strings';

/** Top-level pages of the desktop shell, in tab-bar order. */
export type DesktopPage = 'status' | 'dashboard' | 'printers' | 'jobs' | 'pos' | 'reports' | 'settings';

export interface DesktopTabDefinition {
  page: DesktopPage;
  labelKey: TranslationKey;
}
