import type { PrintJob } from '../../shared/types.js';
import type { PrintSettings } from './printSettings.js';

export interface PrintResult {
  ok: boolean;
  message: string;
}

const NOT_CONNECTED = 'Print backend not yet connected';

/** MIME subtypes of a canvas snapshot that map to a different file extension. */
const DATA_URL_EXTENSION_PATTERN = /^data:image\/(png|webp|bmp|avif)(?:;[^,]*)?,/i;

/** JPEG keeps the `.jpg` extension every other studio export writes. */
function dataUrlExtension(dataUrl: string): string {
  const match = DATA_URL_EXTENSION_PATTERN.exec(dataUrl);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

/** Byte size of the base64 payload, formatted the way the order card and status bar show it. */
function formatDataUrlSize(dataUrl: string): string {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const fileBytes = Math.max(
    0,
    Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
  );
  return fileBytes >= 1024 * 1024
    ? `${(fileBytes / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.max(1, Math.round(fileBytes / 1024))} KB`;
}

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
    // The snapshot replaces the bytes behind the job, so the record is updated
    // with it: the order card and the editor status bar read `fileName` and
    // `fileSize`, and both would otherwise describe the previous file.
    const now = Date.now();
    const printedJob: PrintJob = {
      ...job,
      fileUrl: dataUrl,
      fileName: `${job.fileName.replace(/\.[^/.]+$/, '')}-print${dataUrlExtension(dataUrl)}`,
      fileSize: formatDataUrlSize(dataUrl),
      paperSize: settings.paperSize,
      // The dialog's output settings travel with the job so the desktop print
      // agent can compose the page the preview showed instead of centring,
      // unscaled and portrait. Preview-only choices such as the bounding box are
      // deliberately absent: the agent has nothing to apply them to.
      printLayout: {
        orientation: settings.orientation,
        marginIn: settings.marginIn,
        centerImage: settings.centerImage,
        topIn: settings.topIn,
        leftIn: settings.leftIn,
        scalePercent: settings.scalePercent,
        scaleToFit: settings.scaleToFit,
      },
      auditLogs: [
        ...job.auditLogs,
        {
          id: `log_${now}_print`,
          timestamp: now,
          actor: 'shopkeeper',
          action: 'studio_print',
          details: `Printed from the Studio editor: paper=${settings.paperSize}, orientation=${settings.orientation}; the job file was replaced with the print snapshot.`,
        },
      ],
    };

    await bridge.saveJob(printedJob);
    await bridge.printJob(job.id);
    return { ok: true, message: 'Job sent to the print queue.' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Print request failed.' };
  }
}

// Known limits of the desktop print agent, recorded here so the dialog does not
// promise more than a silent spooler can deliver:
// - Landscape rotates the page content only; the paper orientation belongs to
//   the printer driver, and pdf-to-printer cannot suppress SumatraPDF's
//   auto-rotation of a wide page.
// - A customer PDF job and a passport grid keep their own pages; only the
//   spooler orientation reaches them, because re-composing them would change the
//   operator's document and the exact photo copy sizes.
