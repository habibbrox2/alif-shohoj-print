import type { PrintJob } from '../../shared/types.js';
import type { PrintSettings } from './printSettings.js';

export interface PrintResult {
  ok: boolean;
  message: string;
}

const NOT_CONNECTED = 'Print backend not yet connected';

/**
 * Seam between the Studio print dialog and the desktop print queue.
 *
 * The dialog owns the settings; this module only decides whether a queue job
 * exists to print and forwards it through the preload bridge. Job payloads,
 * tokens and image data URLs are never logged.
 */
export async function printWithSettings(request: {
  settings: PrintSettings;
  dataUrl: string;
  job?: PrintJob;
}): Promise<PrintResult> {
  const { settings, dataUrl, job } = request;

  // TODO: an empty snapshot has no pixels to print, and saving it would replace
  // the file attached to the queue job with an empty string, so the job path is
  // refused until the canvas can hand over a real image.
  if (!dataUrl) return { ok: false, message: 'No image snapshot to print.' };

  // TODO: a canvas opened from a local file has no queue job to attach to, so
  // standalone printing cannot reach the desktop queue yet.
  if (!job) return { ok: false, message: NOT_CONNECTED };

  // TODO: the renderer only reaches the print agent through the desktop preload
  // bridge, which the web harness does not expose.
  const bridge = window.alifShohojPrintDesktop;
  if (!bridge) return { ok: false, message: NOT_CONNECTED };

  try {
    await bridge.saveJob({ ...job, fileUrl: dataUrl, paperSize: settings.paperSize });
    await bridge.printJob(job.id);
    return { ok: true, message: 'Job sent to the print queue.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Print request failed.' };
  }
}

// TODO: electron/services/print-service.ts still prints with `scale: 'fit'` and
// ignores the dialog's position (top/left), scale percentage, center image,
// fit-to-media, orientation and paper margins. Persist them on the job (or a
// sibling record keyed by job id) and honour them when the PDF page is composed
// so the printed page agrees with the preview.
