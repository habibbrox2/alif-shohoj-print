import { useEffect, useState, type FC } from 'react';
import { AlertCircle, Printer, RefreshCw, Save, X } from 'lucide-react';
import { useStudio } from '../../../shared/context/StudioContext';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { capabilitiesRegistry } from '../drivers/PrinterCapabilitiesRegistry';
import { matchPrinterForJob } from '../printerRouting';
import type { PrinterDevice, StudioService } from '../../../shared/types';

interface DetectedPrintersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Short paper names for the capability chips ("4R (4x6 in)" reads as "4R"). */
const PAPER_SHORT_LABEL: Record<string, string> = {
  '4R (4x6 in)': '4R',
  'Passport Grid (4-in-1)': 'Passport',
  'Passport Grid (8-in-1)': 'Passport 8',
  'Stamp Size': 'Stamp',
  'A4 (8.27x11.69 in)': 'A4',
  Legal: 'Legal'
};

/** Service names as they appear in the reference dialog's "Default for" column. */
const SERVICE_SHORT_LABEL: Record<string, string> = {
  doc_a4: 'Document',
  nid_card: 'NID Copy',
  passport_photo: 'Passport',
  stamp_photo: 'Stamp',
  photo_4r: 'Photo Print',
  photo_6r: 'Photo 6R'
};

const capabilityLabels = (printer: PrinterDevice): string[] => {
  const caps = capabilitiesRegistry.getCapabilitiesForDevice(printer);
  const labels = caps.supportedPaperSizes.map(spec => PAPER_SHORT_LABEL[String(spec.id)] ?? String(spec.id));
  labels.push(printer.colorCapability === 'color' ? 'Color' : 'B&W');
  if (caps.photoDpi >= 2880) labels.push('Photo');
  if (printer.supportedPaperSizes.includes('A4 (8.27x11.69 in)')) labels.push('Document');
  return labels;
};

const servicesForPrinter = (printerId: string, services: StudioService[]): string[] =>
  services
    .filter(service => service.preferredPrinterId === printerId)
    .map(service => SERVICE_SHORT_LABEL[service.id] ?? service.title);

/**
 * "Printer Settings" dialog from the design reference: every detected device is a
 * card with a checkbox, its capabilities and the services it currently prints by
 * default. Saving applies the selection to the live printer fleet and re-points
 * any service default whose printer is no longer selected, so the capability
 * matcher routes new orders to what the shopkeeper actually enabled.
 */
