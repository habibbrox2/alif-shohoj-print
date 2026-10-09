import React from 'react';
import { useStudio } from '../context/StudioContext';
import { useTheme } from '../context/ThemeContext';
import { Monitor, Smartphone, LayoutDashboard, QrCode, Download, Bell, BellOff, Circle, Sun, Moon, Monitor as MonitorIcon } from 'lucide-react';

export const NavigationHeader: React.FC = () => {
  const {
    activeView,
    setActiveView,
    shopProfile,
    updateShopProfile,
    pendingJobsCount,
    setIsPosterModalOpen,
    setIsExePackageModalOpen,
    counters,
  } = useStudio();
  const { theme, setTheme } = useTheme();

  const navOptions = [
    { value: 'windows_agent' as const, label: 'Print Agent', compactLabel: 'Agent', icon: <Monitor className="w-4 h-4" />, badge: pendingJobsCount > 0 ? pendingJobsCount : null },
    { value: 'customer_pwa' as const, label: 'Customer PWA', compactLabel: 'Mobile', icon: <Smartphone className="w-4 h-4" />, badge: null },
    { value: 'shop_pos' as const, label: 'Shop POS', compactLabel: 'POS', icon: <LayoutDashboard className="w-4 h-4" />, badge: null },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border-primary backdrop-mica">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent shadow-sm">
            <span className="font-bold text-accent-text text-base tracking-wider">AL</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-text-primary leading-none">
              ALIF SHOHOJ PRINT
            </h1>
            <p className="text-[11px] text-text-secondary leading-none mt-1 hidden sm:block">
              {shopProfile.name} · Code: <span className="font-mono text-accent">{shopProfile.code}</span>
            </p>
          </div>
        </div>

        {/* Development preview only: the shipped desktop shell has its own tab bar. */}
        {import.meta.env.DEV && (
          <nav aria-label="Main navigation" className="col-span-2 flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-border-primary bg-surface-elevated p-1 lg:col-span-1 lg:justify-self-center">
            {navOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setActiveView(opt.value)}
                aria-current={activeView === opt.value ? 'page' : undefined}
                aria-label={opt.label}
                className={`flex min-h-9 shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  activeView === opt.value
                    ? 'border border-accent/30 bg-accent-light text-accent shadow-sm'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {opt.icon}
                <span className="sm:hidden">{opt.compactLabel}</span>
                <span className="hidden sm:inline">{opt.label}</span>
                {opt.badge && (
                  <span className="w-4 h-4 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {opt.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        )}

        {/* Zone 3: Actions (Theme, DND, Counter Poster, Exe Download) */}
        <div className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1.5 lg:col-auto lg:row-auto lg:gap-2">
          {/* Theme Toggle */}
          <div className="relative group">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
              className="flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-border-primary bg-surface-elevated px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface-hover"
              title={`Theme: ${theme}. Click to cycle.`}
              aria-label={`Theme: ${theme}`}
            >
              {theme === 'light' && <Sun className="w-3.5 h-3.5 text-warning" />}
              {theme === 'dark' && <Moon className="w-3.5 h-3.5 text-info" />}
              {theme === 'system' && <MonitorIcon className="w-3.5 h-3.5 text-text-secondary" />}
              <span className="hidden 2xl:inline text-text-secondary">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
            </button>
          </div>

          {/* Do Not Disturb Toggle */}
          <button
            onClick={() => updateShopProfile({ isDndMode: !shopProfile.isDndMode })}
            title={shopProfile.isDndMode ? 'দোকান বন্ধ / বিরতি মোড সক্রিয়' : 'দোকান খোলা আছে'}
            aria-label={shopProfile.isDndMode ? 'বিরতি মোড সক্রিয়' : 'দোকান খোলা আছে'}
            className={`flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              shopProfile.isDndMode
                ? 'border-warning/30 bg-warning-bg text-warning hover:bg-warning-bg/80'
                : 'border-success/30 bg-success-bg text-success hover:bg-success-bg/80'
            }`}
          >
            {shopProfile.isDndMode ? (
              <>
                <BellOff className="w-3.5 h-3.5 text-warning" />
                <span className="hidden 2xl:inline">বিরতি মোড</span>
              </>
            ) : (
              <>
                <Circle className="w-2.5 h-2.5 fill-success text-success" />
                <span className="hidden 2xl:inline">দোকান খোলা</span>
              </>
            )}
          </button>

          {/* Counter Poster Generator */}
          <button
            onClick={() => setIsPosterModalOpen(true)}
            aria-label="কাউন্টার QR স্ট্যান্ড প্রিন্ট করুন"
            className="flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-border-primary bg-surface-elevated px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover whitespace-nowrap"
            title="কাউন্টার QR স্ট্যান্ড প্রিন্ট করুন"
          >
            <QrCode className="w-3.5 h-3.5 text-accent" />
            <span className="hidden 2xl:inline">কাউন্টার QR ({counters.length})</span>
          </button>

          {/* Download Windows Agent */}
          <button
            onClick={() => setIsExePackageModalOpen(true)}
            title="Download Windows print agent"
            className="flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-text shadow-sm transition-colors hover:bg-accent-hover whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Get Windows Agent</span>
          </button>
        </div>
      </div>
    </header>
  );
};
