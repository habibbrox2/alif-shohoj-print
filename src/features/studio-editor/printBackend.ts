import type { PrintJob } from '../../shared/types.js';
import type { PrintSettings } from './printSettings.js';

export interface PrintResult {
  ok: boolean;
  message: string;
}

const NOT_CONNECTED = 'Print backend not yet connected';

/**
 * Desktop print agent hard limit, shared with `electron/services/print-service.ts`.
 * A snapshot larger than this is refused before anything touches the queue,
 * so a 60 MB canvas cannot silently replace the file behind a job.
 */
const MAX_PRINT_SNAPSHOT_BYTES = 40 * 1024 * 1024;

/** MIME subtypes of a canvas snapshot that map to a different file extension. */
const DATA_URL_EXTENSION_PATTERN = /^data:image\/(png|webp|bmp|avif)(?:;[^,]*)?,/i;

/** JPEG keeps the `.jpg` extension every other studio export writes. */
function dataUrlExtension(dataUrl: string): string {
  const match = DATA_URL_EXTENSION_PATTERN.exec(dataUrl);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

/** Byte size of the base64 payload, formatted the way the order card and status bar show it. */
function formatDataUrlSize(dataUrl: string): string {
  return formatBytes(dataUrlBytes(dataUrl));
}

/** Raw byte size of the base64 payload, used for the 40 MB pre-validation. */
function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.max(
    0,
    Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0)
  );
}

/** Short human-readable byte size for error messages. */
function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
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

  // An empty snapshot has no pixels to print, and saving it would replace the
  // file attached to the queue job with an empty string, so the job path is
  // refused until the canvas can hand over a real image.
  if (!dataUrl) return { ok: false, message: 'No image snapshot to print.' };

  // Pre-validate against the desktop agent's own ceiling. The agent throws on
  // anything over 40 MB, so refusing here keeps the error in the renderer,
  // where the operator can act on it, instead of after the queue has already
  // mutated the job record.
  const snapshotBytes = dataUrlBytes(dataUrl);
  if (snapshotBytes > MAX_PRINT_SNAPSHOT_BYTES) {
    return {
      ok: false,
      message: `স্ন্যাপশট আকার খুব বড় (${formatBytes(snapshotBytes)})। সর্বোচ্চ ৪০ MB প্রিন্ট করা যায়।`,
    };
  }

  // A canvas opened from a local file has no queue job to attach to, so
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
//   auto-rotation of a wide page. Because the sheet stays portrait, landscape
//   placement and fit-to-media are computed against the portrait page, so they
//   differ from the landscape preview when those two are combined.
// - A customer PDF job and a passport grid keep their own pages; only the
//   spooler orientation reaches them, because re-composing them would change the
//   operator's document and the exact photo copy sizes.
// - The layout above is applied only to jobs that carry it. A job printed without
//   a dialog layout keeps the legacy centred layout: no position, no scale and no
//   orientation from these settings.
