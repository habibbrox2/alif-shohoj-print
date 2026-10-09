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
    { value: 'windows_agent' as const, label: 'Windows Agent (EXE)', icon: <Monitor className="w-3.5 h-3.5" />, badge: pendingJobsCount > 0 ? pendingJobsCount : null },
    { value: 'customer_pwa' as const, label: 'Customer PWA (Mobile)', icon: <Smartphone className="w-3.5 h-3.5" />, badge: null },
    { value: 'shop_pos' as const, label: 'Shop POS & Web Admin', icon: <LayoutDashboard className="w-3.5 h-3.5" />, badge: null },
  ];

  return (
    <header className="sticky top-0 z-40 backdrop-mica border-b border-border-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shadow-lg" style={{
            boxShadow: '0 4px 12px rgba(16, 124, 16, 0.3)'
          }}>
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

        {/* Zone 2: Navigation views with clean segmented controls */}
        <nav className="flex items-center gap-1 p-1 bg-surface-elevated rounded-lg border border-border-primary overflow-x-auto">
          {navOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setActiveView(opt.value)}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap $
                {activeView === opt.value
                  ? 'bg-accent-light text-accent shadow-sm border border-accent/30'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'}
              `}
            >
              {opt.icon}
              <span>{opt.label}</span>
              {opt.badge && (
                <span className="w-4 h-4 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {opt.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Zone 3: Actions (Theme, DND, Counter Poster, Exe Download) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Theme Toggle */}
          <div className="relative group">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border-primary bg-surface-elevated hover:bg-surface-hover transition-colors"
              title={`Theme: ${theme}. Click to cycle.`}
              aria-label={`Theme: ${theme}`}
            >
              {theme === 'light' && <Sun className="w-3.5 h-3.5 text-warning" />}
              {theme === 'dark' && <Moon className="w-3.5 h-3.5 text-info" />}
              {theme === 'system' && <MonitorIcon className="w-3.5 h-3.5 text-text-secondary" />}
              <span className="hidden lg:inline text-text-secondary">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
            </button>
          </div>

          {/* Do Not Disturb Toggle */}
          <button
            onClick={() => updateShopProfile({ isDndMode: !shopProfile.isDndMode })}
            title={shopProfile.isDndMode ? 'দোকান বন্ধ / বিরতি মোড সক্রিয়' : 'দোকান খোলা আছে'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors $
              {shopProfile.isDndMode
                ? 'bg-warning-bg text-warning border-warning/30 hover:bg-warning-bg/80'
                : 'bg-success-bg text-success border-success/30 hover:bg-success-bg/80'}
            }`}
          >
            {shopProfile.isDndMode ? (
              <>
                <BellOff className="w-3.5 h-3.5 text-warning" />
                <span className="hidden lg:inline">বিরতি মোড (DND)</span>
              </>
            ) : (
              <>
                <Circle className="w-2.5 h-2.5 fill-success text-success" />
                <span className="hidden lg:inline">দোকান খোলা</span>
              </>
            )}
          </button>

          {/* Counter Poster Generator */}
          <button
            onClick={() => setIsPosterModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-secondary bg-surface-elevated hover:bg-surface-hover border border-border-primary rounded-lg transition-colors whitespace-nowrap"
            title="কাউন্টার QR স্ট্যান্ড প্রিন্ট করুন"
          >
            <QrCode className="w-3.5 h-3.5 text-accent" />
            <span className="hidden md:inline">কাউন্টার QR স্ট্যান্ড ({counters.length})</span>
          </button>

          {/* Download Windows Agent */}
          <button
            onClick={() => setIsExePackageModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-accent-text bg-accent hover:bg-accent-hover rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ALIF-SHOHOJ-PRINT.exe</span>
          </button>
        </div>
      </div>
    </header>
  );
};