import React, { useEffect, useState } from 'react';
import { useStudio } from '../../shared/context/StudioContext';
import { PrintJob } from '../../shared/types';
import type { DesktopConnectionInfo } from '../../shared/desktop-api';
import {
  DollarSign,
  Printer,
  FileCheck,
  CheckCircle,
  XCircle,
  Eye,
  Sliders,
  Save,
  Volume2,
  VolumeX,
  BellOff,
  Bell,
  Clock,
  ShieldCheck,
  RefreshCw,
  Zap,
} from 'lucide-react';

export const ShopPosView: React.FC = () => {
  const {
    shopProfile,
    updateShopProfile,
    pricing,
    updatePricing,
    jobs,
    todayPrintedCount,
    todayEarningsBDT,
    pendingJobsCount,
    setActiveOrderCardJob,
    approveJob,
    services,
    toggleStudioService,
    updateStudioService,
    counters,
    desktopQueueError,
  } = useStudio();

  const [activeTab, setActiveTab] = useState<'queue' | 'pricing' | 'settings'>('queue');
  const [selectedCounterFilter, setSelectedCounterFilter] = useState<string>('all');
  const [tempPricing, setTempPricing] = useState(pricing);
  const [pricingSavedToast, setPricingSavedToast] = useState(false);
  const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false);
  const [desktopConnectionInfo, setDesktopConnectionInfo] = useState<DesktopConnectionInfo | null>(null);
  const [showDesktopConnection, setShowDesktopConnection] = useState(false);
  const [desktopSettingsError, setDesktopSettingsError] = useState<string | null>(null);

  useEffect(() => {
    const desktop = window.broxprintDesktop;
    if (!desktop) return;

    let isMounted = true;
    Promise.all([desktop.getAutoLaunch(), desktop.getConnectionInfo()])
      .then(([autoLaunch, connectionInfo]) => {
        if (!isMounted) return;
        setAutoLaunchEnabled(autoLaunch);
        setDesktopConnectionInfo(connectionInfo);
      })
      .catch(error => {
        if (isMounted) setDesktopSettingsError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSavePricing = () => {
    updatePricing(tempPricing);
    setPricingSavedToast(true);
    setTimeout(() => setPricingSavedToast(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Metric Bar adhering to SaaS guidelines (tabular figures, no fluffy pill enclosures) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block">আজকের আয় (Today's Revenue)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              ৳ {todayEarningsBDT.toLocaleString()}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">ক্যাশ ও bKash সমন্বিত</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block">আজকে মোট প্রিন্ট (Jobs Printed)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-white tabular-nums">
              {todayPrintedCount}
            </span>
            <span className="text-xs text-slate-400">অর্ডার</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">গড় স্পুল সময়: ৪২ সেকেন্ড</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block">পেন্ডিং কিউ (Pending In Spool)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
              {pendingJobsCount}
            </span>
            <span className="text-xs text-slate-400">অর্ডার</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">উইন্ডোজ এজেন্টে সিঙ্কড</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <span className="text-xs text-slate-400 block">দোকানের অবস্থা (Studio Status)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${shopProfile.isDndMode ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            <span className="text-base font-bold text-white">
              {shopProfile.isDndMode ? 'বিরতি মোড (DND)' : 'খোলা আছে (Active)'}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">কোড: {shopProfile.code}</span>
        </div>
      </div>

      {/* POS Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'queue'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          লাইভ প্রিন্ট অর্ডার তালিকা ({jobs.length})
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'pricing'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          সার্ভিস মূল্য তালিকা (Price Config)
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'settings'
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          দোকান সেটিংস ও অটো-প্রিন্ট
        </button>
      </div>

      {/* TAB 1: Live Order Table */}
      {activeTab === 'queue' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">গ্রাহকের প্রিন্ট অর্ডার তালিকা</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                প্রতিটি অর্ডারে ক্লিক করে প্রিভিউ দেখুন বা এক ক্লিকে অনুমোদন করুন
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              মোট রেকর্ড: {jobs.length}
            </span>
          </div>

          {/* Counter Filter Tabs Bar */}
          <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] text-slate-400 font-semibold shrink-0">কাউন্টার ফিল্টার:</span>
            <button
              onClick={() => setSelectedCounterFilter('all')}
              className={`px-3 py-1 rounded-lg transition-colors shrink-0 font-medium ${
                selectedCounterFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
              }`}
            >
              সকল কাউন্টার ({jobs.length})
            </button>
            {counters.map(counter => {
              const count = jobs.filter(j => j.counterId === counter.id).length;
              return (
                <button
                  key={counter.id}
                  onClick={() => setSelectedCounterFilter(counter.id)}
                  className={`px-3 py-1 rounded-lg transition-colors shrink-0 font-medium flex items-center gap-1.5 ${
                    selectedCounterFilter === counter.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                  }`}
                >
                  <span>{counter.code}: {counter.name.split('-')[1]?.trim() || counter.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/80 font-mono">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">টোকেন / কাউন্টার</th>
                  <th className="py-3 px-4">সার্ভিস ও ফাইল</th>
                  <th className="py-3 px-4">স্পেসিফিকেশন</th>
                  <th className="py-3 px-4">প্রিন্টার (Auto-Route)</th>
                  <th className="py-3 px-4">বিল ও পেমেন্ট</th>
                  <th className="py-3 px-4">অবস্থা</th>
                  <th className="py-3 px-4 text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {(selectedCounterFilter === 'all'
                  ? jobs
                  : jobs.filter(j => j.counterId === selectedCounterFilter)
                ).map(job => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setActiveOrderCardJob(job)}
                  >
                    {/* Token & Counter */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-emerald-400 text-sm tabular-nums">
                        #{job.tokenCode}
                      </div>
                      <div className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono inline-block mt-0.5 border border-slate-700">
                        {job.counterId || 'CTR-1'}
                      </div>
                    </td>

                    {/* Service & file */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{job.serviceLabelBn}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{job.fileName}</span>
                        <span>·</span>
                        <span>{job.fileSize}</span>
                      </div>
                    </td>

                    {/* Specs */}
                    <td className="py-3 px-4 text-slate-300">
                      <div>{job.paperSize}</div>
                      <div className="text-[11px] text-slate-400">
                        {job.copies} কপি · {job.colorMode === 'color' ? 'কালার' : 'সাদা-কালো'}
                      </div>
                    </td>

                    {/* Assigned Printer */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-200">
                        <Printer className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{job.targetPrinterName.split(' ')[0]} {job.targetPrinterName.split(' ')[1]}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                        {job.routingReason}
                      </div>
                      {job.printError && (
                        <div role="alert" className="text-[10px] text-rose-300 mt-1 max-w-[180px]">
                          {job.printError}
                        </div>
                      )}
                    </td>

                    {/* Bill & Payment */}
                    <td className="py-3 px-4 font-mono">
                      <span className="font-bold text-emerald-400 tabular-nums">৳ {job.priceBDT}</span>
                      <div className="text-[11px] text-slate-400">
                        {job.paymentStatus === 'paid_mfs' ? 'পেইড ✅' : 'কাউন্টার ক্যাশ ⏳'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          job.status === 'completed'
                            ? 'bg-slate-800 text-slate-300'
                            : job.status === 'printing'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                            : job.status === 'rejected'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {job.status === 'completed'
                          ? 'সম্পন্ন'
                          : job.status === 'printing'
                          ? 'প্রিন্ট হচ্ছে'
                          : job.status === 'rejected'
                          ? 'বাতিল'
                          : 'অপেক্ষমাণ'}
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActiveOrderCardJob(job)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="কার্ড ও প্রিভিউ দেখুন"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {job.status === 'queued' && (
                          <button
                            onClick={() => approveJob(job.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-colors"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Pricing Configuration */}
      {activeTab === 'pricing' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">ডিজিটাল স্টুডিও সার্ভিস মূল্য তালিকা (BDT ৳)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                গ্রাহক যখন QR কোড স্ক্যান করে অর্ডার করবে তখন এই দাম প্রযোজ্য হবে।
              </p>
            </div>
            <button
              onClick={handleSavePricing}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>মূল্য সংরক্ষণ করুন</span>
            </button>
          </div>

          {pricingSavedToast && (
            <div className="p-2.5 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>মূল্য সফলভাবে আপডেট হয়েছে!</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-semibold text-emerald-400">ফটো স্টুডিও সার্ভিস</h4>

              <div>
                <label className="block text-slate-300 mb-1">পাসপোর্ট ছবি (৪ কপি শিট)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">৳</span>
                  <input
                    type="number"
                    value={tempPricing.passport4in1}
                    onChange={e => setTempPricing({ ...tempPricing, passport4in1: Number(e.target.value) })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">পাসপোর্ট ছবি (৮ কপি শিট)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">৳</span>
                  <input
                    type="number"
                    value={tempPricing.passport8in1}
                    onChange={e => setTempPricing({ ...tempPricing, passport8in1: Number(e.target.value) })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">স্ট্যাম্প সাইজ ছবি (প্রতি কপি)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">৳</span>
                  <input
                    type="number"
                    value={tempPricing.stampPhoto}
                    onChange={e => setTempPricing({ ...tempPricing, stampPhoto: Number(e.target.value) })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">4R গ্লসি ল্যাব ফটো (৪×৬ ইঞ্চি)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">৳</span>
                  <input
                    type="number"
                    value={tempPricing.photo4R}
                    onChange={e => setTempPricing({ ...tempPricing, photo4R: Number(e.target.value) })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono text-white"
                  />
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-semibold text-emerald-400">এনআইডি ও ডকুমেন্ট সার্ভিস</h4>

              <div>
                <label className="block text-slate-300 mb-1">এনআইডি স্মার্ট কার্ড কপি (ল্যামিনেট)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">৳</span>
                  <input
                    type="number"
                    value={tempPricing.nidSmartCard}
                    onChange={e => setTempPricing({ ...tempPricing, nidSmartCard: Number(e.target.value) })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">A4 ডকুমেন্ট (সাদা-কালো প্রতি পেজ)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">৳</span>
                  <input
                    type="number"
                    value={tempPricing.docA4BW}
                    onChange={e => setTempPricing({ ...tempPricing, docA4BW: Number(e.target.value) })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">A4 ডকুমেন্ট (কালার প্রতি পেজ)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">৳</span>
                  <input
                    type="number"
                    value={tempPricing.docA4Color}
                    onChange={e => setTempPricing({ ...tempPricing, docA4Color: Number(e.target.value) })}
                    className="w-24 bg-slate-800 border border-slate-700 rounded-lg p-1.5 font-mono text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Shop Settings & Auto Approve */}
      {activeTab === 'settings' && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-xl space-y-4 text-xs">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white">দোকানের তথ্য ও অটো-প্রিন্ট রুলস</h3>
            <p className="text-slate-400 mt-0.5">
              অটোমেশন ও নোটিফিকেশন সুবিধা নিয়ন্ত্রণ করুন।
            </p>
          </div>

          <div className="space-y-4">
            {desktopQueueError && (
              <p role="alert" className="rounded-lg border border-rose-900 bg-rose-950/50 p-3 text-rose-300">
                Desktop print queue error: {desktopQueueError}
              </p>
            )}

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div>
                <h4 className="font-semibold text-white">Windows Tray App</h4>
                <p className="text-slate-400 mt-0.5">
                  Windows login-এ অ্যাপটি tray-তে চালু হবে। প্রিন্ট কিউ ও WebSocket সংযোগ Electron desktop app-এ ব্যবহৃত হয়।
                </p>
              </div>
              {window.broxprintDesktop ? (
                <>
                  <label className="flex items-center justify-between gap-3 text-slate-200">
                    <span>Windows-এর সাথে চালু</span>
                    <input
                      type="checkbox"
                      checked={autoLaunchEnabled}
                      onChange={async event => {
                        const enabled = event.target.checked;
                        setDesktopSettingsError(null);
                        try {
                          const saved = await window.broxprintDesktop?.setAutoLaunch(enabled);
                          if (typeof saved === 'boolean') setAutoLaunchEnabled(saved);
                        } catch (error) {
                          setDesktopSettingsError(error instanceof Error ? error.message : String(error));
                        }
                      }}
                      className="w-5 h-5 accent-emerald-500 cursor-pointer"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-400">
                      WebSocket: {desktopConnectionInfo?.url || 'সংযোগের তথ্য লোড হচ্ছে…'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowDesktopConnection(value => !value)}
                      className="shrink-0 text-emerald-400 hover:text-emerald-300"
                    >
                      {showDesktopConnection ? 'গোপন করুন' : 'Token দেখুন'}
                    </button>
                  </div>
                  {showDesktopConnection && desktopConnectionInfo && (
                    <div className="space-y-1 rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-slate-300 break-all">
                      <div>Endpoint: {desktopConnectionInfo.url}</div>
                      <div>Authentication token: {desktopConnectionInfo.token}</div>
                      <div>Transport: {desktopConnectionInfo.secure ? 'WSS / TLS encrypted' : 'Localhost-only WS'}</div>
                      <p className="font-sans text-amber-300">
                        Token গোপন রাখুন। LAN ব্যবহারে trusted certificate দিয়ে WSS/TLS কনফিগার করুন।
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-slate-500">Windows startup ও native queue control শুধুমাত্র ইনস্টল করা desktop app-এ পাওয়া যাবে।</p>
              )}
              {desktopSettingsError && <p role="alert" className="text-rose-300">{desktopSettingsError}</p>}
            </div>

            {/* Service On/Off & Auto-Approve Controls */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div>
                <h4 className="font-semibold text-white">ডিজিটাল স্টুডিও সার্ভিস ও অটো-অ্যাপ্রুভ (Auto-Approve) কন্ট্রোল</h4>
                <p className="text-slate-400 mt-0.5">
                  সার্ভিস চালুবন্ধ এবং ম্যানুয়াল অ্যাপ্রুভাল বাইপাস করে সরাসরি প্রিন্টারে পাঠানোর পারমিশন নিয়ন্ত্রণ করুন।
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {[
                  {
                    id: 'doc_a4' as const,
                    label: 'A4 সাধারণ ডকুমেন্ট ও চালান',
                    rec: 'সুপারিশকৃত: অটো-অ্যাপ্রুভ চালু রাখলে দোকানদারের সময় বাঁচে',
                  },
                  {
                    id: 'nid_card' as const,
                    label: 'এনআইডি স্মার্ট কার্ড কপি',
                    rec: 'সুপারিশকৃত: ম্যানুয়াল রিভিউ রাখা নিরাপদ',
                  },
                  {
                    id: 'passport_photo' as const,
                    label: 'পাসপোর্ট ছবি (৪ বা ৮ কপি শিট)',
                    rec: 'সুপারিশকৃত: ম্যানুয়াল ক্রপ ও ফ্রেম রিভিউ রাখা উত্তম',
                  },
                  {
                    id: 'photo_4r' as const,
                    label: '৪-আর ল্যাব ফটো প্রিন্ট',
                    rec: 'হাই-গ্লসি ফটো পেপার কোয়ালিটি চেক',
                  },
                  {
                    id: 'stamp_photo' as const,
                    label: 'স্ট্যাম্প সাইজ ছবি',
                    rec: 'অফিসিয়াল স্ট্যাম্প সাইজ',
                  },
                ].map(srv => {
                  const studio = services.find(s => s.id === srv.id);
                  const isEnabled = studio ? studio.enabled : true;
                  const isAutoApprove = studio ? studio.autoApprove : false;
                  return (
                    <div
                      key={srv.id}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 font-bold text-xs">{srv.label}</span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.2 rounded ${
                              isEnabled
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {isEnabled ? 'চালু' : 'বন্ধ'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{srv.rec}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Auto-Approve toggle */}
                        <button
                          onClick={() => updateStudioService(srv.id, { autoApprove: !isAutoApprove })}
                          disabled={!isEnabled}
                          title={
                            isAutoApprove
                              ? 'অটো-অ্যাপ্রুভ: ম্যানুয়াল অনুমোদন ছাড়াই সরাসরি প্রিন্টারে স্পুল হবে।'
                              : 'ম্যানুয়াল: দোকানদার কার্ডে Approve চাপলে প্রিন্ট হবে।'
                          }
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-40 ${
                            isAutoApprove
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                          }`}
                        >
                          <Zap className={`w-3 h-3 ${isAutoApprove ? 'text-amber-400' : 'text-slate-500'}`} />
                          <span>{isAutoApprove ? 'অটো-অ্যাপ্রুভ চালু ⚡' : 'ম্যানুয়াল মোড'}</span>
                        </button>

                        {/* On / Off toggle */}
                        <button
                          onClick={() => toggleStudioService(srv.id)}
                          className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            isEnabled
                              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {isEnabled ? 'সার্ভিস চালু' : 'সার্ভিস বন্ধ'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sound alert */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-4">
              <div>
                <h4 className="font-semibold text-white">বাংলা অডিও সতর্কবার্তা (Bengali Voice Alert)</h4>
                <p className="text-slate-400 mt-0.5">
                  নতুন অর্ডার আসার সাথে সাথে উইন্ডোজ এজেন্টে "নতুন অর্ডার এসেছে" বাংলা ভয়েস ও বেল বাজবে।
                </p>
              </div>
              <input
                type="checkbox"
                checked={shopProfile.soundAlertEnabled}
                onChange={e => updateShopProfile({ soundAlertEnabled: e.target.checked })}
                className="w-5 h-5 accent-emerald-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Payment merchant numbers */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="font-semibold text-white">মোবাইল ব্যাংকিং নম্বর (bKash & Nagad)</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">bKash মার্চেন্ট/পার্সোনাল নম্বর</label>
                  <input
                    type="text"
                    value={shopProfile.bkashNumber}
                    onChange={e => updateShopProfile({ bkashNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Nagad নম্বর</label>
                  <input
                    type="text"
                    value={shopProfile.nagadNumber}
                    onChange={e => updateShopProfile({ nagadNumber: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
