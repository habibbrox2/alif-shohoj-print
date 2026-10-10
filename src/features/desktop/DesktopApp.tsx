import React, { useState } from 'react';
import {
  ChartColumn,
  ChevronDown,
  CircleQuestionMark,
  Clock,
  FileText,
  House,
  Printer,
  Settings as SettingsIcon,
  ShoppingCart,
  UserRound
} from 'lucide-react';
import { useStudio } from '../../shared/context/StudioContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { InstallationSetup } from '../../shared/components/InstallationSetup';
import { WindowsToast } from '../../shared/components/WindowsToast';
import { OrderCardModal } from '../shop-pos/OrderCardModal';
import { CounterPosterModal } from '../shop-pos/CounterPosterModal';
import { ShopPosView } from '../shop-pos/ShopPosView';
import { WindowsAgentView, type AgentPage } from '../print-agent/WindowsAgentView';
import { WindowsExePackageModal } from '../print-agent/WindowsExePackageModal';
import { DetectedPrintersModal } from '../printers/components/DetectedPrintersModal';
import { ProductMark } from './components/ProductMark';
import { DashboardPage } from './pages/DashboardPage';
import { StatusPage } from './pages/StatusPage';
import { UpcomingPage } from './pages/UpcomingPage';
import { JobsPage } from './pages/JobsPage';
import { ReportsPage } from './pages/ReportsPage';
import type { DesktopPage } from './navigation';
import type { TranslationKey } from '../../shared/i18n/strings';

interface TabDefinition {
  page: DesktopPage;
  labelKey: TranslationKey;
  icon: React.ReactNode;
}

const TABS: TabDefinition[] = [
  { page: 'status', labelKey: 'nav.status', icon: <House className="h-3.5 w-3.5" /> },
  { page: 'dashboard', labelKey: 'nav.dashboard', icon: <UserRound className="h-3.5 w-3.5" /> },
  { page: 'printers', labelKey: 'nav.printers', icon: <Printer className="h-3.5 w-3.5" /> },
  { page: 'jobs', labelKey: 'nav.jobs', icon: <Clock className="h-3.5 w-3.5" /> },
  { page: 'pos', labelKey: 'nav.pos', icon: <ShoppingCart className="h-3.5 w-3.5" /> },
  { page: 'reports', labelKey: 'nav.reports', icon: <FileText className="h-3.5 w-3.5" /> },
  { page: 'settings', labelKey: 'nav.settings', icon: <SettingsIcon className="h-3.5 w-3.5" /> }
];

/**
 * Desktop shell for the packaged Windows app.
 *
 * The OS draws the real title bar (minimise / maximise / close), so this shell
 * only owns the tab strip below it. Everything the old in-window menu bar did
 * is still reachable: printers and the print-agent console live behind the
 * Printers tab, and the help button routes to the scan, service manager, server
 * status and agent-package actions.
 */
export const DesktopApp: React.FC = () => {
  const { t } = useI18n();
  const { installationConfig, shopProfile, setIsPosterModalOpen, setIsExePackageModalOpen } = useStudio();
  // The order inbox is the working page, so the shell opens on Dashboard and the
  // status window is one click away (its content is also summarised there).
  const [page, setPage] = useState<DesktopPage>('dashboard');
  const [agentPage, setAgentPage] = useState<AgentPage>('printers');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);

  if (!installationConfig) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
        <InstallationSetup />
      </div>
    );
  }

  const openAgentPage = (next: AgentPage) => {
    setAgentPage(next);
    setPage('printers');
    setIsHelpOpen(false);
  };

  return (
    <div className="flex h-screen flex-col bg-bg-primary text-text-primary">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-primary bg-surface px-3 py-1.5">
        <nav aria-label={t('nav.status')} className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = page === tab.page;
            return (
              <button
                key={tab.page}
                type="button"
                onClick={() => setPage(tab.page)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-brand text-on-brand'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {tab.icon}
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsHelpOpen(!isHelpOpen)}
              aria-label={t('shell.help')}
              aria-expanded={isHelpOpen}
              title={t('shell.help')}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <CircleQuestionMark className="h-4 w-4" />
            </button>
            {isHelpOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-lg border border-border-primary bg-surface-elevated py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openAgentPage('printers')}
                  className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
                >
                  {t('shell.help.printers')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openAgentPage('services')}
                  className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
                >
                  {t('shell.help.services')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openAgentPage('server')}
                  className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
                >
                  {t('shell.help.server')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsHelpOpen(false);
                    setIsExePackageModalOpen(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
                >
                  {t('shell.help.package')}
                </button>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsShopMenuOpen(!isShopMenuOpen)}
              aria-label={t('shell.shopMenu.title')}
              aria-expanded={isShopMenuOpen}
              className="flex items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-hover"
            >
              <ProductMark />
              <span className="min-w-0">
                <span className="block max-w-[220px] truncate text-xs font-semibold text-text-primary">
                  {shopProfile.name}
                </span>
                <span className="block text-[10px] text-text-secondary">
                  {t('shell.shopCode', { code: shopProfile.code })}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
            </button>
            {isShopMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-border-primary bg-surface-elevated py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsShopMenuOpen(false);
                    setPage('settings');
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
                >
                  {t('shell.shopMenu.settings')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsShopMenuOpen(false);
                    setIsPosterModalOpen(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
                >
                  {t('shell.shopMenu.poster')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden">
        {page === 'status' && (
          <StatusPage onNavigate={setPage} onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)} />
        )}
        {page === 'printers' && (
          <div className="flex h-full flex-col">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-secondary bg-surface px-4 py-2">
              <h2 className="text-xs font-bold text-text-primary">{t('status.printerSettings')}</h2>
              <button
                type="button"
                onClick={() => setIsPrinterSettingsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary transition-colors hover:bg-surface-hover"
              >
                <Printer className="h-3.5 w-3.5" />
                {t('printers.settings.heading')}
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <WindowsAgentView key={agentPage} initialPage={agentPage} onPageChange={setAgentPage} />
            </div>
          </div>
        )}
        {page === 'pos' && (
          <div className="h-full overflow-y-auto">
            <ShopPosView />
          </div>
        )}
        {page === 'dashboard' && <DashboardPage />}
        {page === 'jobs' && (
          <JobsPage onNavigate={setPage} />
        )}
        {page === 'reports' && (
          <ReportsPage />
        )}
        {page === 'settings' && <UpcomingPage step="Step 7" descriptionKey="upcoming.settings" />}
      </main>

      <WindowsToast />
      <DetectedPrintersModal
        isOpen={isPrinterSettingsOpen}
        onClose={() => setIsPrinterSettingsOpen(false)}
      />
      <OrderCardModal />
      <CounterPosterModal />
      <WindowsExePackageModal />
    </div>
  );
};
