import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { PrintJob } from '../../shared/types';
import {
  PAPER_SIZE_CHOICES,
  clampPrintMargin,
  clampPrintScale,
  computePrintLayout,
  loadPrintSettings,
  savePrintSettings,
  settingsFromHeight,
  settingsFromScale,
  settingsFromWidth,
  type PrintSettings,
} from './printSettings';
import { printWithSettings, type PrintResult } from './printBackend';

export interface PrintDialogProps {
  job?: PrintJob;
  docPx: { w: number; h: number };
  docDataUrl: string;
  onClose: () => void;
}

const INPUT_CLASS =
  'w-20 rounded-[9px] border border-border-primary bg-bg-secondary px-2 py-1 text-right text-[11px] tabular-nums text-text-primary focus:border-brand focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

const SELECT_CLASS =
  'w-full rounded-[9px] border border-border-primary bg-bg-secondary px-2 py-1.5 text-[11px] text-text-primary focus:border-brand focus:outline-none';

const SECTION_TITLE_CLASS = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-text-tertiary';

/** Position and size of a length on the sheet, expressed against the sheet itself. */
function axisPercent(valueIn: number, paperIn: number): number {
  return paperIn > 0 ? (valueIn / paperIn) * 100 : 0;
}

/**
 * Numeric field with a string draft. The committed number is written back on
 * blur or Enter only: re-rendering on every keystroke resets the DOM value, which
 * turns "0." into "0" and multiplies sub-inch decimals by ten.
 */
const NumberField: React.FC<{
  label: string;
  title?: string;
  value: number;
  step: string;
  suffix?: string;
  disabled?: boolean;
  onCommit: (value: number) => void;
}> = ({ label, title, value, step, suffix, disabled = false, onCommit }) => {
  const [draft, setDraft] = useState<string | null>(null);

  // A disabled field shows the derived value and never resurrects an old draft.
  useEffect(() => {
    if (disabled) setDraft(null);
  }, [disabled]);

  const commit = () => {
    const current = draft;
    setDraft(null);
    if (current === null || disabled) return;
    const parsed = Number(current);
    if (current.trim() !== '' && Number.isFinite(parsed)) onCommit(parsed);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-text-secondary">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={disabled ? String(value) : draft ?? String(value)}
          step={step}
          disabled={disabled}
          aria-label={label}
          title={title ?? label}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
          className={INPUT_CLASS}
        />
        {suffix && <span className="w-3 text-[11px] text-text-tertiary">{suffix}</span>}
      </span>
    </div>
  );
};

const CheckboxField: React.FC<{
  label: string;
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, title, checked, onChange }) => (
  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-text-secondary" title={title}>
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onChange(event.target.checked)}
      className="h-3.5 w-3.5 accent-brand"
    />
    <span>{label}</span>
  </label>
);

