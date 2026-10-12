import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  CircleQuestionMark,
  Clock,
  FileText,
  House,
  Image,
  Languages,
  Printer,
  Settings as SettingsIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useStudio } from '../../shared/context/StudioContext';
import { useI18n } from '../../shared/i18n/I18nContext';
import { InstallationSetup } from '../../shared/components/InstallationSetup';
import { WindowsToast } from '../../shared/components/WindowsToast';
import { OrderCardModal } from '../shop-pos/OrderCardModal';
import { CounterPosterModal } from '../shop-pos/CounterPosterModal';
import { WindowsAgentView, type AgentPage } from '../print-agent/WindowsAgentView';
import { WindowsExePackageModal } from '../print-agent/WindowsExePackageModal';
import { DetectedPrintersModal } from '../printers/components/DetectedPrintersModal';
import { ProductMark } from './components/ProductMark';
import { StatusPage } from './pages/StatusPage';
import { JobsPage } from './pages/JobsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { CounterPage } from './pages/CounterPage';
import { StudioPage } from './pages/StudioPage';
import {
  AUXILIARY_WINDOW_BY_PAGE,
  defaultDesktopPage,
  desktopTabsForRole,
  type AuxiliaryWindow,
  type DesktopPage,
} from './navigation';
import type { TranslationKey } from '../../shared/i18n/strings';

const AGENT_PAGES: readonly AgentPage[] = ['console', 'printers', 'services', 'counters', 'server'];

/** The page this window was opened for: `?window=settings` / `?window=agent`. */
const requestedAuxiliaryWindow = (): AuxiliaryWindow | null => {
  try {
    const target = new URLSearchParams(window.location.search).get('window');
    return target === 'settings' || target === 'agent' ? target : null;
  } catch {
    return null;
  }
};

const requestedAgentPage = (): AgentPage => {
  try {
    const requested = new URLSearchParams(window.location.search).get('page');
    return AGENT_PAGES.includes(requested as AgentPage) ? (requested as AgentPage) : 'console';
  } catch {
    return 'console';
  }
};

