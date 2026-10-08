import React from 'react';
import { useStudio } from '../context/StudioContext';
import { Monitor, Smartphone, LayoutDashboard, QrCode, Download, Bell, BellOff, Circle } from 'lucide-react';

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

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand Title (Clean wordmark in display face, no pill badges) */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-900/30">
            <span className="font-bold text-white text-base tracking-wider">AL</span>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-none">
              ALIF SHOHOJ PRINT
            </h1>
            <p className="text-[11px] text-slate-400 leading-none mt-1 hidden sm:block">
              {shopProfile.name} · Code: <span className="font-mono text-emerald-400">{shopProfile.code}</span>
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation views with clean segmented controls */}
        <nav className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveView('windows_agent')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeView === 'windows_agent'
                ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Windows Agent (EXE)</span>
            {pendingJobsCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {pendingJobsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView('customer_pwa')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeView === 'customer_pwa'
                ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Customer PWA (Mobile)</span>
          </button>

          <button
            onClick={() => setActiveView('shop_pos')}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeView === 'shop_pos'
                ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Shop POS & Web Admin</span>
          </button>
        </nav>

        {/* Zone 3: Actions (Counter Poster, DND, Exe Download) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Do Not Disturb Toggle */}
          <button
            onClick={() => updateShopProfile({ isDndMode: !shopProfile.isDndMode })}
            title={shopProfile.isDndMode ? 'দোকান বন্ধ / বিরতি মোড সক্রিয়' : 'দোকান খোলা আছে'}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              shopProfile.isDndMode
                ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 hover:bg-amber-900/60'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
            }`}
          >
            {shopProfile.isDndMode ? (
              <>
                <BellOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden lg:inline">বিরতি মোড (DND)</span>
              </>
            ) : (
              <>
                <Circle className="w-2.5 h-2.5 fill-emerald-500 text-emerald-500" />
                <span className="hidden lg:inline">দোকান খোলা</span>
              </>
            )}
          </button>

          {/* Counter Poster Generator */}
          <button
            onClick={() => setIsPosterModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
            title="কাউন্টার QR স্ট্যান্ড প্রিন্ট করুন"
          >
            <QrCode className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">কাউন্টার QR স্ট্যান্ড ({counters.length})</span>
          </button>

          {/* Download Windows Agent */}
          <button
            onClick={() => setIsExePackageModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ALIF-SHOHOJ-PRINT.exe</span>
          </button>
        </div>
      </div>
    </header>
  );
};
