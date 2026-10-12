import { useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import { Check, Languages, Plus, Printer, RotateCcw, Save, Settings as SettingsIcon, Trash2, TriangleAlert } from 'lucide-react';
import { INITIAL_STUDIO_SERVICES } from '../../../shared/services/studioServices';
import { SERVICE_PRESETS, createServiceFromPreset, type ServicePreset } from '../../../shared/services/servicePresets';
import { INITIAL_SERVICE_PRICING } from '../../../shared/services/pricing';
import type { ServicePricing, ShopProfile, StudioService } from '../../../shared/types';
import {
  DEFAULT_APP_SETTINGS,
  isClockTime,
  type AppSettings,
  type BusinessHoursSettings,
  type Weekday,
} from '../../../shared/settings';
import { DEFAULT_LANGUAGE, type Language, type TranslationKey } from '../../../shared/i18n/strings';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { useStudio } from '../../../shared/context/StudioContext';
import { SETTINGS_GROUPS, type SettingsGroupId } from './settingsGroups';

interface SettingsDraft {
  breakMode: boolean;
  notificationSound: boolean;
  serviceAvailability: Record<string, boolean>;
  servicePrices: Record<string, string>;
  voiceGuide: ShopProfile['voiceGuide'];
  autoLaunch: boolean;
  closeToTray: boolean;
  interfaceLanguage: Language;
  appSettings: AppSettings;
}

type DirtyDraftField = keyof SettingsDraft | keyof AppSettings;

const WEEKDAYS: readonly { id: Weekday; labelKey: TranslationKey }[] = [
  { id: 'monday', labelKey: 'settings.day.monday' },
  { id: 'tuesday', labelKey: 'settings.day.tuesday' },
  { id: 'wednesday', labelKey: 'settings.day.wednesday' },
  { id: 'thursday', labelKey: 'settings.day.thursday' },
  { id: 'friday', labelKey: 'settings.day.friday' },
  { id: 'saturday', labelKey: 'settings.day.saturday' },
  { id: 'sunday', labelKey: 'settings.day.sunday' },
];

const PRICING_SETTINGS = [
  ['passport4in1', 'settings.price.passport4'],
  ['passport8in1', 'settings.price.passport8'],
  ['stampPhoto', 'settings.price.stamp'],
  ['nidSmartCard', 'settings.price.nidSmart'],
  ['nidNormalA4', 'settings.price.nidNormal'],
  ['photo4R', 'settings.price.photo4R'],
  ['photo6R', 'settings.price.photo6R'],
  ['docA4BW', 'settings.price.documentBw'],
  ['docA4Color', 'settings.price.documentColor'],
] as const satisfies readonly (readonly [keyof ServicePricing, TranslationKey])[];

const createDraft = (
  profile: ShopProfile,
  services: StudioService[],
  pricing: ServicePricing,
  autoLaunch: boolean,
  closeToTray: boolean,
  language: Language,
  appSettings: AppSettings,
): SettingsDraft => ({
  breakMode: profile.isDndMode,
  notificationSound: profile.soundAlertEnabled,
  serviceAvailability: Object.fromEntries(services.map(service => [service.id, service.enabled])),
  servicePrices: Object.fromEntries(Object.entries(pricing).map(([key, price]) => [key, String(price)])),
  voiceGuide: { ...profile.voiceGuide },
  autoLaunch,
  closeToTray,
  interfaceLanguage: language,
  appSettings,
});

const DEFAULT_VOICE_GUIDE: ShopProfile['voiceGuide'] = {
  enabled: true,
  defaultLang: 'bn',
  defaultSpeed: 1,
};

interface SettingsPageProps {
  onOpenPrinterSettings: () => void;
}

export const SettingsPage: FC<SettingsPageProps> = ({ onOpenPrinterSettings }) => {
  const { t, language, setLanguage } = useI18n();
  const {
    isMaster,
    appSettings,
    appSettingsLoaded,
    appSettingsError,
    saveAppSettings,
    shopProfile,
    updateShopProfile,
    services,
    pricing,
    updatePricing,
    toggleStudioService,
    updateStudioService,
    createStudioService,
    deleteStudioService,
  } = useStudio();
  const appSettingsAvailable = Boolean(window.alifShohojPrintDesktop) && appSettingsLoaded && !appSettingsError;
  const [activeGroup, setActiveGroup] = useState<SettingsGroupId>('shopOrders');
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [autoLaunchAvailable, setAutoLaunchAvailable] = useState(false);
  const [closeToTray, setCloseToTray] = useState(true);
  const [closeToTrayAvailable, setCloseToTrayAvailable] = useState(false);
  const [draft, setDraft] = useState(() => createDraft(shopProfile, services, pricing, false, true, language, appSettings));
  const dirtyDraftFields = useRef(new Set<DirtyDraftField>());
  const dirtyAutoApproval = useRef(new Set<string>());
  const [autoApprovalDraft, setAutoApprovalDraft] = useState<Record<string, boolean>>(
    () => Object.fromEntries(services.map(service => [service.id, service.autoApprove]))
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const refreshed = createDraft(shopProfile, services, pricing, autoLaunch, closeToTray, language, appSettings);
    setDraft(previous => ({
      ...refreshed,
      appSettings: {
        businessHours: dirtyDraftFields.current.has('businessHours') ? previous.appSettings.businessHours : refreshed.appSettings.businessHours,
        orderLimits: dirtyDraftFields.current.has('orderLimits') ? previous.appSettings.orderLimits : refreshed.appSettings.orderLimits,
        approvals: dirtyDraftFields.current.has('approvals') ? previous.appSettings.approvals : refreshed.appSettings.approvals,
        notifications: dirtyDraftFields.current.has('notifications') ? previous.appSettings.notifications : refreshed.appSettings.notifications,
        printer: dirtyDraftFields.current.has('printer') ? previous.appSettings.printer : refreshed.appSettings.printer,
        retention: dirtyDraftFields.current.has('retention') ? previous.appSettings.retention : refreshed.appSettings.retention,
        previewWatermarkEnabled: dirtyDraftFields.current.has('previewWatermarkEnabled')
          ? previous.appSettings.previewWatermarkEnabled
          : refreshed.appSettings.previewWatermarkEnabled,
      },
      ...(dirtyDraftFields.current.has('breakMode') ? { breakMode: previous.breakMode } : {}),
      ...(dirtyDraftFields.current.has('notificationSound') ? { notificationSound: previous.notificationSound } : {}),
      ...(dirtyDraftFields.current.has('serviceAvailability') ? { serviceAvailability: previous.serviceAvailability } : {}),
      ...(dirtyDraftFields.current.has('servicePrices') ? { servicePrices: previous.servicePrices } : {}),
      ...(dirtyDraftFields.current.has('voiceGuide') ? { voiceGuide: previous.voiceGuide } : {}),
      ...(dirtyDraftFields.current.has('autoLaunch') ? { autoLaunch: previous.autoLaunch } : {}),
      ...(dirtyDraftFields.current.has('closeToTray') ? { closeToTray: previous.closeToTray } : {}),
      ...(dirtyDraftFields.current.has('interfaceLanguage') ? { interfaceLanguage: previous.interfaceLanguage } : {}),
    }));
  }, [shopProfile, services, pricing, autoLaunch, closeToTray, language, appSettings]);

  useEffect(() => {
    setAutoApprovalDraft(previous => Object.fromEntries(services.map(service => [
      service.id,
      dirtyAutoApproval.current.has(service.id)
        ? previous[service.id] ?? service.autoApprove
        : service.autoApprove,
    ])));
  }, [services]);

  useEffect(() => {
    const desktop = window.alifShohojPrintDesktop;
    if (!desktop) return;
    let active = true;
    void desktop.getAutoLaunch().then(enabled => {
      if (!active) return;
      setAutoLaunch(enabled);
      setAutoLaunchAvailable(true);
    }).catch(loadError => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    });
    void desktop.getCloseToTray().then(enabled => {
      if (!active) return;
      setCloseToTray(enabled);
      setCloseToTrayAvailable(true);
    }).catch(loadError => {
      if (!active) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    });
    return () => {
      active = false;
    };
  }, []);

  const activeDefinition = SETTINGS_GROUPS.find(group => group.id === activeGroup) ?? SETTINGS_GROUPS[0];
  const setDraftValue = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    dirtyDraftFields.current.add(key);
    setDraft(previous => ({ ...previous, [key]: value }));
    setError(null);
    setSaved(false);
  };
  const setAppSettingsValue = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    dirtyDraftFields.current.add(key);
    setDraft(previous => ({ ...previous, appSettings: { ...previous.appSettings, [key]: value } }));
    setError(null);
    setSaved(false);
  };
  const saveOperationalSettings = async (settings: AppSettings) => {
    if (!appSettingsAvailable) throw new Error(t('settings.desktopOnlyUnavailable'));
    await saveAppSettings(settings);
  };

  const resetActiveGroup = () => {
    setError(null);
    setSaved(false);
    if (activeGroup === 'approval') {
      dirtyAutoApproval.current = new Set(services.map(service => service.id));
      setAutoApprovalDraft(Object.fromEntries(services.map(service => [
        service.id,
        INITIAL_STUDIO_SERVICES.find(initial => initial.id === service.id)?.autoApprove ?? service.autoApprove,
      ])));
      return;
    }
    switch (activeGroup) {
      case 'shopOrders':
        dirtyDraftFields.current.add('breakMode');
        dirtyDraftFields.current.add('businessHours');
        break;
      case 'services':
        dirtyDraftFields.current.add('serviceAvailability');
        dirtyDraftFields.current.add('servicePrices');
        break;
      case 'notifications':
        dirtyDraftFields.current.add('notificationSound');
        break;
      case 'voiceGuide':
        dirtyDraftFields.current.add('voiceGuide');
        break;
      case 'agent':
        dirtyDraftFields.current.add('autoLaunch');
        dirtyDraftFields.current.add('closeToTray');
        dirtyDraftFields.current.add('interfaceLanguage');
        break;
    }
    setDraft(previous => {
      switch (activeGroup) {
        case 'shopOrders':
          return {
            ...previous,
            breakMode: false,
            appSettings: { ...previous.appSettings, businessHours: DEFAULT_APP_SETTINGS.businessHours },
          };
        case 'services':
          return {
            ...previous,
            serviceAvailability: Object.fromEntries(services.map(service => [
              service.id,
              INITIAL_STUDIO_SERVICES.find(initial => initial.id === service.id)?.enabled ?? service.enabled,
            ])),
            servicePrices: Object.fromEntries(Object.entries(INITIAL_SERVICE_PRICING).map(([key, price]) => [key, String(price)])),
          };
        case 'notifications':
          return { ...previous, notificationSound: true };
        case 'voiceGuide':
          return { ...previous, voiceGuide: { ...DEFAULT_VOICE_GUIDE } };
        case 'agent':
          return { ...previous, autoLaunch: false, closeToTray: true, interfaceLanguage: DEFAULT_LANGUAGE };
        default:
          return previous;
      }
    });
  };

  const saveActiveGroup = async () => {
    setError(null);
    setSaved(false);
    try {
      switch (activeGroup) {
        case 'shopOrders': {
          updateShopProfile({ isDndMode: draft.breakMode });
          if (dirtyDraftFields.current.has('businessHours')) {
            const businessHours = draft.appSettings.businessHours;
            if (!isClockTime(businessHours.openTime) || !isClockTime(businessHours.closeTime)) {
              throw new Error(t('settings.invalidTime'));
            }
            if (businessHours.enabled && businessHours.daysOfWeek.length === 0) {
              throw new Error(t('settings.businessHoursDaysRequired'));
            }
            await saveOperationalSettings({ ...draft.appSettings, businessHours });
            dirtyDraftFields.current.delete('businessHours');
          }
          break;
        }
        case 'services':
          if (!isMaster) throw new Error(t('settings.masterOnly'));
          const nextPricing: Partial<ServicePricing> = {};
          for (const [key, labelKey] of PRICING_SETTINGS) {
            const price = Number(draft.servicePrices[key]);
            if (!Number.isFinite(price) || price < 0) {
              throw new Error(t('settings.invalidPrice', { service: t(labelKey) }));
            }
            nextPricing[key] = price;
          }
          updatePricing(nextPricing);
          for (const service of services) {
            if (service.enabled !== draft.serviceAvailability[service.id] && !toggleStudioService(service.id)) {
              throw new Error(t('settings.saveFailed'));
            }
          }
          break;
        case 'approval':
          if (!isMaster) throw new Error(t('settings.masterOnly'));
          for (const service of services) {
            const autoApprove = autoApprovalDraft[service.id] ?? service.autoApprove;
            if (service.autoApprove !== autoApprove && !updateStudioService(service.id, { autoApprove })) {
              throw new Error(t('settings.saveFailed'));
            }
          }
          dirtyAutoApproval.current.clear();
          break;
        case 'notifications':
          updateShopProfile({ soundAlertEnabled: draft.notificationSound });
          break;
        case 'voiceGuide':
          updateShopProfile({ voiceGuide: { ...draft.voiceGuide } });
          break;
        case 'agent': {
          const desktop = window.alifShohojPrintDesktop;
          if (closeToTrayAvailable) {
            if (!desktop) throw new Error(t('settings.saveFailed'));
            const actual = await desktop.setCloseToTray(draft.closeToTray);
            if (actual !== draft.closeToTray) throw new Error(t('settings.saveFailed'));
            setCloseToTray(actual);
          }
          if (autoLaunchAvailable) {
            if (!desktop) throw new Error(t('settings.autoLaunchUnavailable'));
            const actual = await desktop.setAutoLaunch(draft.autoLaunch);
            if (actual !== draft.autoLaunch) throw new Error(t('settings.saveFailed'));
            setAutoLaunch(actual);
          }
          setLanguage(draft.interfaceLanguage);
          break;
        }
        default:
          return;
      }
      switch (activeGroup) {
        case 'shopOrders':
          dirtyDraftFields.current.delete('breakMode');
          break;
        case 'services':
          dirtyDraftFields.current.delete('serviceAvailability');
          dirtyDraftFields.current.delete('servicePrices');
          break;
        case 'notifications':
          dirtyDraftFields.current.delete('notificationSound');
          break;
        case 'voiceGuide':
          dirtyDraftFields.current.delete('voiceGuide');
          break;
        case 'agent':
          dirtyDraftFields.current.delete('autoLaunch');
          dirtyDraftFields.current.delete('closeToTray');
          dirtyDraftFields.current.delete('interfaceLanguage');
          break;
      }
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  };

  const canSave = activeGroup === 'shopOrders' ||
    (activeGroup === 'approval' && isMaster) ||
    activeGroup === 'notifications' ||
    activeGroup === 'voiceGuide' ||
    (activeGroup === 'services' && isMaster) ||
    activeGroup === 'agent';
  const canReset = activeGroup === 'shopOrders' ||
    activeGroup === 'approval' ||
    activeGroup === 'services' ||
    activeGroup === 'notifications' ||
    activeGroup === 'voiceGuide' ||
    activeGroup === 'agent';

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border-secondary bg-surface px-5 py-3">
        <SettingsIcon className="h-4 w-4 text-brand" />
        <h2 className="text-sm font-bold text-text-primary">{t('nav.settings')}</h2>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label={t('settings.groups')} className="w-56 shrink-0 overflow-y-auto border-r border-border-secondary bg-surface p-3">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-text-tertiary">{t('settings.groups')}</p>
          <div className="space-y-1">
            {SETTINGS_GROUPS.map(group => (
              <button
                key={group.id}
                type="button"
                aria-current={activeGroup === group.id ? 'page' : undefined}
                onClick={() => {
                  setActiveGroup(group.id);
                  setError(null);
                  setSaved(false);
                }}
                className={`w-full rounded-lg px-3 py-2 text-left text-xs font-semibold transition-colors ${
                  activeGroup === group.id
                    ? 'bg-brand text-on-brand'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                {t(group.labelKey)}
              </button>
            ))}
          </div>
        </nav>

        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4">
              <h1 className="text-lg font-bold text-text-primary">{t(activeDefinition.labelKey)}</h1>
              <p className="mt-1 text-xs text-text-secondary">{t('settings.subtitle')}</p>
            </div>

            <section className="overflow-hidden rounded-xl border border-border-primary bg-surface">
              {activeDefinition.items.map(item => (
                <div key={item.id} className="border-b border-border-secondary last:border-b-0">
                  {item.status === 'comingSoon' ? (
                    <SettingRow
                      title={t(item.labelKey)}
                      trailing={<span className="rounded-full bg-bg-secondary px-2 py-1 text-[10px] font-semibold text-text-tertiary">{t('settings.comingSoon')}</span>}
                    />
                  ) : item.status === 'required' ? (
                    <SettingRow
                      title={t(item.labelKey)}
                      trailing={<span className="text-[11px] font-semibold text-success">{t('settings.alwaysOn')}</span>}
                    />
                  ) : (
                    <SupportedSetting
                      id={item.id}
                      draft={draft}
                      services={services}
                      isMaster={isMaster}
                      autoApprovalDraft={autoApprovalDraft}
                      pricingKeys={PRICING_SETTINGS}
                      autoLaunchAvailable={autoLaunchAvailable}
                      closeToTrayAvailable={closeToTrayAvailable}
                      appSettingsAvailable={appSettingsAvailable}
                      onDraftChange={setDraftValue}
                      onBusinessHoursChange={businessHours => setAppSettingsValue('businessHours', businessHours)}
                      onOpenPrinterSettings={onOpenPrinterSettings}
                      onLanguageChange={nextLanguage => setDraftValue('interfaceLanguage', nextLanguage)}
                      onServiceAvailabilityChange={(serviceId, enabled) => {
                        dirtyDraftFields.current.add('serviceAvailability');
                        setDraft(previous => ({
                          ...previous,
                          serviceAvailability: { ...previous.serviceAvailability, [serviceId]: enabled },
                        }));
                      }}
                      onServicePriceChange={(priceKey, value) => {
                        dirtyDraftFields.current.add('servicePrices');
                        setDraft(previous => ({
                          ...previous,
                          servicePrices: { ...previous.servicePrices, [priceKey]: value },
                        }));
                      }}
                      onAutoApprovalChange={(serviceId, enabled) => {
                        dirtyAutoApproval.current.add(serviceId);
                        setAutoApprovalDraft(previous => ({ ...previous, [serviceId]: enabled }));
                        setError(null);
                        setSaved(false);
                      }}
                      onCreateServiceFromPreset={createStudioService}
                      onDeleteService={deleteStudioService}
                      t={t}
                    />
                  )}
                </div>
              ))}
              {(activeGroup === 'services' || activeGroup === 'approval') && !isMaster && (
                <p className="border-t border-border-secondary px-4 py-3 text-xs text-warning">{t('settings.masterOnly')}</p>
              )}
              {activeGroup === 'agent' && (!autoLaunchAvailable || !closeToTrayAvailable) && (
                <p className="border-t border-border-secondary px-4 py-3 text-xs text-text-secondary">{t('settings.desktopOnlyUnavailable')}</p>
              )}
              {activeGroup === 'shopOrders' && !appSettingsAvailable && (
                <p className="border-t border-border-secondary px-4 py-3 text-xs text-text-secondary">{t('settings.desktopOnlyUnavailable')}</p>
              )}
              {activeGroup === 'payments' && (
                <p className="border-t border-border-secondary px-4 py-3 text-xs text-text-secondary">{t('settings.paymentsFutureVersion')}</p>
              )}
            </section>

            {error && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-error bg-error-bg px-3 py-2.5 text-xs text-error">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="mt-3 flex items-center gap-2 rounded-lg border border-success/30 bg-success-bg px-3 py-2.5 text-xs font-semibold text-success">
                <Check className="h-4 w-4" />
                {t('settings.saved')}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={resetActiveGroup}
                disabled={!canReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border-primary bg-surface px-3 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t('settings.reset')}
              </button>
              <button
                type="button"
                onClick={() => void saveActiveGroup()}
                disabled={!canSave}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {t('settings.save')}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

interface SettingRowProps {
  title: string;
  description?: string;
  trailing: ReactNode;
}

const SettingRow: FC<SettingRowProps> = ({ title, description, trailing }) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3">
    <div>
      <h3 className="text-xs font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-1 text-[11px] text-text-secondary">{description}</p>}
    </div>
    {trailing}
  </div>
);

interface SupportedSettingProps {
  id: string;
  draft: SettingsDraft;
  services: StudioService[];
  isMaster: boolean;
  autoApprovalDraft: Record<string, boolean>;
  pricingKeys: typeof PRICING_SETTINGS;
  autoLaunchAvailable: boolean;
  closeToTrayAvailable: boolean;
  appSettingsAvailable: boolean;
  onDraftChange: <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => void;
  onBusinessHoursChange: (businessHours: BusinessHoursSettings) => void;
  onOpenPrinterSettings: () => void;
  onLanguageChange: (language: Language) => void;
  onServiceAvailabilityChange: (serviceId: string, enabled: boolean) => void;
  onServicePriceChange: (priceKey: keyof ServicePricing, value: string) => void;
  onAutoApprovalChange: (serviceId: string, enabled: boolean) => void;
  onCreateServiceFromPreset: (service: Omit<StudioService, 'id' | 'isCustom'>) => boolean;
  onDeleteService: (serviceId: string) => boolean;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const SupportedSetting: FC<SupportedSettingProps> = ({
  id,
  draft,
  services,
  isMaster,
  autoApprovalDraft,
  pricingKeys,
  autoLaunchAvailable,
  closeToTrayAvailable,
  appSettingsAvailable,
  onDraftChange,
  onBusinessHoursChange,
  onOpenPrinterSettings,
  onLanguageChange,
  onServiceAvailabilityChange,
  onServicePriceChange,
  onAutoApprovalChange,
  onCreateServiceFromPreset,
  onDeleteService,
  t,
}) => {
  if (id === 'breakMode') {
    return <SettingRow title={t('settings.breakMode')} trailing={<Toggle checked={draft.breakMode} label={t('settings.breakMode')} onChange={value => onDraftChange('breakMode', value)} />} />;
  }
  if (id === 'acceptingOrders') {
    return <SettingRow title={t('settings.acceptingOrders')} trailing={<Toggle checked={!draft.breakMode} label={t('settings.acceptingOrders')} onChange={value => onDraftChange('breakMode', !value)} />} />;
  }
  if (id === 'businessHours') {
    const businessHours = draft.appSettings.businessHours;
    const disabled = !appSettingsAvailable;
    const setBusinessHours = (updates: Partial<BusinessHoursSettings>) =>
      onBusinessHoursChange({ ...businessHours, ...updates });
    const timeInputClass = 'w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary disabled:cursor-not-allowed disabled:opacity-50';
    return (
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xs font-semibold text-text-primary">{t('settings.businessHours')}</h3>
          <Toggle
            checked={businessHours.enabled}
            label={t('settings.businessHoursEnabled')}
            disabled={disabled}
            onChange={enabled => setBusinessHours({ enabled })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-[11px] text-text-secondary">
            {t('settings.businessHoursOpen')}
            <input
              type="time"
              aria-label={t('settings.businessHoursOpen')}
              value={businessHours.openTime}
              disabled={disabled}
              onChange={event => setBusinessHours({ openTime: event.currentTarget.value })}
              className={timeInputClass}
            />
          </label>
          <label className="space-y-1 text-[11px] text-text-secondary">
            {t('settings.businessHoursClose')}
            <input
              type="time"
              aria-label={t('settings.businessHoursClose')}
              value={businessHours.closeTime}
              disabled={disabled}
              onChange={event => setBusinessHours({ closeTime: event.currentTarget.value })}
              className={timeInputClass}
            />
          </label>
        </div>
        <div className="space-y-1.5">
          <span className="text-[11px] text-text-secondary">{t('settings.businessHoursDays')}</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map(day => {
              const selected = businessHours.daysOfWeek.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={t(day.labelKey)}
                  disabled={disabled}
                  onClick={() => setBusinessHours({
                    daysOfWeek: WEEKDAYS.map(entry => entry.id).filter(entry =>
                      entry === day.id ? !selected : businessHours.daysOfWeek.includes(entry)
                    ),
                  })}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? 'border-brand bg-brand text-on-brand'
                      : 'border-border-primary bg-bg-primary text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  {t(day.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
        <p className="text-[11px] text-text-tertiary">
          {t('settings.businessHoursTimezone')} · {t('settings.businessHoursOvernight')}
        </p>
        {!businessHours.enabled && (
          <p className="text-[11px] text-text-secondary">{t('settings.businessHoursOff')}</p>
        )}
      </div>
    );
  }
  if (id === 'serviceAvailability') {
    return (
      <div className="space-y-1 px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold text-text-primary">{t('settings.serviceAvailability')}</h3>
        {services.map(service => (
          <div key={service.id} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-bg-secondary">
            <span className="text-xs text-text-primary">{service.titleBn}</span>
            <Toggle
              checked={draft.serviceAvailability[service.id] ?? service.enabled}
              label={service.titleBn}
              onChange={value => onServiceAvailabilityChange(service.id, value)}
            />
          </div>
        ))}
      </div>
    );
  }
  if (id === 'servicePricing') {
    return (
      <div className="space-y-1 px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold text-text-primary">{t('settings.servicePricing')}</h3>
        {pricingKeys.map(([priceKey, labelKey]) => (
          <label key={priceKey} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-bg-secondary">
            <span className="text-xs text-text-primary">{t(labelKey)}</span>
            <span className="flex items-center gap-2 text-xs text-text-secondary">
              ৳
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                aria-label={t('settings.priceFor', { service: t(labelKey) })}
                value={draft.servicePrices[priceKey] ?? ''}
                onChange={event => onServicePriceChange(priceKey, event.currentTarget.value)}
                className="w-24 rounded-md border border-border-primary bg-bg-primary px-2 py-1 text-right text-xs text-text-primary"
              />
            </span>
          </label>
        ))}
      </div>
    );
  }
  if (id === 'autoApproval') {
    return (
      <div className="space-y-1 px-4 py-3">
        <h3 className="mb-2 text-xs font-semibold text-text-primary">{t('settings.autoApproval')}</h3>
        {services.map(service => (
          <div key={service.id} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-bg-secondary">
            <span className="text-xs text-text-primary">{service.titleBn}</span>
            <Toggle
              checked={autoApprovalDraft[service.id] ?? service.autoApprove}
              label={t('settings.autoApprovalFor', { service: service.titleBn })}
              disabled={!isMaster}
              onChange={value => onAutoApprovalChange(service.id, value)}
            />
          </div>
        ))}
      </div>
    );
  }
  if (id === 'serviceManagement') {
    if (!isMaster) {
      return <p className="px-4 py-3 text-xs text-warning">{t('settings.masterOnly')}</p>;
    }
    return (
      <ServiceManagement
        services={services}
        onCreateServiceFromPreset={onCreateServiceFromPreset}
        onDeleteService={onDeleteService}
        t={t}
      />
    );
  }
  if (id === 'notificationSound') {
    return <SettingRow title={t('settings.notificationSound')} trailing={<Toggle checked={draft.notificationSound} label={t('settings.notificationSound')} onChange={value => onDraftChange('notificationSound', value)} />} />;
  }
  if (id === 'printerSelection') {
    return (
      <SettingRow
        title={t('settings.printerSelection')}
        trailing={
          <button type="button" onClick={onOpenPrinterSettings} className="inline-flex items-center gap-1.5 rounded-md border border-border-primary px-2.5 py-1.5 text-[11px] font-semibold text-text-primary hover:bg-surface-hover">
            <Printer className="h-3.5 w-3.5" />
            {t('settings.managePrinters')}
          </button>
        }
      />
    );
  }
  if (id === 'voiceGuidePreferences') {
    return (
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xs font-semibold text-text-primary">{t('settings.voiceGuidePreferences')}</h3>
          <Toggle checked={draft.voiceGuide.enabled} label={t('settings.voiceGuideEnabled')} onChange={value => onDraftChange('voiceGuide', { ...draft.voiceGuide, enabled: value })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-[11px] text-text-secondary">
            {t('settings.voiceLanguage')}
            <select
              value={draft.voiceGuide.defaultLang}
              onChange={event => onDraftChange('voiceGuide', { ...draft.voiceGuide, defaultLang: event.currentTarget.value === 'en' ? 'en' : 'bn' })}
              className="w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="bn">{t('language.bengali')}</option>
              <option value="en">{t('language.english')}</option>
            </select>
          </label>
          <label className="space-y-1 text-[11px] text-text-secondary">
            {t('settings.voiceSpeed')}
            <select
              value={String(draft.voiceGuide.defaultSpeed)}
              onChange={event => {
                const speed = Number(event.currentTarget.value);
                if (speed === 0.8 || speed === 1 || speed === 1.25) {
                  onDraftChange('voiceGuide', { ...draft.voiceGuide, defaultSpeed: speed });
                }
              }}
              className="w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="0.8">0.8×</option>
              <option value="1">1×</option>
              <option value="1.25">1.25×</option>
            </select>
          </label>
        </div>
      </div>
    );
  }
  if (id === 'voiceCommands') {
    return (
      <SettingRow
        title={t('settings.voiceCommands')}
        description={t('settings.voiceCommandsHint')}
        trailing={<span className="text-[11px] font-semibold text-success">{t('settings.alwaysOn')}</span>}
      />
    );
  }
  if (id === 'autoLaunch') {
    return <SettingRow title={t('settings.autoLaunch')} trailing={<Toggle checked={draft.autoLaunch} label={t('settings.autoLaunch')} disabled={!autoLaunchAvailable} onChange={value => onDraftChange('autoLaunch', value)} />} />;
  }
  if (id === 'minimizeToTray') {
    return <SettingRow title={t('settings.minimizeToTray')} trailing={<Toggle checked={draft.closeToTray} label={t('settings.minimizeToTray')} disabled={!closeToTrayAvailable} onChange={value => onDraftChange('closeToTray', value)} />} />;
  }
  if (id === 'interfaceLanguage') {
    return (
      <SettingRow
        title={t('settings.interfaceLanguage')}
        trailing={
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <Languages className="h-3.5 w-3.5" />
            <select
              value={draft.interfaceLanguage}
              onChange={event => onLanguageChange(event.currentTarget.value === 'bn' ? 'bn' : 'en')}
              className="rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="en">{t('language.english')}</option>
              <option value="bn">{t('language.bengali')}</option>
            </select>
          </label>
        }
      />
    );
  }
  return <SettingRow title={t('settings.unsupported')} trailing={<span className="text-[10px] text-text-tertiary">{t('settings.comingSoon')}</span>} />;
};

interface ServiceManagementProps {
  services: StudioService[];
  onCreateServiceFromPreset: (service: Omit<StudioService, 'id' | 'isCustom'>) => boolean;
  onDeleteService: (serviceId: string) => boolean;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

/**
 * Service management: shopkeepers add services from the shared preset catalog
 * and delete the ones they no longer offer. Add/delete apply immediately
 * (unlike the draft-based rows in this panel) because they change the POS and
 * customer order flow, not a saved setting.
 */
const ServiceManagement: FC<ServiceManagementProps> = ({
  services,
  onCreateServiceFromPreset,
  onDeleteService,
  t,
}) => {
  const [presetCode, setPresetCode] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  const handleAdd = () => {
    const preset = SERVICE_PRESETS.find(item => item.code === presetCode);
    if (!preset) return;
    const created = onCreateServiceFromPreset(createServiceFromPreset(preset));
    setMessage(created
      ? { kind: 'success', text: t('settings.serviceManagement.added') }
      : { kind: 'error', text: t('settings.serviceManagement.addFailed') });
    if (created) setPresetCode('');
  };

  const handleDelete = (serviceId: string) => {
    if (confirmingDeleteId !== serviceId) {
      setConfirmingDeleteId(serviceId);
      setMessage(null);
      return;
    }
    setConfirmingDeleteId(null);
    const deleted = onDeleteService(serviceId);
    setMessage(deleted
      ? { kind: 'success', text: t('settings.serviceManagement.deleted') }
      : { kind: 'error', text: services.length <= 1 ? t('settings.serviceManagement.keepOne') : t('settings.serviceManagement.deleteFailed') });
  };

  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs font-semibold text-text-primary">{t('settings.serviceManagement')}</h3>
        <span className="text-[10px] text-text-tertiary">{t('settings.serviceManagement.immediateNote')}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('settings.serviceManagement.addFromPreset')}
          value={presetCode}
          onChange={event => {
            setPresetCode(event.currentTarget.value);
            setMessage(null);
          }}
          className="rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary"
        >
          <option value="">{t('settings.serviceManagement.presetPlaceholder')}</option>
          {SERVICE_PRESETS.map(preset => (
            <option key={preset.code} value={preset.code}>
              {preset.icon} {preset.titleBn} — ৳{preset.basePriceBDT}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!presetCode}
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {t('settings.serviceManagement.add')}
        </button>
      </div>

      <div className="space-y-1">
        <h4 className="text-[11px] font-semibold text-text-secondary">{t('settings.serviceManagement.currentServices')}</h4>
        {services.map(service => (
          <div key={service.id} className="flex items-center justify-between gap-4 rounded-md px-2 py-2 hover:bg-bg-secondary">
            <span className="min-w-0 text-xs text-text-primary">
              <span className="mr-1.5">{service.icon}</span>
              {service.titleBn}
              <span className="ml-2 text-[10px] text-text-tertiary">{service.code} · ৳{service.basePriceBDT}</span>
            </span>
            {confirmingDeleteId === service.id ? (
              <button
                type="button"
                onClick={() => handleDelete(service.id)}
                className="shrink-0 rounded-md border border-error bg-error-bg px-2.5 py-1 text-[11px] font-semibold text-error hover:opacity-80"
              >
                {t('settings.serviceManagement.confirmDelete')}
              </button>
            ) : (
              <button
                type="button"
                aria-label={`${t('settings.serviceManagement.delete')} ${service.titleBn}`}
                disabled={services.length <= 1}
                title={services.length <= 1 ? t('settings.serviceManagement.keepOne') : undefined}
                onClick={() => handleDelete(service.id)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border-primary px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:bg-surface-hover hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                {t('settings.serviceManagement.delete')}
              </button>
            )}
          </div>
        ))}
      </div>

      {message && (
        <p role="status" className={`text-[11px] font-semibold ${message.kind === 'success' ? 'text-success' : 'text-error'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
};

interface ToggleProps {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

const Toggle: FC<ToggleProps> = ({ checked, label, disabled = false, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-5 w-9 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-brand' : 'bg-border-primary'}`}
  >
    <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
  </button>
);
