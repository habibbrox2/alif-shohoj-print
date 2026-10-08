import React, { useState, useRef, useEffect } from 'react';
import { useStudio } from '../../shared/context/StudioContext';
import { ServiceType, PaperSize, ColorMode, PaymentMethod, PaymentStatus, VoiceStep } from '../../shared/types';
import { globalVoice, playTapTone } from '../../shared/services/voiceGuide';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Pause,
  Upload,
  Camera,
  Scissors,
  CheckCircle,
  QrCode,
  ShieldCheck,
  Clock,
  Sparkles,
  Smartphone,
  ChevronRight,
  Info,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileCheck,
  AlertCircle,
  Copy,
} from 'lucide-react';

const PRESET_SAMPLES = [
  {
    id: 'sample_nid',
    name: 'স্মার্ট এনআইডি কার্ড (নমুনা)',
    serviceType: 'nid_card' as ServiceType,
    url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=700&auto=format&fit=crop&q=80',
    aspectRatio: '85:54',
  },
  {
    id: 'sample_passport',
    name: 'স্টুডিও পাসপোর্ট ছবি (নমুনা)',
    serviceType: 'passport_photo' as ServiceType,
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=700&auto=format&fit=crop&q=80',
    aspectRatio: '35:45',
  },
  {
    id: 'sample_photo4r',
    name: 'পারিবারিক ছবি 4R (নমুনা)',
    serviceType: 'photo_4r' as ServiceType,
    url: 'https://images.unsplash.com/photo-1511895426328-dc8714191300?w=700&auto=format&fit=crop&q=80',
    aspectRatio: '4:6',
  },
  {
    id: 'sample_doc',
    name: 'বিশ্ববিদ্যালয় সার্টিফিকেট (নমুনা)',
    serviceType: 'doc_a4' as ServiceType,
    url: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=700&auto=format&fit=crop&q=80',
    aspectRatio: 'A4',
  },
];