const ActionButton: React.FC<{
  label: string;
  tone: 'primary' | 'default';
  disabled?: boolean;
  onClick: () => void;
}> = ({ label, tone, disabled = false, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full rounded-[10px] px-2.5 py-2 text-[11px] font-semibold transition-colors ${
      tone === 'primary'
        ? 'bg-brand text-on-brand hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50'
        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50'
    }`}
  >
    {label}
  </button>
);

export const PrintDialog: React.FC<PrintDialogProps> = ({ job, docPx, docDataUrl, onClose }) => {
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  const [showPageSetup, setShowPageSetup] = useState<boolean>(false);
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printStatus, setPrintStatus] = useState<PrintResult | null>(null);

  const layout = useMemo(() => computePrintLayout(settings, docPx), [settings, docPx]);

  const frame = {
    left: axisPercent(layout.leftIn, layout.paper.widthIn),
    top: axisPercent(layout.topIn, layout.paper.heightIn),
    width: axisPercent(layout.docWidthIn, layout.paper.widthIn),
    height: axisPercent(layout.docHeightIn, layout.paper.heightIn),
  };
  // Rounded for display only; the preview keeps the full precision values.
  const topIn = Number(layout.topIn.toFixed(3));
  const leftIn = Number(layout.leftIn.toFixed(3));
  const scalePercent = Number(layout.scalePercent.toFixed(2));
  const heightIn = Number(layout.docHeightIn.toFixed(3));
  const widthIn = Number(layout.docWidthIn.toFixed(3));
  const marginIn = Number(clampPrintMargin(settings.marginIn).toFixed(2));

  const positionLocked = settings.centerImage;
  const sizeLocked = settings.scaleToFit;

  const handleScaleToFitChange = (checked: boolean) => {
    setSettings(current => (checked
      ? { ...current, scaleToFit: true }
      // Carry the fitted percentage across so the document does not jump when
      // fit-to-media is switched off.
      : { ...current, scaleToFit: false, scalePercent: clampPrintScale(computePrintLayout(current, docPx).scalePercent) }));
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    setPrintStatus(null);
    try {
      setPrintStatus(await printWithSettings({ settings, dataUrl: docDataUrl, job }));
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintClick = () => {
    void handlePrint().catch(error => setPrintStatus({
      ok: false,
      message: error instanceof Error ? error.message : 'Print request failed.',
    }));
  };

  // Escape is handled here rather than in the editor's window listener, which
  // bails out for input targets; while printing nothing dismisses the dialog so
  // the in-flight saveJob/printJob pair cannot lose its component.
  const handleDialogKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'Escape' || isPrinting) return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
  };

  const dismiss = () => {
    if (!isPrinting) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={dismiss}>
      <div
        className="flex h-[520px] max-h-[92vh] w-[780px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border-primary bg-surface shadow-2xl"
        onClick={event => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border-primary px-4">
          <h2 className="text-sm font-semibold text-text-primary">Print</h2>
          <button
            type="button"
            onClick={dismiss}
            disabled={isPrinting}
            aria-label="Close print dialog"
            title="Close (discard changes)"
            className="grid h-7 w-7 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Preview is first in the DOM, so the tab order starts here and runs
              buttons → position → scale. */}
          <div
            className="w-[57%] grow bg-[var(--color-studio-canvas)] p-5"
            style={{ containerType: 'size' }}
            tabIndex={0}
            aria-label="Print preview"
          >
            <div className="grid h-full w-full place-items-center">
              <div
                className="relative shadow-xl"
                style={{
                  aspectRatio: `${layout.paper.widthIn} / ${layout.paper.heightIn}`,
                  // Container units keep the sheet inside the preview in both
                  // orientations without measuring it in JavaScript.
                  width: `min(100%, calc(100cqh * ${layout.paper.widthIn} / ${layout.paper.heightIn}))`,
                  maxWidth: '100%',
                  maxHeight: '100%',
                  background: 'var(--color-studio-paper)',
                }}
              >
                {docDataUrl && (
                  <div
                    className={`absolute${settings.showBoundingBox ? ' border border-dashed border-brand/70' : ''}`}
                    style={{
                      left: `${frame.left}%`,
                      top: `${frame.top}%`,
                      width: `${frame.width}%`,
                      height: `${frame.height}%`,
                    }}
                  >
                    <img src={docDataUrl} alt="Print preview" className="block h-full w-full" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-[300px] shrink-0 space-y-3 overflow-y-auto border-l border-border-primary p-3">
            <div className="space-y-1.5">
              <ActionButton label={isPrinting ? 'Printing…' : 'Print…'} tone="primary" disabled={isPrinting} onClick={handlePrintClick} />
              <ActionButton label="Cancel" tone="default" disabled={isPrinting} onClick={dismiss} />
              <ActionButton
                label="Done"
                tone="default"
                disabled={isPrinting}
                onClick={() => {
                  savePrintSettings(settings);
                  onClose();
                }}
              />
              <ActionButton
                label="Page Setup…"
                tone="default"
                onClick={() => setShowPageSetup(value => !value)}
              />
              <p role="status" className={`min-h-4 text-[10px] leading-relaxed ${printStatus && !printStatus.ok ? 'text-error' : 'text-text-tertiary'}`}>
                {printStatus?.message ?? ''}
              </p>
            </div>

            <div className="border-t border-border-primary" />

            {showPageSetup && (
              <section className="space-y-2">
                <p className={SECTION_TITLE_CLASS}>Page Setup</p>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-secondary">Paper Size</span>
                  <select
                    value={settings.paperSize}
                    title="Paper size"
                    onChange={event => {
                      const next = PAPER_SIZE_CHOICES.find(size => size === event.target.value);
                      if (next) setSettings(current => ({ ...current, paperSize: next }));
                    }}
                    className={SELECT_CLASS}
                  >
                    {PAPER_SIZE_CHOICES.map(size => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-text-secondary">Orientation</span>
                  <select
                    value={settings.orientation}
                    title="Orientation"
                    onChange={event =>
                      setSettings(current => ({ ...current, orientation: event.target.value === 'landscape' ? 'landscape' : 'portrait' }))
                    }
                    className={SELECT_CLASS}
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
                <NumberField
                  label="Margins"
                  title="Sheet margins, applied to the printable area"
                  value={marginIn}
                  step="0.01"
                  suffix="in"
                  onCommit={value => setSettings(current => ({ ...current, marginIn: clampPrintMargin(value) }))}
                />
                <p className="text-[10px] leading-relaxed text-text-tertiary">
                  Electron offers no native page-setup sheet, and the print service does not read orientation or margins yet — they shape the preview only.
                </p>
              </section>
            )}

            <section className="space-y-2">
              <p className={SECTION_TITLE_CLASS}>Position</p>
              <NumberField
                label="Top"
                title="Distance from the top of the sheet"
                value={topIn}
                step="0.001"
                suffix="in"
                disabled={positionLocked}
                onCommit={value => setSettings(current => ({ ...current, topIn: value }))}
              />
              <NumberField
                label="Left"
                title="Distance from the left edge of the sheet"
                value={leftIn}
                step="0.001"
                suffix="in"
                disabled={positionLocked}
                onCommit={value => setSettings(current => ({ ...current, leftIn: value }))}
              />
              <CheckboxField
                label="Center Image"
                title="Centre the document on the sheet and ignore the top and left offsets"
                checked={settings.centerImage}
                onChange={checked => setSettings(current => ({ ...current, centerImage: checked }))}
              />
            </section>

            <section className="space-y-2">
              <p className={SECTION_TITLE_CLASS}>Scaled Print Size</p>
              <NumberField
                label="Scale"
                title="Print scale as a percentage of the natural size at 300 DPI"
                value={scalePercent}
                step="0.1"
                suffix="%"
                disabled={sizeLocked}
                onCommit={value => setSettings(current => settingsFromScale(current, value))}
              />
              <CheckboxField
                label="Scale to Fit Media"
                title="Scale the document to fill the printable area, ignoring the scale percentage"
                checked={settings.scaleToFit}
                onChange={handleScaleToFitChange}
              />
              <NumberField
                label="Height"
                title="Printed height; width follows the aspect ratio"
                value={heightIn}
                step="0.001"
                suffix="in"
                disabled={sizeLocked}
                onCommit={value => setSettings(current => settingsFromHeight(current, docPx, value))}
              />
              <NumberField
                label="Width"
                title="Printed width; height follows the aspect ratio"
                value={widthIn}
                step="0.001"
                suffix="in"
                disabled={sizeLocked}
                onCommit={value => setSettings(current => settingsFromWidth(current, docPx, value))}
              />
              <CheckboxField
                label="Show Bounding Box"
                title="Outline the document on the paper preview"
                checked={settings.showBoundingBox}
                onChange={checked => setSettings(current => ({ ...current, showBoundingBox: checked }))}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