const TAB_ICONS: Record<DesktopPage, React.ReactNode> = {
  status: <House className="h-3.5 w-3.5" />,
  printers: <Printer className="h-3.5 w-3.5" />,
  jobs: <Clock className="h-3.5 w-3.5" />,
  reports: <FileText className="h-3.5 w-3.5" />,
  settings: <SettingsIcon className="h-3.5 w-3.5" />,
  counter: <Printer className="h-3.5 w-3.5" />,
  studio: <Image className="h-3.5 w-3.5" />,
};

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
  const { language, setLanguage, t } = useI18n();
  const {
    installationConfig,
    isMaster,
    counterConnection,
    shopProfile,
    setIsPosterModalOpen,
    setIsExePackageModalOpen,
  } = useStudio();
  const tabs = useMemo(() => desktopTabsForRole(isMaster), [isMaster]);
  const auxiliaryWindow = useMemo(requestedAuxiliaryWindow, []);
  const [page, setPage] = useState<DesktopPage>(() => defaultDesktopPage(isMaster));
  const [agentPage, setAgentPage] = useState<AgentPage>(() =>
    auxiliaryWindow === 'agent' ? requestedAgentPage() : 'printers'
  );
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isShopMenuOpen, setIsShopMenuOpen] = useState(false);
  const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);

  const openAuxiliary = useCallback((target: AuxiliaryWindow, agentTargetPage?: AgentPage) => {
    setIsHelpOpen(false);
    setIsShopMenuOpen(false);
    const desktop = window.alifShohojPrintDesktop;
    if (desktop?.openAuxiliaryWindow) {
      void desktop.openAuxiliaryWindow(target, agentTargetPage).catch(error => {
        console.error('Could not open the auxiliary window.', error);
      });
      return;
    }
    // Browser dev harness: open this same entry document with the window flag.
    const url = new URL(window.location.href);
    url.searchParams.set('window', target);
    if (target === 'agent' && agentTargetPage) url.searchParams.set('page', agentTargetPage);
    else url.searchParams.delete('page');
    window.open(url.toString(), `alif-${target}`, 'width=1280,height=800');
  }, []);

  // The main process focuses an already-open agent window by sending the page
  // to switch to instead of loading a second copy of the shell.
  useEffect(() => {
    const desktop = window.alifShohojPrintDesktop;
    if (!desktop?.onAuxNavigate || auxiliaryWindow !== 'agent') return;
    return desktop.onAuxNavigate(payload => {
      if (payload?.target !== 'agent') return;
      const requested = typeof payload.page === 'string' ? payload.page : 'console';
      if (AGENT_PAGES.includes(requested as AgentPage)) setAgentPage(requested as AgentPage);
    });
  }, [auxiliaryWindow]);

  useEffect(() => {
    const desktop = window.alifShohojPrintDesktop;
    if (!desktop) return;
    void desktop.setTrayShopName(shopProfile.name).catch(error => {
      console.error('Could not update the system-tray shop name.', error);
    });
    return desktop.onTrayAction(action => {
      setIsHelpOpen(false);
      setIsShopMenuOpen(false);
      // A counter PC has no printer or shop-settings page to open.
      if (!isMaster) {
        setPage('counter');
        return;
      }
      setIsPrinterSettingsOpen(action === 'printer-settings');
      if (action === 'open-dashboard') setPage('status');
      if (action === 'show-status') setPage('status');
      if (action === 'printer-settings') openAuxiliary('agent', 'printers');
      if (action === 'shop-settings') openAuxiliary('settings');
    });
  }, [shopProfile.name, isMaster, openAuxiliary]);

  // Switching role (first-run setup or a re-configured PC) can leave the shell
  // on a page the new role may not see.
  useEffect(() => {
    if (!tabs.some(tab => tab.page === page)) setPage(tabs[0].page);
  }, [tabs, page]);

  if (!installationConfig) {
    return (
      <div className="flex min-h-screen flex-col bg-bg-primary text-text-primary">
        <InstallationSetup />
      </div>
    );
  }

  // Settings and the Windows agent layer run in their own windows, so those
  // entries render a dedicated single-page shell instead of the tab strip.
  // Only a master PC has either surface; a crafted URL on a counter PC falls
  // through to the regular role-locked shell.
  if (auxiliaryWindow === 'settings' && isMaster) {
    return (
      <div className="flex h-screen flex-col bg-bg-primary text-text-primary">
        <SettingsPage onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)} />
        <WindowsToast />
        <DetectedPrintersModal
          isOpen={isPrinterSettingsOpen}
          onClose={() => setIsPrinterSettingsOpen(false)}
        />
      </div>
    );
  }
  if (auxiliaryWindow === 'agent' && isMaster) {
    return (
      <div className="flex h-screen flex-col bg-bg-primary text-text-primary">
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
        <WindowsToast />
        <DetectedPrintersModal
          isOpen={isPrinterSettingsOpen}
          onClose={() => setIsPrinterSettingsOpen(false)}
        />
        {/* The agent pages open these dialogs from their own buttons. */}
        <OrderCardModal />
        <CounterPosterModal />
        <WindowsExePackageModal />
      </div>
    );
  }

  const navigateMain = (next: DesktopPage) => {
    const auxiliary = AUXILIARY_WINDOW_BY_PAGE[next];
    if (auxiliary) openAuxiliary(auxiliary, next === 'printers' ? 'printers' : undefined);
    else setPage(next);
  };

  const openAgentPage = (next: AgentPage) => {
    openAuxiliary('agent', next);
  };

  return (
    <div className="flex h-screen flex-col bg-bg-primary text-text-primary">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-primary bg-surface px-3 py-1.5">
        <nav aria-label={t('nav.dashboard')} className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const isActive = page === tab.page;
            return (
              <button
                key={tab.page}
                type="button"
                onClick={() => navigateMain(tab.page)}
                aria-current={isActive ? 'page' : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-brand text-on-brand'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {TAB_ICONS[tab.page]}
                {t(tab.labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          {!isMaster && (
            <span
              className={`inline-flex items-center gap-1.5 px-1 text-[10px] font-semibold ${
                counterConnection === 'connected' ? 'text-success' : counterConnection === 'disconnected' ? 'text-error' : 'text-text-tertiary'
              }`}
            >
              {counterConnection === 'connected' ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {t('counter.masterPc')}
            </span>
          )}
          <button
            type="button"
            onClick={() => setLanguage(language === 'bn' ? 'en' : 'bn')}
            aria-label={t('language.label')}
            title={t('language.label')}
            className="flex h-8 items-center gap-1 rounded-md px-2 text-[10px] font-bold uppercase text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Languages className="h-3.5 w-3.5" />
            {language === 'bn' ? 'বাং' : 'EN'}
          </button>
          {isMaster && (
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
          )}

          {isMaster && (
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
                  onClick={() => openAuxiliary('settings')}
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
                <div className="my-1 border-t border-border-secondary" role="separator" />
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
                  {t('language.label')}
                </div>
                {(['en', 'bn'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={language === option}
                    onClick={() => {
                      setLanguage(option);
                      setIsShopMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-surface-hover"
                  >
                    {t(option === 'en' ? 'language.english' : 'language.bengali')}
                    <span aria-hidden="true" className="font-bold text-brand">
                      {language === option ? '✓' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      <main className="min-h-0 flex-1 overflow-hidden">
        {page === 'status' && (
          <StatusPage onNavigate={navigateMain} onOpenPrinterSettings={() => setIsPrinterSettingsOpen(true)} />
        )}
        {page === 'jobs' && (
          <JobsPage onNavigate={navigateMain} />
        )}
        {page === 'reports' && (
          <ReportsPage />
        )}
        {page === 'counter' && (
          <CounterPage />
        )}
        {page === 'studio' && (
          <StudioPage />
        )}
      </main>

      <WindowsToast />
      {isMaster && (
        <>
          <DetectedPrintersModal
            isOpen={isPrinterSettingsOpen}
            onClose={() => setIsPrinterSettingsOpen(false)}
          />
          <OrderCardModal />
          <CounterPosterModal />
          <WindowsExePackageModal />
        </>
      )}
    </div>
  );
};
