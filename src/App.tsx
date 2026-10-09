/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState } from 'react';
import { StudioProvider, useStudio } from './shared/context/StudioContext';
import { ThemeProvider, useTheme } from './shared/context/ThemeContext';
import { NavigationHeader } from './shared/components/NavigationHeader';
import { WindowsToast } from './shared/components/WindowsToast';
import { OrderCardModal } from './features/shop-pos/OrderCardModal';
import { CounterPosterModal } from './features/shop-pos/CounterPosterModal';
import { WindowsExePackageModal } from './features/print-agent/WindowsExePackageModal';
import { Sun, Moon, Monitor } from 'lucide-react';

// Code-split the three main views so the POS boots without pulling in the agent
// and PWA bundles (audit improvement #1 — tames the >500 kB entry chunk).
const WindowsAgentView = lazy(() =>
  import('./features/print-agent/WindowsAgentView').then(module => ({ default: module.WindowsAgentView }))
);
const CustomerPwaView = lazy(() =>
  import('./features/customer-pwa/CustomerPwaView').then(module => ({ default: module.CustomerPwaView }))
);
const ShopPosView = lazy(() =>
  import('./features/shop-pos/ShopPosView').then(module => ({ default: module.ShopPosView }))
);

const ViewFallback: React.FC = () => (
  <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading view">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-primary border-t-accent" />
  </div>
);

