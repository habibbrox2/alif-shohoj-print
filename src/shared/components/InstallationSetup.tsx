import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';

/**
 * First-run role picker: is this PC the master/shopkeeper host or a counter
 * operator terminal? Extracted from `App` so the dev harness and the desktop
 * shell share one implementation and the desktop app cannot lose the setup
 * flow when its entry point changes.
 */
export const InstallationSetup: React.FC = () => {
  const { installationConfig, configureInstallation, counters } = useStudio();
  const [installationMode, setInstallationMode] = useState<'master' | 'counter'>('master');
  const [installationCounterId, setInstallationCounterId] = useState('CTR-02');
  const [masterUrl, setMasterUrl] = useState('https://');
  const [installationError, setInstallationError] = useState<string | null>(null);

  if (installationConfig) return null;

  const save = () => {
    const normalizedMasterUrl = masterUrl.trim().replace(/\/$/, '');
    let validMasterUrl = false;
    try {
      const parsedMasterUrl = new URL(normalizedMasterUrl);
      validMasterUrl = ['https:', 'http:'].includes(parsedMasterUrl.protocol) &&
        Boolean(parsedMasterUrl.hostname) && !parsedMasterUrl.username && !parsedMasterUrl.password &&
        parsedMasterUrl.pathname === '/' && !parsedMasterUrl.search && !parsedMasterUrl.hash;
    } catch {
      validMasterUrl = false;
    }
    if (installationMode === 'counter' && !validMasterUrl) {
      setInstallationError('Counter PC-এর জন্য Master PC-এর সম্পূর্ণ URL দিন।');
      return;
    }
    const saved = configureInstallation({
      mode: installationMode,
      counterId: installationMode === 'master' ? 'CTR-01' : installationCounterId,
      ...(installationMode === 'counter' ? { masterUrl: normalizedMasterUrl } : {}),
    });
    setInstallationError(saved ? null : 'এই PC-এর সেটআপ সংরক্ষণ করা যায়নি।');
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <section className="w-full max-w-lg rounded-xl border border-border-primary bg-surface p-6 shadow-md">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Alif Shohoj Print · প্রথম সেটআপ</p>
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
                  <input
                    type="url"
                    value={masterUrl}
                    onChange={event => setMasterUrl(event.target.value)}
                    placeholder="https://192.168.1.105:43822"
                    aria-label="Master PC gateway URL"
                    className="w-full rounded-lg border border-border-primary bg-surface p-2 text-sm text-text-primary"
                  />
                  <span className="text-xs text-text-secondary">QR-এর একই host ও port-এর base URL দিন; ?shop=… অংশ দেবেন না।</span>
                </div>
              )}
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={save}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-text hover:bg-accent-hover transition-colors"
        >
          Shop POS চালু করুন
        </button>
        {installationError && <p role="alert" className="mt-2 text-sm text-rose-400">{installationError}</p>}
      </section>
    </main>
  );
};
