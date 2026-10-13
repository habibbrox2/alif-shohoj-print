import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { degrees, PDFDocument, PageSizes } from 'pdf-lib';
import type { PrintJob } from '../../src/shared/types.js';
import type { SanitizedPrintLayout } from './print-layout.js';
import {
  fitScaleFactor,
  getNaturalSize,
  getPrintableArea,
  resolveDocumentBox,
  sanitizeCropRotation,
  sanitizeCropZoom,
  sanitizePrintLayout,
} from './print-layout.js';

const require = createRequire(import.meta.url);
const { print: printPdf } = require('pdf-to-printer') as typeof import('pdf-to-printer');
const MAX_DOCUMENT_BYTES = 40 * 1024 * 1024;

type SpoolerOptions = NonNullable<Parameters<typeof printPdf>[1]>;

const getDataUrlBytes = (dataUrl: string): { mimeType: string; bytes: Buffer } => {
  const match = /^data:(application\/pdf|image\/jpeg|image\/png);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Unsupported print file. Use a PDF, JPEG, or PNG file uploaded to this order.');
  }
  const bytes = Buffer.from(match[2].replace(/\s/g, ''), 'base64');
  if (bytes.length === 0 || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new Error('Print file is empty or exceeds the 40 MB desktop print limit.');
  }
  return { mimeType: match[1].toLowerCase(), bytes };
};

const isPassportGrid = (job: PrintJob): boolean =>
  job.serviceType === 'passport_photo' && job.paperSize.startsWith('Passport Grid');

const getPageSize = (job: PrintJob): [number, number] => {
  if (isPassportGrid(job)) return job.gridCount === 8 ? PageSizes.A4 : [288, 432];
  if (job.paperSize === 'Legal') return [612, 1008];
  if (job.paperSize === '4R (4x6 in)') return [288, 432];
  if (job.paperSize === 'Custom') throw new Error('Custom paper size is not supported for silent printing yet.');
  return PageSizes.A4;
};

const getSumatraPaperSize = (job: PrintJob): string => {
  if (isPassportGrid(job)) return job.gridCount === 8 ? 'A4' : '4x6';
  if (job.paperSize === 'Legal') return 'Legal';
  if (job.paperSize === '4R (4x6 in)') return '4x6';
  return 'A4';
};

export interface PrintServiceOptions {
  userDataPath: string;
  print: typeof printPdf;
}

export class PrintService {
  constructor(private readonly options: PrintServiceOptions) {}

  async print(job: PrintJob): Promise<void> {
    if (!job.targetPrinterName.trim()) throw new Error('Select a Windows printer before printing this job.');
    const { mimeType, bytes } = getDataUrlBytes(job.fileUrl);
    // Sanitized once, so the composed page and the spooler option cannot disagree.
    const layout = sanitizePrintLayout(job.printLayout);
    const outputDirectory = join(this.options.userDataPath, 'print-jobs');
    await mkdir(outputDirectory, { recursive: true });
    const fileName = `${createHash('sha256').update(job.id).digest('hex')}.pdf`;
    const pdfPath = join(outputDirectory, fileName);

    try {
      const pdfBytes = await this.makePdf(mimeType, bytes, job, layout);
      await writeFile(pdfPath, pdfBytes, { flag: 'wx' }).catch(async error => {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
        await rm(pdfPath, { force: true });
        await writeFile(pdfPath, pdfBytes, { flag: 'wx' });
      });

      const options: SpoolerOptions = {
        printer: job.targetPrinterName,
        copies: job.copies,
        silent: true,
        paperSize: getSumatraPaperSize(job),
        monochrome: job.colorMode === 'bw',
        scale: 'fit',
      };
      // The option is omitted unless the dialog asked for landscape, so a job
      // saved before the dialog existed is spooled with exactly today's options.
      // SumatraPDF rotates the page content 90 degrees and leaves the paper to
      // the printer driver; a genuinely landscape sheet would also need its
      // auto-rotation suppressed, which pdf-to-printer does not expose.
      if (layout?.orientation === 'landscape') {
        options.orientation = 'landscape';
      }
      await this.options.print(pdfPath, options);
    } finally {
      await rm(pdfPath, { force: true });
    }
  }

  private async makePdf(
    mimeType: string,
    bytes: Buffer,
    job: PrintJob,
    layout: SanitizedPrintLayout | null
  ): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const pageSize = getPageSize(job);
    const page = document.addPage(pageSize);

    if (mimeType === 'application/pdf') {
      // A customer PDF keeps its own pages; only the spooler orientation is
      // applied, because re-composing foreign pages would alter the document.
      const source = await PDFDocument.load(bytes, { ignoreEncryption: false });
      const pages = await document.copyPages(source, source.getPageIndices());
      for (const sourcePage of pages) document.addPage(sourcePage);
      document.removePage(0);
    } else {
      const image = mimeType === 'image/jpeg'
        ? await document.embedJpg(bytes)
        : await document.embedPng(bytes);
      const rotation = degrees(sanitizeCropRotation(job.cropSettings?.rotation));
      const zoom = sanitizeCropZoom(job.cropSettings?.zoom);

      if (isPassportGrid(job)) {
        const count = job.gridCount === 8 ? 8 : 4;
        const columns = count === 8 ? 4 : 2;
        const rows = count / columns;
        const photoWidth = (35 / 25.4) * 72;
        const photoHeight = (45 / 25.4) * 72;
        const gap = 8;
        const gridWidth = columns * photoWidth + (columns - 1) * gap;
        const gridHeight = rows * photoHeight + (rows - 1) * gap;
        const startX = (pageSize[0] - gridWidth) / 2;
        const startY = (pageSize[1] - gridHeight) / 2;

        for (let index = 0; index < count; index += 1) {
          const column = index % columns;
          const row = Math.floor(index / columns);
          page.drawImage(image, {
            x: startX + column * (photoWidth + gap),
            y: pageSize[1] - startY - (row + 1) * photoHeight - row * gap,
            width: photoWidth * zoom,
            height: photoHeight * zoom,
            rotate: rotation,
          });
        }
      } else if (!layout) {
        // Pre-dialog behaviour, unchanged: fit to page, centre, and still apply
        // the crop zoom and rotation. Deliberately different from the path below.
        const scaled = image.scaleToFit(pageSize[0], pageSize[1]);
        const width = scaled.width * zoom;
        const height = scaled.height * zoom;
        page.drawImage(image, {
          x: (pageSize[0] - width) / 2,
          y: (pageSize[1] - height) / 2,
          width,
          height,
          rotate: rotation,
        });
      } else {
        // The dialog sends a canvas snapshot: cropSettings.zoom and
        // cropSettings.rotation are already baked into its pixels, which the
        // dialog also models as canvasSize ÷ 300 DPI. Applying either again would
        // print something other than the preview the operator approved, so the
        // legacy branch above is deliberately the only path that re-applies them.
        // Scale to fit therefore fits the snapshot's own size into the margin.
        const natural = getNaturalSize(image.width, image.height);
        const factor = layout.scaleToFit
          ? fitScaleFactor(natural.width, natural.height, getPrintableArea(pageSize[0], pageSize[1], layout.marginIn))
          : layout.scalePercent / 100;

        page.drawImage(image, {
          ...resolveDocumentBox({
            pageWidth: pageSize[0],
            pageHeight: pageSize[1],
            docWidth: natural.width * factor,
            docHeight: natural.height * factor,
            layout,
          }),
        });
      }
    }

    return document.save();
  }
}

export const createPrintService = (userDataPath: string): PrintService =>
  new PrintService({ userDataPath, print: printPdf });
