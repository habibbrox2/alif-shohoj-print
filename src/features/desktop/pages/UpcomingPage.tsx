import React from 'react';
import { Construction } from 'lucide-react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import type { TranslationKey } from '../../../shared/i18n/strings';

interface UpcomingPageProps {
  /** Short marker of the refactor step that will build this page. */
  step: string;
  descriptionKey: TranslationKey;
}

/**
 * Placeholder for tabs whose real page arrives in a later refactor step. It is
 * deliberately explicit that the feature is not implemented yet instead of
 * showing mock data that looks real.
 */
export const UpcomingPage: React.FC<UpcomingPageProps> = ({ step, descriptionKey }) => {
  const { t } = useI18n();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-border-primary bg-surface p-6 text-center shadow-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Construction className="h-6 w-6" />
        </span>
        <h2 className="mt-3 text-sm font-bold text-text-primary">{t('upcoming.title')}</h2>
        <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">{t(descriptionKey)}</p>
        <p className="mt-3 font-mono text-[11px] text-text-tertiary">{step}</p>
      </div>
    </div>
  );
};