export const DetectedPrintersModal: FC<DetectedPrintersModalProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const { printers, services, scanLocalPrinters, togglePrinterStatus, updateStudioService } = useStudio();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(new Set(printers.filter(printer => printer.status === 'online').map(printer => printer.id)));
    setSaveNote(null);
    setRefreshError(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshError(null);
    setSaveNote(null);
    try {
      await scanLocalPrinters();
      setSelectedIds(new Set(printers.filter(printer => printer.status === 'online').map(printer => printer.id)));
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSave = () => {
    const nextPrinters = printers.map(printer => ({
      ...printer,
      status: (selectedIds.has(printer.id) ? 'online' : 'offline') as PrinterDevice['status']
    }));

    printers.forEach(printer => {
      const shouldBeOnline = selectedIds.has(printer.id);
      if (shouldBeOnline !== (printer.status === 'online')) togglePrinterStatus(printer.id);
    });

    const checkedIds = new Set(nextPrinters.filter(printer => printer.status === 'online').map(printer => printer.id));
    let rejected = 0;
    services.forEach(service => {
      if (service.preferredPrinterId && checkedIds.has(service.preferredPrinterId)) return;
      const routing = matchPrinterForJob(service.id, service.preferences.paperSize, service.preferences.color, nextPrinters);
      if (!checkedIds.has(routing.printerId)) return;
      if (!updateStudioService(service.id, { preferredPrinterId: routing.printerId })) rejected += 1;
    });

    setSaveNote(rejected > 0 ? t('printers.settings.partialSave', { count: rejected }) : t('printers.settings.saved'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('printers.settings.title')}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border-primary bg-surface text-text-primary shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-border-secondary px-4 py-3">
          <Printer className="h-4 w-4 text-brand" />
          <span className="text-sm font-bold">{t('printers.settings.title')}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('order.cancel')}
            className="ml-auto rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold">
              <Printer className="h-5 w-5 text-brand" />
              {t('printers.settings.heading')}
            </h3>
            <p className="mt-1 text-xs text-text-secondary">{t('printers.settings.subtitle')}</p>
          </div>

          {printers.length === 0 ? (
            <p className="rounded-xl border border-border-primary bg-bg-secondary px-4 py-6 text-center text-xs text-text-secondary">
              {t('status.printersEmpty')}
            </p>
          ) : (
            <div className="space-y-3">
              {printers.map(printer => (
                <PrinterCard
                  key={printer.id}
                  printer={printer}
                  isSelected={selectedIds.has(printer.id)}
                  defaultServices={servicesForPrinter(printer.id, services)}
                  onToggle={() =>
                    setSelectedIds(previous => {
                      const next = new Set(previous);
                      if (next.has(printer.id)) next.delete(printer.id);
                      else next.add(printer.id);
                      return next;
                    })
                  }
                />
              ))}
            </div>
          )}

          {refreshError && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-error bg-error-bg px-3 py-2 text-xs text-text-secondary">
              <AlertCircle className="h-4 w-4 shrink-0 text-error" />
              {refreshError}
            </p>
          )}
          {saveNote && (
            <p role="status" className="rounded-lg border border-brand bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
              {saveNote}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border-secondary px-5 py-3">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-brand bg-surface px-4 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand-soft disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {t('printers.settings.refresh')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-hover"
          >
            <Save className="h-3.5 w-3.5" />
            {t('printers.settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PrinterCardProps {
  printer: PrinterDevice;
  isSelected: boolean;
  defaultServices: string[];
  onToggle: () => void;
}

const PrinterCard: FC<PrinterCardProps> = ({ printer, isSelected, defaultServices, onToggle }) => {
  const { t } = useI18n();
  const isReady = printer.status === 'online';

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border-primary bg-surface p-4 shadow-sm">
      <input
        type="checkbox"
        checked={isSelected}
        disabled={!isReady}
        onChange={onToggle}
        aria-label={printer.name}
        title={isReady ? t('printer.menu.setOffline') : t('printers.settings.offlineHint')}
        className="h-4 w-4 shrink-0 accent-brand disabled:opacity-60"
      />

      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Printer className="h-6 w-6" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-text-primary">{printer.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-text-secondary">
          <span className={`h-2 w-2 rounded-full ${isReady ? 'bg-success' : 'bg-error'}`} />
          {isReady ? t('printers.settings.ready') : t('printers.settings.offline')}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 border-l border-border-secondary pl-4">
        {defaultServices.length > 0 ? (
          <>
            <div>
              <p className="text-[11px] font-semibold text-brand">{t('printers.settings.capabilities')}</p>
              <p className="mt-0.5 text-[11px] text-text-secondary">{capabilityLabels(printer).join(', ')}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand">{t('printers.settings.defaultFor')}</p>
              <p className="mt-0.5 text-[11px] text-text-secondary">{defaultServices.join(', ')}</p>
            </div>
          </>
        ) : (
          <div>
            <p className="text-[11px] font-semibold text-brand">{t('printers.settings.status')}</p>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              {isReady ? t('printers.settings.ready') : t('printers.settings.offline')}
            </p>
          </div>
        )}
      </div>

      <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg border border-border-secondary bg-bg-secondary text-text-tertiary">
        <Printer className="h-9 w-9" />
      </div>
    </div>
  );
};
