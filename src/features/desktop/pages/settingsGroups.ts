import type { TranslationKey } from '../../../shared/i18n/strings';

export type SettingsGroupId =
  | 'shopOrders'
  | 'services'
  | 'approval'
  | 'notifications'
  | 'printers'
  | 'voiceGuide'
  | 'payments'
  | 'security'
  | 'staff'
  | 'agent'
  | 'customize';

export interface SettingsGroupItem {
  id: string;
  labelKey: TranslationKey;
  status: 'supported' | 'comingSoon' | 'required';
}

export interface SettingsGroupDefinition {
  id: SettingsGroupId;
  labelKey: TranslationKey;
  items: readonly SettingsGroupItem[];
}

export const SETTINGS_GROUPS: readonly SettingsGroupDefinition[] = [
  {
    id: 'shopOrders',
    labelKey: 'settings.group.shopOrders',
    items: [
      { id: 'breakMode', labelKey: 'settings.breakMode', status: 'supported' },
      { id: 'acceptingOrders', labelKey: 'settings.acceptingOrders', status: 'supported' },
      { id: 'businessHours', labelKey: 'settings.businessHours', status: 'supported' },
      { id: 'orderLimits', labelKey: 'settings.orderLimits', status: 'supported' },
    ],
  },
  {
    id: 'services',
    labelKey: 'settings.group.services',
    items: [
      { id: 'serviceAvailability', labelKey: 'settings.serviceAvailability', status: 'supported' },
      { id: 'servicePricing', labelKey: 'settings.servicePricing', status: 'supported' },
      { id: 'serviceManagement', labelKey: 'settings.serviceManagement', status: 'supported' },
    ],
  },
  {
    id: 'approval',
    labelKey: 'settings.group.approval',
    items: [
      { id: 'manualApproval', labelKey: 'settings.manualApproval', status: 'comingSoon' },
      { id: 'autoApproval', labelKey: 'settings.autoApproval', status: 'supported' },
      { id: 'orderEditing', labelKey: 'settings.orderEditing', status: 'comingSoon' },
      { id: 'priceConfirmation', labelKey: 'settings.priceConfirmation', status: 'comingSoon' },
      { id: 'approvalTimeout', labelKey: 'settings.approvalTimeout', status: 'comingSoon' },
    ],
  },
  {
    id: 'notifications',
    labelKey: 'settings.group.notifications',
    items: [
      { id: 'notificationSound', labelKey: 'settings.notificationSound', status: 'supported' },
      { id: 'windowsToast', labelKey: 'settings.windowsToast', status: 'supported' },
      { id: 'soundVolume', labelKey: 'settings.soundVolume', status: 'supported' },
      { id: 'orderReminder', labelKey: 'settings.orderReminder', status: 'supported' },
      { id: 'doNotDisturbSchedule', labelKey: 'settings.doNotDisturbSchedule', status: 'supported' },
    ],
  },
  {
    id: 'printers',
    labelKey: 'settings.group.printers',
    items: [
      { id: 'printerSelection', labelKey: 'settings.printerSelection', status: 'supported' },
      { id: 'printerRouting', labelKey: 'settings.printerRouting', status: 'supported' },
      { id: 'fallbackPrinter', labelKey: 'settings.fallbackPrinter', status: 'supported' },
      { id: 'printerAlerts', labelKey: 'settings.printerAlerts', status: 'supported' },
    ],
  },
  {
    id: 'voiceGuide',
    labelKey: 'settings.group.voiceGuide',
    items: [
      { id: 'voiceGuidePreferences', labelKey: 'settings.voiceGuidePreferences', status: 'supported' },
      { id: 'customVoice', labelKey: 'settings.customVoice', status: 'comingSoon' },
      { id: 'voiceCommands', labelKey: 'settings.voiceCommands', status: 'supported' },
    ],
  },
  {
    id: 'payments',
    labelKey: 'settings.group.payments',
    items: [
      { id: 'counterPayment', labelKey: 'settings.counterPayment', status: 'required' },
      { id: 'paymentMethods', labelKey: 'settings.paymentMethods', status: 'comingSoon' },
      { id: 'automaticRefund', labelKey: 'settings.automaticRefund', status: 'comingSoon' },
    ],
  },
  {
    id: 'security',
    labelKey: 'settings.group.security',
    items: [
      { id: 'automaticDeletion', labelKey: 'settings.automaticDeletion', status: 'supported' },
      { id: 'previewWatermark', labelKey: 'settings.previewWatermark', status: 'supported' },
      { id: 'staffPin', labelKey: 'settings.staffPin', status: 'comingSoon' },
      { id: 'auditLogStatus', labelKey: 'settings.auditLogRequired', status: 'required' },
    ],
  },
  {
    id: 'staff',
    labelKey: 'settings.group.staff',
    items: [
      { id: 'staffAccounts', labelKey: 'settings.staffAccounts', status: 'comingSoon' },
      { id: 'staffRoles', labelKey: 'settings.staffRoles', status: 'comingSoon' },
      { id: 'jobLock', labelKey: 'settings.jobLock', status: 'comingSoon' },
    ],
  },
  {
    id: 'agent',
    labelKey: 'settings.group.agent',
    items: [
      { id: 'autoLaunch', labelKey: 'settings.autoLaunch', status: 'supported' },
      { id: 'minimizeToTray', labelKey: 'settings.minimizeToTray', status: 'supported' },
      { id: 'automaticUpdates', labelKey: 'settings.automaticUpdates', status: 'comingSoon' },
      { id: 'offlineMode', labelKey: 'settings.offlineMode', status: 'comingSoon' },
      { id: 'interfaceLanguage', labelKey: 'settings.interfaceLanguage', status: 'supported' },
    ],
  },
  {
    id: 'customize',
    labelKey: 'settings.group.customize',
    items: [
      { id: 'shopBranding', labelKey: 'settings.shopBranding', status: 'comingSoon' },
      { id: 'customerPriceList', labelKey: 'settings.customerPriceList', status: 'comingSoon' },
      { id: 'customerMessage', labelKey: 'settings.customerMessage', status: 'comingSoon' },
    ],
  },
];