export const CustomerPwaView: React.FC = () => {
  const { shopProfile, pricing, createCustomerJob, counters, activeCounterId, services } = useStudio();

  // Read counter code from URL (e.g. ?counter=CTR-2) or fallback to activeCounterId
  const initialCounterId = (() => {
    try {
      const param = new URLSearchParams(window.location.search).get('counter');
      if (param) {
        const found = counters.find(c => c.code === param || c.id === param);
        if (found) return found.id;
      }
    } catch {}
    return activeCounterId || counters[0]?.id || 'CTR-01';
  })();

  const [selectedCounterId, setSelectedCounterId] = useState<string>(initialCounterId);
  const [showCounterPicker, setShowCounterPicker] = useState(false);
  const selectedCounter = counters.find(c => c.id === selectedCounterId) || counters[0];

  // Voice guide state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceSpeaking, setVoiceSpeaking] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceLang, setVoiceLang] = useState<'bn' | 'en'>('bn');

  // Customer workflow steps: 1: Service, 2: Upload, 3: Crop, 4: Options & Bill, 5: Token Slip
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Order configuration
  const [selectedService, setSelectedService] = useState<ServiceType>('passport_photo');
  const [fileUrl, setFileUrl] = useState<string>(PRESET_SAMPLES[1].url);
  const [fileName, setFileName] = useState<string>('sample_passport.jpg');
  const [fileSize, setFileSize] = useState<string>('1.8 MB');
  const [fileError, setFileError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  // Crop / Transform
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<string>('35:45');
  const [gridCount, setGridCount] = useState<number>(4); // 4-in-1 for passport

  // Print options
  const [copies, setCopies] = useState<number>(1);
  const [colorMode, setColorMode] = useState<ColorMode>('color');
  const [paperFinish, setPaperFinish] = useState<'glossy' | 'matte' | 'laminated' | 'normal'>('glossy');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('counter_cash');

  // Customer contact info
  const [customerPhone, setCustomerPhone] = useState<string>('01700-123456');

  // Completed token result
  const [completedJob, setCompletedJob] = useState<{
    tokenCode: string;
    price: number;
    jobId: string;
  } | null>(null);

  // Synchronize Voice Assistant state
  useEffect(() => {
    globalVoice.setOnStateChange(speaking => {
      setVoiceSpeaking(speaking);
    });
  }, []);

  const triggerStepVoice = (step: VoiceStep, extra?: { tokenCode?: string; price?: number }) => {
    if (voiceEnabled) {
      globalVoice.speakStep(step, extra);
    }
  };

  const handleEnableVoiceGuide = () => {
    playTapTone();
    setVoiceEnabled(true);
    globalVoice.speakStep('welcome');
    setTimeout(() => {
      triggerStepVoice('service');
    }, 3500);
  };

  const handleSelectService = (service: ServiceType) => {
    playTapTone();
    setSelectedService(service);
    const preferences = services.find(item => item.id === service)?.preferences;
    if (preferences) {
      setColorMode(preferences.color);
      setCopies(preferences.defaultCopies);
      setPaperFinish(
        preferences.paperType === 'laminated' ? 'laminated' :
        preferences.paperType === 'glossy' ? 'glossy' :
        preferences.paperType === 'matte' ? 'matte' : 'normal'
      );
    }
    if (service === 'passport_photo') {
      setAspectRatio('35:45');
      setGridCount(4);
      setFileUrl(PRESET_SAMPLES[1].url);
    } else if (service === 'nid_card') {
      setAspectRatio('85:54');
      setGridCount(4);
      setFileUrl(PRESET_SAMPLES[0].url);
    } else if (service === 'photo_4r') {
      setAspectRatio('4:6');
      setGridCount(1);
      setFileUrl(PRESET_SAMPLES[2].url);
    } else if (service === 'doc_a4') {
      setAspectRatio('A4');
      setGridCount(1);
      setFileUrl(PRESET_SAMPLES[3].url);
    }

    setCurrentStep(2);
    triggerStepVoice('upload');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      playTapTone();
      setFileError(null);
      if (file.size > 40 * 1024 * 1024) {
        setFileError('ডেস্কটপ প্রিন্টের জন্য ফাইল ৪০ MB-এর কম হতে হবে।');
        return;
      }

      const finishUpload = (url: string) => {
        setFileUrl(url);
        setFileName(file.name);
        setFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
        setCurrentStep(3);
        triggerStepVoice('crop');
      };

      if (!window.broxprintDesktop) {
        finishUpload(URL.createObjectURL(file));
        return;
      }

      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        setFileError('Windows silent printing-এ PDF, JPEG অথবা PNG ফাইল ব্যবহার করুন।');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') finishUpload(reader.result);
        else setFileError('ফাইল পড়া যায়নি। আবার আপলোড করুন।');
      };
      reader.onerror = () => setFileError('ফাইল পড়া যায়নি। আবার আপলোড করুন।');
      reader.readAsDataURL(file);
    }
  };

  const handleSelectPresetSample = (sample: typeof PRESET_SAMPLES[0]) => {
    playTapTone();
    setFileError(null);
    setFileUrl(sample.url);
    setFileName(`${sample.id}.jpg`);
    setFileSize('1.5 MB');
    setCurrentStep(3);
    triggerStepVoice('crop');
  };

  const calculatePrice = (): number => {
    let unit = 35;
    if (selectedService === 'passport_photo') {
      unit = gridCount === 8 ? pricing.passport8in1 : pricing.passport4in1;
    } else if (selectedService === 'nid_card') {
      unit = pricing.nidSmartCard;
    } else if (selectedService === 'photo_4r') {
      unit = pricing.photo4R;
    } else if (selectedService === 'doc_a4') {
      unit = colorMode === 'color' ? pricing.docA4Color : pricing.docA4BW;
    }
    return unit * copies;
  };

  const handleSubmitOrder = () => {
    if (isSubmittingOrder) return;
    playTapTone();
    const finalPrice = calculatePrice();
    const paperSizeLabel: PaperSize =
      selectedService === 'passport_photo'
        ? gridCount === 8 ? 'Passport Grid (8-in-1)' : 'Passport Grid (4-in-1)'
        : selectedService === 'photo_4r'
        ? '4R (4x6 in)'
        : 'A4 (8.27x11.69 in)';

    const serviceLabelBn =
      selectedService === 'passport_photo'
        ? `পাসপোর্ট ছবি (${gridCount} কপি শিট)`
        : selectedService === 'nid_card'
        ? 'এনআইডি স্মার্ট কার্ড কপি'
        : selectedService === 'photo_4r'
        ? '4R ল্যাব ফটো প্রিন্ট'
        : 'A4 ডকুমেন্ট প্রিন্ট';

    const createJob = (printableFileUrl: string) => {
      const createdJob = createCustomerJob({
        tokenCode: '',
        customerPhone,
        counterId: selectedCounter.id,
        counterName: selectedCounter.name,
        serviceType: selectedService,
        serviceLabel: selectedService.replace('_', ' ').toUpperCase(),
        serviceLabelBn,
        paperSize: paperSizeLabel,
        paperFinish,
        copies,
        colorMode,
        priceBDT: finalPrice,
        paymentMethod,
        paymentStatus: paymentMethod === 'bkash' || paymentMethod === 'nagad' ? 'paid_mfs' : 'unpaid',
        fileUrl: printableFileUrl,
        fileName,
        fileSize,
        cropSettings: {
          zoom,
          rotation,
          brightness: 100,
          contrast: 100,
          aspectRatio,
        },
        gridCount,
      });

      setCompletedJob({
        tokenCode: createdJob.tokenCode,
        price: finalPrice,
        jobId: createdJob.id,
      });

      setCurrentStep(5);

      // Audio announcement of token code (PII safe: no phone/name spoken!)
      triggerStepVoice('token', { tokenCode: createdJob.tokenCode, price: finalPrice });

      // Festive confetti
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    };

    if (!window.broxprintDesktop || fileUrl.startsWith('data:')) {
      createJob(fileUrl);
      return;
    }

    setIsSubmittingOrder(true);
    setFileError(null);
    void fetch(fileUrl)
      .then(async response => {
        if (!response.ok) throw new Error(`Demo file download failed (${response.status}).`);
        const blob = await response.blob();
        if (blob.size > 40 * 1024 * 1024) throw new Error('The print file exceeds the 40 MB desktop limit.');
        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(blob.type)) {
          throw new Error('Windows silent printing supports PDF, JPEG, or PNG files.');
        }
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The demo file could not be read.'));
          reader.onerror = () => reject(new Error('The demo file could not be read.'));
          reader.readAsDataURL(blob);
        });
      })
      .then(printableFileUrl => {
        setFileUrl(printableFileUrl);
        createJob(printableFileUrl);
      })
      .catch(error => setFileError(error instanceof Error ? error.message : String(error)))
      .finally(() => setIsSubmittingOrder(false));
  };

  const isPdfFile = fileUrl.startsWith('data:application/pdf') || /\.pdf(?:$|[?#])/i.test(fileName);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* Phone Frame Wrapper */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 min-h-[640px]">
        {/* Mobile Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 text-center relative">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-mono text-emerald-400 font-semibold">{shopProfile.code}</span>
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ১৫ মিনিটে অটো-ডিলিট
            </span>
          </div>
          <h2 className="text-sm font-bold text-white">{shopProfile.nameBn}</h2>
          <p className="text-[11px] text-slate-400 mt-0.5">মোবাইল থেকে সরাসরি কাউন্টারে প্রিন্ট</p>
        </div>

        {/* Counter Location Banner (Dedicated Multi-Counter LAN Awareness) */}
        <div className="bg-slate-950/80 px-3.5 py-2 border-b border-slate-800 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-white">{selectedCounter.name.split('-')[0]?.trim() || selectedCounter.name}</span>
              <span className="text-[11px] text-emerald-400 font-mono">({selectedCounter.code})</span>
            </div>
            <button
              onClick={() => setShowCounterPicker(!showCounterPicker)}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 underline font-medium"
            >
              {showCounterPicker ? 'কাউন্টার লুকান' : 'কাউন্টার বদলান'}
            </button>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
            <span>অপারেটর: {selectedCounter.operator}</span>
            <span className="text-slate-500 font-mono">LAN: {selectedCounter.ipAddress}</span>
          </div>

          {/* Inline Counter Picker */}
          {showCounterPicker && (
            <div className="mt-2 pt-2 border-t border-slate-800 space-y-1.5 animate-in fade-in duration-150">
              <div className="text-[10px] font-semibold text-slate-400 uppercase">
                আপনি যে ডেস্কে বা কাউন্টারে দাঁড়িয়ে আছেন তা বেছে নিন:
              </div>
              <div className="grid grid-cols-1 gap-1">
                {counters.map(counter => (
                  <button
                    key={counter.id}
                    onClick={() => {
                      setSelectedCounterId(counter.id);
                      setShowCounterPicker(false);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors flex items-center justify-between ${
                      selectedCounterId === counter.id
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/50'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold">{counter.name}</div>
                      <div className="text-[10px] text-slate-400">{counter.operator}</div>
                    </div>
                    {selectedCounterId === counter.id && (
                      <span className="text-[10px] font-bold text-emerald-400 font-mono">যুক্ত ✅</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Shop Paused Banner if DND is active */}
        {shopProfile.isDndMode && (
          <div className="p-3 bg-amber-950/70 border-b border-amber-800/80 text-amber-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{shopProfile.dndMessage}</span>
          </div>
        )}

        {/* Voice Guidance Activation Bar (MANDATORY REQUIREMENT) */}
        {!voiceEnabled ? (
          <div className="p-3.5 bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-slate-900 border-b border-emerald-800/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center animate-pulse">
                <Volume2 className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">ভয়েস নির্দেশনা শুনুন</h4>
                <p className="text-[10px] text-emerald-300/80">প্রতিটি ধাপে পরিষ্কার বাংলা গাইড</p>
              </div>
            </div>

            <button
              onClick={handleEnableVoiceGuide}
              className="py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-950 transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>🔊 ভয়েস চালু করুন</span>
            </button>
          </div>
        ) : (
          /* Active Voice Guide Floating Control Bar */
          <div className="px-3.5 py-2 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${voiceSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
              <span className="text-[11px] text-slate-300 font-medium">
                {voiceSpeaking ? 'বলছে…' : 'ভয়েস গাইড সক্রিয়'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Replay button */}
              <button
                onClick={() => {
                  playTapTone();
                  const stepMap: Record<number, VoiceStep> = {
                    1: 'service',
                    2: 'upload',
                    3: 'crop',
                    4: 'preview',
                    5: 'token',
                  };
                  triggerStepVoice(stepMap[currentStep] || 'welcome', {
                    tokenCode: completedJob?.tokenCode,
                    price: completedJob?.price,
                  });
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                title="আবার শুনুন"
              >
                <RotateCcw className="w-3 h-3 text-emerald-400" />
                <span>🔁 আবার</span>
              </button>

              {/* Speed toggle */}
              <button
                onClick={() => {
                  playTapTone();
                  const next = voiceSpeed === 1.0 ? 1.2 : voiceSpeed === 1.2 ? 0.8 : 1.0;
                  setVoiceSpeed(next);
                  globalVoice.setSpeed(next);
                }}
                className="px-2 py-1 rounded bg-slate-800 text-[10px] font-mono text-slate-300 hover:text-white"
                title="গতির পরিবর্তন"
              >
                {voiceSpeed}x
              </button>

              {/* Bangla / English switch */}
              <button
                onClick={() => {
                  playTapTone();
                  const next = voiceLang === 'bn' ? 'en' : 'bn';
                  setVoiceLang(next);
                  globalVoice.setLanguage(next);
                }}
                className="px-2 py-1 rounded bg-slate-800 text-[10px] font-medium text-emerald-400 hover:bg-slate-700"
              >
                {voiceLang === 'bn' ? 'বাং' : 'EN'}
              </button>

              {/* Mute button */}
              <button
                onClick={() => {
                  playTapTone();
                  globalVoice.toggleMute();
                  setVoiceEnabled(false);
                }}
                className="p-1 rounded text-slate-500 hover:text-slate-300"
                title="থামান"
              >
                <VolumeX className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Step Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* STEP 1: What would you like to print? (কী প্রিন্ট করবেন?) */}
          {currentStep === 1 && (
            <div className="space-y-3 animate-in fade-in">
              <div className="text-center space-y-1">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  ধাপ ১ / ৫ · সেবা নির্বাচন
                </span>
                <h3 className="text-base font-bold text-white">কী প্রিন্ট করতে চান?</h3>
                <p className="text-xs text-slate-400">আপনার প্রয়োজনীয় সার্ভিসটিতে ট্যাপ করুন</p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                {[
                  {
                    id: 'passport_photo' as ServiceType,
                    title: 'পাসপোর্ট ছবি',
                    subtitle: '৪ বা ৮ কপি শিট',
                    price: `৳ ${pricing.passport4in1}`,
                    icon: '📸',
                  },
                  {
                    id: 'nid_card' as ServiceType,
                    title: 'এনআইডি কপি',
                    subtitle: 'স্মার্ট কার্ড / ল্যামিনেট',
                    price: `৳ ${pricing.nidSmartCard}`,
                    icon: '💳',
                  },
                  {
                    id: 'photo_4r' as ServiceType,
                    title: '৪-আর ছবি প্রিন্ট',
                    subtitle: '৪×৬ ইঞ্চি গ্লসি ফটো',
                    price: `৳ ${pricing.photo4R}`,
                    icon: '🖼️',
                  },
                  {
                    id: 'doc_a4' as ServiceType,
                    title: 'ডকুমেন্ট ও ফাইল',
                    subtitle: 'A4 সাদা-কালো বা কালার',
                    price: `৳ ${pricing.docA4BW} থেকে`,
                    icon: '📄',
                  },
                ].map(item => {
                  const studio = services.find(s => s.id === item.id);
                  const isEnabled = studio ? studio.enabled : true;
                  return (
                    <button
                      key={item.id}
                      onClick={() => isEnabled && handleSelectService(item.id)}
                      disabled={!isEnabled}
                      className={`p-3.5 rounded-2xl border text-left transition-all group ${
                        isEnabled
                          ? 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/80 hover:bg-slate-800/60 active:scale-[0.98]'
                          : 'bg-slate-950/40 border-slate-800/50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{item.icon}</span>
                      <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {item.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{item.subtitle}</p>
                      {isEnabled ? (
                        <span className="inline-block mt-2 text-[11px] font-mono font-bold text-emerald-400">
                          {item.price}
                        </span>
                      ) : (
                        <span className="inline-block mt-2 text-[10px] font-bold text-amber-400">
                          দোকানে বন্ধ আছে
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: File Upload */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    ধাপ ২ / ৫ · ফাইল আপলোড
                  </span>
                  <h3 className="text-sm font-bold text-white">মোবাইল থেকে ফাইল দিন</h3>
                </div>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← পরিবর্তন
                </button>
              </div>

              {/* Native File Dropzone / Camera Picker */}
              <label className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer bg-slate-950/60 transition-colors group">
                <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-emerald-950 flex items-center justify-center text-emerald-400 transition-colors">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-xs font-semibold text-white">ছবি বা PDF আপলোড করুন</span>
                <span className="text-[11px] text-slate-400">ক্যামেরা দিয়ে তুলুন অথবা গ্যালারি বেছে নিন</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {fileError && <p role="alert" className="text-xs text-rose-300">{fileError}</p>}

              {/* Instant 1-Click Preset Samples for easy testing */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] text-slate-400 block font-medium">
                  অথবা দ্রুত টেস্ট করতে ডেমো ফাইল বেছে নিন:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_SAMPLES.map(sample => (
                    <button
                      key={sample.id}
                      onClick={() => handleSelectPresetSample(sample)}
                      className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-left text-xs flex items-center gap-2 transition-colors"
                    >
                      <img
                        src={sample.url}
                        alt={sample.name}
                        referrerPolicy="no-referrer"
                        className="w-8 h-8 rounded object-cover"
                      />
                      <span className="truncate text-[11px] text-slate-200">{sample.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Studio Canvas Cropping & Ratio */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    ধাপ ৩ / ৫ · ক্রপ ও সাইজ
                  </span>
                  <h3 className="text-sm font-bold text-white">{isPdfFile ? 'ডকুমেন্ট প্রিভিউ' : 'ছবির ফ্রেম ও রেশিও ঠিক করুন'}</h3>
                </div>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← ব্যাক
                </button>
              </div>

              {/* Crop Box Preview with Guidelines */}
              <div className="relative rounded-2xl bg-black border border-slate-700 overflow-hidden flex items-center justify-center h-56 select-none">
                {isPdfFile ? (
                  <iframe title={fileName} src={fileUrl} className="w-full h-full" />
                ) : (
                  <img
                    src={fileUrl}
                    alt="Crop preview"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain transition-transform duration-100"
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                )}

                {/* Studio Guide Frame Overlay */}
                {!isPdfFile && (
                  <div className="absolute inset-4 border-2 border-dashed border-emerald-400/80 rounded pointer-events-none flex flex-col justify-between p-2">
                    <div className="flex justify-between text-[10px] font-mono text-emerald-300 bg-black/60 px-1.5 py-0.5 rounded w-fit">
                      {aspectRatio === '35:45' ? 'পাসপোর্ট (35×45mm)' : aspectRatio === '85:54' ? 'এনআইডি (85×54mm)' : '4R ফটো'}
                    </div>
                    <div className="text-[10px] text-center text-emerald-300 bg-black/50 py-0.5 rounded">
                      মাথা ও চোখের রেখা ফ্রেমের মাঝে রাখুন
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas Controls: Zoom, Rotate */}
              {!isPdfFile && (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setZoom(Math.max(0.8, zoom - 0.1))}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px] px-1">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom(Math.min(2.0, zoom + 0.1))}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => setRotation((rotation + 90) % 360)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ঘুরান ({rotation}°)</span>
                  </button>
                </div>
              )}

              {/* Passport Grid Choice (4-in-1 or 8-in-1) */}
              {selectedService === 'passport_photo' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <span className="font-semibold text-slate-300 block">এক শিটে ছবির সংখ্যা:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGridCount(4)}
                      className={`py-2 px-3 rounded-lg border text-center transition-colors ${
                        gridCount === 4
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      ৪ কপি (৳ {pricing.passport4in1})
                    </button>
                    <button
                      onClick={() => setGridCount(8)}
                      className={`py-2 px-3 rounded-lg border text-center transition-colors ${
                        gridCount === 8
                          ? 'bg-emerald-950 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      ৮ কপি (৳ {pricing.passport8in1})
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  playTapTone();
                  setCurrentStep(4);
                  triggerStepVoice('copies');
                }}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <span>পরের ধাপে যান (কপি ও প্রিভিউ)</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 4: Options, Pricing & Payment */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                    ধাপ ৪ / ৫ · প্রিভিউ ও পেমেন্ট
                  </span>
                  <h3 className="text-sm font-bold text-white">কপি ও বিল যাচাই করুন</h3>
                </div>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← ব্যাক
                </button>
              </div>

              {/* Copies & Color settings */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">কপি সংখ্যা:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCopies(Math.max(1, copies - 1))}
                      className="w-7 h-7 rounded bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="font-mono text-sm font-bold text-white px-2 tabular-nums">
                      {copies}
                    </span>
                    <button
                      onClick={() => setCopies(copies + 1)}
                      className="w-7 h-7 rounded bg-slate-800 border border-slate-700 text-white flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                  <span className="text-slate-300 font-medium">কালার মোড:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setColorMode('color')}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        colorMode === 'color'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      কালার
                    </button>
                    <button
                      onClick={() => setColorMode('bw')}
                      className={`px-2.5 py-1 rounded text-xs transition-colors ${
                        colorMode === 'bw'
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      সাদা-কালো
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                  <span className="text-slate-300 font-medium">পেপার ফিনিশ:</span>
                  <span className="text-emerald-400 font-mono text-[11px]">
                    {paperFinish === 'glossy' ? 'হাই-গ্লসি ফটো পেপার' : 'নরমাল ৮০ জিএসএম'}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 text-xs">
                <span className="font-semibold text-slate-300 block">বিল পরিশোধের মাধ্যম:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('counter_cash')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'counter_cash'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="block font-bold">কাউন্টারে ক্যাশ</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">প্রিন্ট নেয়ার সময় দিন</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('bkash')}
                    className={`p-3 rounded-xl border text-left transition-colors ${
                      paymentMethod === 'bkash'
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="block font-bold">bKash / Nagad</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">অটো ভেরিফায়েড পেইড</span>
                  </button>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">মোট প্রদেয় বিল:</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                    ৳ {calculatePrice()}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-400">
                  <span>ভ্যাট ও সার্ভিস চার্জ অন্তর্ভুক্ত</span>
                </div>
              </div>

              <button
                onClick={handleSubmitOrder}
                disabled={isSubmittingOrder}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-900/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{isSubmittingOrder ? 'ফাইল প্রস্তুত হচ্ছে…' : 'প্রিন্ট নিশ্চিত করুন (টোকেন পান)'}</span>
              </button>
              {fileError && <p role="alert" className="text-xs text-rose-300">{fileError}</p>}
            </div>
          )}

          {/* STEP 5: Token Confirmation Slip (আপনার কোড ৪৫২৭, কাউন্টারে দেখান) */}
          {currentStep === 5 && completedJob && (
            <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <span className="text-xs text-emerald-400 font-semibold tracking-wide uppercase">
                  অর্ডার সফল হয়েছে!
                </span>
                <h3 className="text-lg font-bold text-white">কাউন্টারে এই টোকেনটি দেখান</h3>
              </div>

              {/* Big Token Slip Box */}
              <div className="p-5 rounded-2xl bg-slate-950 border-2 border-emerald-500/80 shadow-2xl space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950 border border-emerald-500/60 text-emerald-400 text-xs font-bold font-mono">
                  <span>📍 {selectedCounter.name}</span>
                </div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block">
                  আপনার প্রিন্ট টোকেন নম্বর
                </span>
                <div className="text-5xl font-black font-mono text-white tracking-widest tabular-nums py-1">
                  #{completedJob.tokenCode}
                </div>

                {/* Counter Pickup Instructions */}
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-left text-xs space-y-1">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span>কাউন্টার অপারেটর:</span>
                    <span className="text-emerald-400 font-bold">{selectedCounter.operator}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    অনুগ্রহ করে এই কাউন্টারে গিয়ে টোকেন <strong>#{completedJob.tokenCode}</strong> বলুন। মূল সার্ভারে লিঙ্কড শেয়ার্ড প্রিন্টারে ফাইল প্রস্তুত হচ্ছে।
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
                  <span>মোট বিল:</span>
                  <span className="font-mono text-base font-bold text-emerald-400 tabular-nums">
                    ৳ {completedJob.price}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>পেমেন্ট স্ট্যাটাস:</span>
                  <span className="text-emerald-400 font-medium">
                    {paymentMethod === 'bkash' ? 'bKash পেইড ✅' : 'কাউন্টারে প্রদেয় (ক্যাশ)'}
                  </span>
                </div>
              </div>

              {/* Privacy Auto-destruction Timer */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-amber-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span className="font-semibold">স্বয়ংক্রিয় গোপনীয়তা সুরক্ষা</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  প্রিন্ট সম্পন্ন হওয়ার ১৫ মিনিট পর আপনার ফাইল সার্ভার ও মেমোরি থেকে সম্পূর্ণ মুছে যাবে।
                </p>
              </div>

              <button
                onClick={() => {
                  playTapTone();
                  setCurrentStep(1);
                  setCompletedJob(null);
                }}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
              >
                নতুন আরেকটি প্রিন্ট করুন
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
