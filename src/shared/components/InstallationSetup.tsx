import React, { useState } from 'react';
import { useStudio } from '../context/StudioContext';

/**
 * Minimal shape of the master PC's published LAN config, read-only probe of
 * `GET {masterUrl}/api/customer-config`. Used only to display host details.
 */
interface MasterHostProbe {
  status: 'idle' | 'probing' | 'ok' | 'fail';
  shopName?: string;
}

/**
 * First-run role picker: is this PC the master/shopkeeper host or a counter
 * operator terminal? Extracted from `App` so the dev harness and the desktop
 * shell share one implementation and the desktop app cannot lose the setup
 * flow when its entry point changes.
 */
export const InstallationSetup: React.FC = () => {
  const { installationConfig, configureInstallation, counters, saveCounterFeedKey, shopProfile, updateShopProfile } = useStudio();
  const [installationMode, setInstallationMode] = useState<'master' | 'counter'>('master');
  const availableCounters = counters.filter(counter => !counter.isMasterHost);
  const [installationCounterId, setInstallationCounterId] = useState<string>(
    availableCounters[0]?.id ?? 'CTR-02'
  );
  const [masterUrl, setMasterUrl] = useState('https://');
  const [feedKey, setFeedKey] = useState('');
  const [installationError, setInstallationError] = useState<string | null>(null);
  const [lanProbe, setLanProbe] = useState<MasterHostProbe>({ status: 'idle' });

  if (installationConfig) return null;

  const describeMasterHost = (): { host: string; port: string } | null => {
    try {
      const parsed = new URL(masterUrl.trim());
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) return null;
      return { host: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80') };
    } catch {
      return null;
    }
  };

  const probeMasterHost = async () => {
    const described = describeMasterHost();
    if (!described) return;
    setLanProbe({ status: 'probing' });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(new URL('/api/customer-config', masterUrl.trim()).toString(), {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const config: unknown = await response.json();
      const name = typeof config === 'object' && config !== null &&
        'shopProfile' in config &&
        typeof (config as { shopProfile?: { name?: unknown } }).shopProfile?.name === 'string'
        ? (config as { shopProfile: { name: string } }).shopProfile.name
        : undefined;
      setLanProbe({ status: 'ok', shopName: name });
    } catch {
      setLanProbe({ status: 'fail' });
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const save = async () => {
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
    if (installationMode === 'counter' && availableCounters.length === 0) {
      setInstallationError('কোনো কাউন্টার তৈরি হয়নি; মূল পিসিতে কাউন্টার তৈরি করে আবার চেষ্টা করুন।');
      return;
    }
    if (installationMode === 'counter' && !validMasterUrl) {
      setInstallationError('Counter PC-এর জন্য Master PC-এর সম্পূর্ণ URL দিন।');
      return;
    }
    const trimmedFeedKey = feedKey.trim();
    if (installationMode === 'counter' && trimmedFeedKey) {
      if (!/^[0-9a-f]{64}$/i.test(trimmedFeedKey)) {
        setInstallationError('ফিড কী ৬৪ অক্ষরের hex হতে হবে; মূল পিসির সেটআপ থেকে এটি কপি করুন।');
        return;
      }
      try {
        await saveCounterFeedKey(trimmedFeedKey);
      } catch (error) {
        setInstallationError(error instanceof Error ? error.message : 'ফিড কী সংরক্ষণ করা যায়নি।');
        return;
      }
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
            <span className="flex-1">
              <strong className="block text-sm text-text-primary">মূল পিসি / মূল দোকানদার</strong>
              <span className="mt-1 block text-xs text-text-secondary">সার্ভিস, প্রিন্টার এবং দোকানের সেটিংস পরিচালনা করবে।</span>
              {installationMode === 'master' && (
                <div className="mt-3 grid gap-2">
                  <label htmlFor="master-lan-ip" className="text-xs font-semibold text-text-primary">সংযুক্ত LAN-এর ঠিকানা (IP)</label>
                  <input
                    id="master-lan-ip"
                    type="text"
                    value={shopProfile.localServer.localIp}
                    onChange={event => updateShopProfile({ localServer: { ...shopProfile.localServer, localIp: event.target.value.trim() } })}
                    placeholder="192.168.0.100"
                    inputMode="url"
                    aria-label="Master PC LAN IP"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-border-primary bg-surface p-2 font-mono text-sm text-text-primary"
                  />
                  <span className="text-xs text-text-secondary">দোকানের অন্য ক্যাশ ও কাউন্টার পিসিগুলো এই LAN-এ যুক্ত থাকবে; কাউন্টার QR এই IP দেখিয়ে রিডাইরেক্ট করে।</span>
                </div>
              )}
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
                  {availableCounters.length === 0 ? (
                    <div role="status" className="rounded-lg border border-border-primary bg-surface p-3 text-xs text-text-secondary">
                      <p className="font-semibold text-text-primary">এখনো কোনো কাউন্টার তৈরি হয়নি</p>
                      <p className="mt-1">প্রথমে মূল পিসিতে (Master Host) অ্যাপ খুলে “Print Agent” ভিউ থেকে কাউন্টার তৈরি করুন; তারপর এই পিসিতে সেটআপ এসে কাউন্টারটি তালিকায় দেখা যাবে।</p>
                    </div>
                  ) : (
                    <select
                      value={installationCounterId}
                      onChange={event => setInstallationCounterId(event.target.value)}
                      className="w-full rounded-lg border border-border-primary bg-surface p-2 text-sm text-text-primary"
                    >
                      {availableCounters.map(counter => (
                        <option key={counter.id} value={counter.id}>{counter.code}: {counter.name}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="url"
                    value={masterUrl}
                    onChange={event => setMasterUrl(event.target.value)}
                    placeholder="https://192.168.1.105:43822"
                    aria-label="Master PC gateway URL"
                    className="w-full rounded-lg border border-border-primary bg-surface p-2 text-sm text-text-primary"
                  />
                  <span className="text-xs text-text-secondary">QR-এর একই host ও port-এর base URL দিন; ?shop=… অংশ দেবেন না।</span>
                  {(() => {
                    const described = describeMasterHost();
                    if (!described) return null;
                    return (
                      <div className="rounded-lg border border-border-primary bg-surface p-3 text-xs space-y-1" role="status">
                        <p className="font-semibold text-text-primary">একই LAN-এ সংযুক্ত ALIF SHOHOJ PRINT হোস্ট</p>
                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-text-secondary">
                          <span>LAN আইপি:</span><span className="font-mono text-text-primary">{described.host}</span>
                          <span>পোর্ট:</span><span className="font-mono text-text-primary">{described.port}</span>
                          {lanProbe.status === 'ok' && (
                            <>
                              <span>দোকান:</span><span className="text-emerald-400 font-semibold">{lanProbe.shopName || 'সংযুক্ত'}</span>
                            </>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void probeMasterHost()}
                          disabled={lanProbe.status === 'probing'}
                          className="mt-1 rounded-md border border-border-primary px-2 py-1 text-[11px] font-semibold text-text-primary hover:border-border-focus transition-colors disabled:opacity-60"
                        >
                          {lanProbe.status === 'probing' ? 'যাচাই চলছে…' : 'সংযোগ যাচাই করুন'}
                        </button>
                        {lanProbe.status === 'fail' && (
                          <p className="text-rose-400">হোস্টে কানেক্ট করা যায়নি; আইপি ও পোর্ট সঠিক আছে কিনা দেখুন।</p>
                        )}
                      </div>
                    );
                  })()}
                  <input
                    type="password"
                    value={feedKey}
                    onChange={event => setFeedKey(event.target.value)}
                    placeholder="মূল পিসির কাউন্টার ফিড কী (ঐচ্ছিক)"
                    aria-label="Master counter feed key"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-lg border border-border-primary bg-surface p-2 font-mono text-sm text-text-primary"
                  />
                  <span className="text-xs text-text-secondary">
                    কী ছাড়া এই কাউন্টার ইনবক্স শুধু নিজের সংরক্ষিত অর্ডার দেখায়। কী বসালে মূল পিসির লাইভ অর্ডার দেখা যাবে।
                  </span>
                </div>
              )}
            </span>
          </label>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          className="mt-5 w-full rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-text hover:bg-accent-hover transition-colors"
        >
          Shop POS চালু করুন
        </button>
        {installationError && <p role="alert" className="mt-2 text-sm text-rose-400">{installationError}</p>}
      </section>
    </main>
  );
};