type ThemeMode = 'light' | 'dark' | 'system';

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const options: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-4 h-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-4 h-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="w-4 h-4" /> },
  ];

  return (
    <div className="relative group">
      <button
        onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated border border-border-primary hover:bg-surface-hover transition-colors"
        aria-label={`Current: ${theme}. Click to cycle.`}
      >
        {options.find(o => o.value === theme)?.icon}
        <span className="text-xs font-medium text-text-secondary hidden sm:inline">{options.find(o => o.value === theme)?.label}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all" role="menu">
        <div className="bg-surface-elevated border border-border-primary rounded-lg shadow-xl overflow-hidden min-w-[140px]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              role="menuitem"
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                theme === opt.value ? 'bg-accent-light text-accent' : 'text-text-primary hover:bg-surface-hover'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
              {theme === opt.value && <span className="ml-auto text-accent">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const StudioAppContent: React.FC = () => {
  const {
    activeView,
    installationConfig,
    configureInstallation,
    counters,
  } = useStudio();
  const [installationMode, setInstallationMode] = useState<'master' | 'counter'>('master');
  const [installationCounterId, setInstallationCounterId] = useState('CTR-02');
  const [masterUrl, setMasterUrl] = useState('https://');
  const [installationError, setInstallationError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col selection:bg-accent selection:text-accent-text">
      {!installationConfig && activeView !== 'customer_pwa' ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <section className="w-full max-w-lg rounded-xl border border-border-primary bg-surface p-6 shadow-md">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">ALIF SHOHOJ PRINT · প্রথম সেটআপ</p>
            <h1 className="mt-2 text-xl font-bold text-text-primary">এই পিসির ভূমিকা নির্বাচন করুন</h1>
            <p className="mt-2 text-sm text-text-secondary">Shop POS খুলতে প্রথমে এই পিসি মূল পিসি নাকি কাউন্টার তা নির্ধারণ করুন।</p>
            <div className="mt-5 grid gap-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-primary bg-surface-hover p-4 transition-colors hover:border-border-focus">
                <input
                  type="radio"
                  name="installation-mode"
                  checked={installationMode === 'master'}
                  onChange={() => setInstallationMode('master')}
                  className="accent-accent"
                />
                <span>
                  <strong className="block text-sm text-text-primary">মূল পিসি / মূল দোকানদার</strong>
                  <span className="mt-1 block text-xs text-text-secondary">সার্ভিস, প্রিন্টার এবং দোকানের সেটিংস পরিচালনা করবে।</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-primary bg-surface-hover p-4 transition-colors hover:border-border-focus">
                <input
                  type="radio"
                  name="installation-mode"
                  checked={installationMode === 'counter'}
                  onChange={() => setInstallationMode('counter')}
                  className="accent-accent"
                />
                <span className="flex-1">
                  <strong className="block text-sm text-text-primary">কাউন্টার পিসি / অপারেটর</strong>
                  <span className="mt-1 block text-xs text-text-secondary">Shop POS ও অর্ডার পরিচালনার জন্য এই কাউন্টার বেছে নিন।</span>
                  {installationMode === 'counter' && (
                    <div className="mt-3 grid gap-2">
                      <select
                        value={installationCounterId}
                        onChange={event => setInstallationCounterId(event.target.value)}
                        className="w-full rounded-lg border border-border-primary bg-surface p-2 text-sm text-text-primary"
                      >
                        {counters.filter(counter => !counter.isMasterHost).map(counter => (
                          <option key={counter.id} value={counter.id}>{counter.code}: {counter.name}</option>
                        ))}
                      </select>
                      <input type="url" value={masterUrl} onChange={event => setMasterUrl(event.target.value)} placeholder="https://192.168.1.105:43822" aria-label="Master PC gateway URL" className="w-full rounded-lg border border-border-primary bg-surface p-2 text-sm text-text-primary" />
                      <span className="text-xs text-text-secondary">QR-এর একই host ও port-এর base URL দিন; ?shop=… অংশ দেবেন না।</span>
                    </div>
                  )}
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                const normalizedMasterUrl = masterUrl.trim().replace(/\/$/, '');
                let validMasterUrl = false;
                try {
                  const parsedMasterUrl = new URL(normalizedMasterUrl);
                  validMasterUrl = ['https:', 'http:'].includes(parsedMasterUrl.protocol) &&
                    Boolean(parsedMasterUrl.hostname) && !parsedMasterUrl.username && !parsedMasterUrl.password &&
                    parsedMasterUrl.pathname === '/' && !parsedMasterUrl.search && !parsedMasterUrl.hash;
                } catch {}
                if (installationMode === 'counter' && !validMasterUrl) {
                  setInstallationError('Counter PC-এর জন্য Master PC-এর সম্পূর্ণ URL দিন।');
                  return;
                }
                const saved = configureInstallation({
                  mode: installationMode,
                  counterId: installationMode === 'master' ? 'CTR-01' : installationCounterId,
                  ...(installationMode === 'counter' ? { masterUrl: normalizedMasterUrl } : {}),
                });
                setInstallationError(saved ? null : 'এই PC-এর সেটআপ সংরক্ষণ করা যায়নি।');
              }}
              className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-text hover:bg-accent-hover transition-colors"
            >
              Shop POS চালু করুন
            </button>
            {installationError && <p role="alert" className="mt-2 text-sm text-rose-400">{installationError}</p>}
          </section>
        </main>
      ) : (
        <>
          {/* 3-Zone Navigation Header */}
          <NavigationHeader />

          {/* Main Viewport */}
          <main className="min-w-0 flex-1 py-3 sm:py-5">
            <Suspense fallback={<ViewFallback />}>
              {activeView === 'windows_agent' && <WindowsAgentView />}
              {activeView === 'customer_pwa' && <CustomerPwaView />}
              {activeView === 'shop_pos' && <ShopPosView />}
            </Suspense>
          </main>

          {/* Windows 11 Toast Notification (Order alerts & chime) */}
          <WindowsToast />

          {/* Interactive Order Card & Action Modal */}
          <OrderCardModal />

          {/* Printable Counter Stand Poster Modal */}
          <CounterPosterModal />

          {/* Windows EXE Agent & Driver Layer Package Modal */}
          <WindowsExePackageModal />

          {/* Quiet Footer */}
          <footer className="py-4 border-t border-border-primary text-center text-xs text-text-tertiary">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>ALIF SHOHOJ PRINT — Windows QR Print Server & Digital Studio OS</span>
              <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
                <span>Bangladesh Digital Studio OS</span>
                <span>·</span>
                <span>
                  {window.alifShohojPrintDesktop ? 'Windows Agent Connected' : 'Web Preview Mode'}
                </span>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <StudioProvider>
        <StudioAppContent />
      </StudioProvider>
    </ThemeProvider>
  );
}
