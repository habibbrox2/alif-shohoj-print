/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { StudioProvider, useStudio } from './shared/context/StudioContext';
import { NavigationHeader } from './shared/components/NavigationHeader';
import { WindowsAgentView } from './features/print-agent/WindowsAgentView';
import { CustomerPwaView } from './features/customer-pwa/CustomerPwaView';
import { ShopPosView } from './features/shop-pos/ShopPosView';
import { WindowsToast } from './shared/components/WindowsToast';
import { OrderCardModal } from './features/shop-pos/OrderCardModal';
import { CounterPosterModal } from './features/shop-pos/CounterPosterModal';
import { WindowsExePackageModal } from './features/print-agent/WindowsExePackageModal';

const StudioAppContent: React.FC = () => {
  const {
    activeView,
    installationConfig,
    configureInstallation,
    counters,
  } = useStudio();
  const [installationMode, setInstallationMode] = useState<'master' | 'counter'>('master');
  const [installationCounterId, setInstallationCounterId] = useState('CTR-02');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {window.broxprintDesktop && !installationConfig ? (
        <main className="flex flex-1 items-center justify-center p-6">
          <section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">ALIF SHOHOJ PRINT · প্রথম সেটআপ</p>
            <h1 className="mt-2 text-xl font-bold text-white">এই পিসির ভূমিকা নির্বাচন করুন</h1>
            <p className="mt-2 text-sm text-slate-400">Shop POS খুলতে প্রথমে এই পিসি মূল পিসি নাকি কাউন্টার তা নির্ধারণ করুন।</p>
            <div className="mt-5 grid gap-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
                <input
                  type="radio"
                  name="installation-mode"
                  checked={installationMode === 'master'}
                  onChange={() => setInstallationMode('master')}
                />
                <span>
                  <strong className="block text-sm text-white">মূল পিসি / মূল দোকানদার</strong>
                  <span className="mt-1 block text-xs text-slate-400">সার্ভিস, প্রিন্টার এবং দোকানের সেটিংস পরিচালনা করবে।</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
                <input
                  type="radio"
                  name="installation-mode"
                  checked={installationMode === 'counter'}
                  onChange={() => setInstallationMode('counter')}
                />
                <span className="flex-1">
                  <strong className="block text-sm text-white">কাউন্টার পিসি / অপারেটর</strong>
                  <span className="mt-1 block text-xs text-slate-400">Shop POS ও অর্ডার পরিচালনার জন্য এই কাউন্টার বেছে নিন।</span>
                  {installationMode === 'counter' && (
                    <select
                      value={installationCounterId}
                      onChange={event => setInstallationCounterId(event.target.value)}
                      className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-800 p-2 text-sm text-white"
                    >
                      {counters.filter(counter => !counter.isMasterHost).map(counter => (
                        <option key={counter.id} value={counter.id}>{counter.code}: {counter.name}</option>
                      ))}
                    </select>
                  )}
                </span>
              </label>
            </div>
            <button
              type="button"
              onClick={() => configureInstallation({
                mode: installationMode,
                counterId: installationMode === 'master' ? 'CTR-01' : installationCounterId,
              })}
              className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Shop POS চালু করুন
            </button>
          </section>
        </main>
      ) : (
        <>
          {/* 3-Zone Navigation Header */}
          <NavigationHeader />

          {/* Main Viewport */}
          <main className="flex-1 py-4 sm:py-6">
            {activeView === 'windows_agent' && <WindowsAgentView />}
            {activeView === 'customer_pwa' && <CustomerPwaView />}
            {activeView === 'shop_pos' && <ShopPosView />}
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
          <footer className="py-4 border-t border-slate-900 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span>ALIF SHOHOJ PRINT — Windows QR Print Server & Digital Studio OS</span>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span>Bangladesh Digital Studio OS</span>
                <span>·</span>
                <span>Driver Abstraction Layer Active</span>
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
    <StudioProvider>
      <StudioAppContent />
    </StudioProvider>
  );
}
