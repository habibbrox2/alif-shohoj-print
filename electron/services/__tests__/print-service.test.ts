import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import {
  decodePDFRawStream,
  PDFArray,
  PDFDocument,
  PDFRawStream,
  type PDFPage,
  type PDFRef,
} from 'pdf-lib';
import type { PrintJob, PrintJobLayout } from '../../../src/shared/types.js';
import { sanitizePrintLayout } from '../print-layout.js';
import { PrintService } from '../print-service.js';

const createPdfDataUrl = async (): Promise<string> => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  return `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
};

const createJob = (fileUrl: string): PrintJob => ({
  id: 'print-test-1',
  tokenCode: '101',
  customerPhone: '01700000000',
  serviceType: 'doc_a4',
  serviceLabel: 'A4 Document',
  serviceLabelBn: 'A4 ডকুমেন্ট',
  paperSize: 'A4 (8.27x11.69 in)',
  paperFinish: 'normal',
  copies: 3,
  colorMode: 'bw',
  status: 'queued',
  targetPrinterId: 'printer-test',
  targetPrinterName: 'Test Printer',
  routingReason: 'Test',
  priceBDT: 15,
  paymentMethod: 'counter_cash',
  paymentStatus: 'paid_counter',
  fileUrl,
  fileName: 'test.pdf',
  fileSize: '1 KB',
  createdAt: Date.now(),
  autoDeleteCountdownSeconds: 900,
  auditLogs: [],
});

test('validates PDF data, invokes silent printing, and removes staged files', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-print-'));
  const fileUrl = await createPdfDataUrl();
  let stagedPdfPath = '';
  const service = new PrintService({
    userDataPath: directory,
    print: async (pdfPath, options) => {
      stagedPdfPath = pdfPath;
      assert.ok(existsSync(pdfPath));
      assert.match(readFileSync(pdfPath).toString('ascii', 0, 8), /^%PDF-/);
      assert.deepEqual(options, {
        printer: 'Test Printer',
        copies: 3,
        silent: true,
        paperSize: 'A4',
        monochrome: true,
        scale: 'fit',
      });
    },
  });

  try {
    await service.print(createJob(fileUrl));
    assert.ok(stagedPdfPath);
    assert.equal(existsSync(stagedPdfPath), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('rejects URL and unsupported file input without calling the spooler', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-print-invalid-'));
  let called = false;
  const service = new PrintService({
    userDataPath: directory,
    print: async () => { called = true; },
  });

  try {
    await assert.rejects(service.print(createJob('https://example.com/private.pdf')), /Unsupported print file/);
    assert.equal(called, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('lays out four passport copies on a 4R sheet', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-passport-grid-'));
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/4tQAAAAASUVORK5CYII=',
    'base64'
  );
  let printedPaperSize = '';
  let outputPageSize = { width: 0, height: 0 };
  const service = new PrintService({
    userDataPath: directory,
    print: async (pdfPath, options) => {
      printedPaperSize = options?.paperSize || '';
      const document = await PDFDocument.load(readFileSync(pdfPath));
      outputPageSize = document.getPage(0).getSize();
    },
  });
  const passportJob: PrintJob = {
    ...createJob(`data:image/png;base64,${png.toString('base64')}`),
    serviceType: 'passport_photo',
    paperSize: 'Passport Grid (4-in-1)',
    gridCount: 4,
  };

  try {
    await service.print(passportJob);
    assert.equal(printedPaperSize, '4x6');
    assert.deepEqual(outputPageSize, { width: 288, height: 432 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

/** A4 in points, the page size the composed sheets are checked against. */
const A4_POINTS = { width: 595.28, height: 841.89 };
const TOLERANCE = 1e-6;

const crc32 = (bytes: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 0);
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, checksum]);
};

/**
 * A solid truecolour PNG of the requested size. The suite uses a 2:1 source so
 * that an aspect-ratio regression cannot pass unnoticed.
 */
const createPngDataUrl = (width: number, height: number): string => {
  const stride = 1 + width * 3;
  const scanlines = Buffer.alloc(height * stride);
  for (let row = 0; row < height; row += 1) scanlines.fill(0x80, row * stride, (row + 1) * stride);

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
};

const WIDE_PNG = createPngDataUrl(60, 30);

const createImageJob = (overrides: Partial<PrintJob> = {}): PrintJob => ({
  ...createJob(WIDE_PNG),
  ...overrides,
});

const withLayout = (printLayout: PrintJobLayout, overrides: Partial<PrintJob> = {}): PrintJob =>
  createImageJob({ ...overrides, printLayout });

interface Draw {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `drawImage` concatenates four matrices per image — translate, rotate, scale
 * and skew — so the first and third of each group give the drawn position and
 * size in PDF points.
 */
const MATRIX_PATTERN = /(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm/g;
const OPERATORS_PER_DRAW = 4;

const readContentStream = (document: PDFDocument, page: PDFPage): string => {
  const contents = page.node.Contents();
  const streams: PDFRawStream[] = [];

  if (contents instanceof PDFArray) {
    for (const entry of contents.asArray()) {
      const resolved = document.context.lookup(entry as PDFRef);
      if (resolved instanceof PDFRawStream) streams.push(resolved);
    }
  } else if (contents instanceof PDFRawStream) {
    streams.push(contents);
  }

  return streams
    .map(stream => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'))
    .join('\n');
};

interface CapturedPrint {
  pageSize: { width: number; height: number };
  pageCount: number;
  draws: Draw[];
  options: Record<string, unknown>;
}

/** Print a job and report what the spooler would have sent to the printer. */
const capturePrint = async (job: PrintJob): Promise<CapturedPrint> => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-layout-'));
  const captured: CapturedPrint = { pageSize: { width: 0, height: 0 }, pageCount: 0, draws: [], options: {} };

  const service = new PrintService({
    userDataPath: directory,
    print: async (pdfPath, options) => {
      const document = await PDFDocument.load(readFileSync(pdfPath));
      const page = document.getPage(0);
      captured.pageSize = page.getSize();
      captured.pageCount = document.getPageCount();
      captured.options = { ...options };

      const matrices = [...readContentStream(document, page).matchAll(MATRIX_PATTERN)].map(match =>
        match.slice(1).map(Number)
      );
      captured.draws = [];
      for (let index = 0; index + OPERATORS_PER_DRAW <= matrices.length; index += OPERATORS_PER_DRAW) {
        const translate = matrices[index];
        const scale = matrices[index + 2];
        captured.draws.push({ x: translate[4], y: translate[5], width: scale[0], height: scale[3] });
      }
    },
  });

  try {
    await service.print(job);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }

  return captured;
};

const assertClose = (actual: number, expected: number, label: string): void => {
  assert.ok(
    Math.abs(actual - expected) < TOLERANCE,
    `${label}: expected ${actual} to be within ${TOLERANCE} of ${expected}`
  );
};

const assertDraw = (draw: Draw, expected: Draw): void => {
  assertClose(draw.x, expected.x, 'x');
  assertClose(draw.y, expected.y, 'y');
  assertClose(draw.width, expected.width, 'width');
  assertClose(draw.height, expected.height, 'height');
};

test('keeps a job without a saved layout on the legacy centred placement', async () => {
  const legacy = await capturePrint(createImageJob());
  const defaults = await capturePrint(withLayout({
    orientation: 'portrait',
    marginIn: 0,
    topIn: 0,
    leftIn: 0,
    scalePercent: 100,
    scaleToFit: false,
    centerImage: true,
    showBoundingBox: true,
  }));

  assert.deepEqual(legacy.pageSize, A4_POINTS);
  assert.equal(legacy.options.orientation, undefined);
  assert.equal(legacy.draws.length, 1);
  // The 2:1 source fills the page width, so it is centred vertically only.
  assertDraw(legacy.draws[0], { x: 0, y: 272.125, width: 595.28, height: 297.64 });

  assert.deepEqual(defaults.pageSize, legacy.pageSize);
  assert.equal(defaults.options.orientation, undefined);
  assertDraw(defaults.draws[0], legacy.draws[0]);
});

test('transposes the sheet and asks the spooler for landscape', async () => {
  const captured = await capturePrint(withLayout({ orientation: 'landscape' }));

  assert.deepEqual(captured.pageSize, { width: A4_POINTS.height, height: A4_POINTS.width });
  assert.equal(captured.options.orientation, 'landscape');
  assert.equal(captured.options.paperSize, 'A4');
  assert.equal(captured.options.scale, 'fit');
  // The 2:1 source is width-bound on the wider sheet, so it spans it completely
  // and is centred across the short edge instead.
  assertDraw(captured.draws[0], { x: 0, y: 87.1675, width: 841.89, height: 420.945 });
});

test('centres the document when the dialog asks to centre it', async () => {
  const captured = await capturePrint(withLayout({ centerImage: true, scalePercent: 100, topIn: 3, leftIn: 3 }));

  // Centre wins over the three inch offsets, which would have printed elsewhere.
  assertDraw(captured.draws[0], { x: 0, y: 272.125, width: 595.28, height: 297.64 });
});

test('scales the document by the dialog percentage and preserves its aspect ratio', async () => {
  const full = await capturePrint(withLayout({ centerImage: true, scalePercent: 100 }));
  const half = await capturePrint(withLayout({ centerImage: true, scalePercent: 50 }));

  assertDraw(half.draws[0], { x: 148.82, y: 346.535, width: 297.64, height: 148.82 });
  assertClose(half.draws[0].width / full.draws[0].width, 0.5, 'width ratio');
  assertClose(half.draws[0].height / full.draws[0].height, 0.5, 'height ratio');
  assertClose(half.draws[0].width / half.draws[0].height, 2, 'aspect ratio');
});

test('multiplies the dialog percentage by the studio crop zoom', async () => {
  const plain = await capturePrint(withLayout({ centerImage: true, scalePercent: 100 }));
  const zoomed = await capturePrint(withLayout({ centerImage: true, scalePercent: 50 }, {
    cropSettings: { zoom: 2, rotation: 0, brightness: 0, contrast: 0, aspectRatio: 'free' },
  }));

  // 50 % at twice the canvas zoom has to print at the same size as 100 % at zoom 1.
  assertDraw(zoomed.draws[0], plain.draws[0]);
});

test('converts the dialog top-left offsets into PDF coordinates', async () => {
  const fromTop = await capturePrint(withLayout({ centerImage: false, scalePercent: 50, topIn: 0, leftIn: 2 }));
  const offset = await capturePrint(withLayout({ centerImage: false, scalePercent: 50, topIn: 1, leftIn: 2 }));

  // topIn is measured from the top edge, PDF `y` from the bottom: pageHeight - topIn - height.
  assertDraw(fromTop.draws[0], { x: 144, y: 693.07, width: 297.64, height: 148.82 });
  assertDraw(offset.draws[0], { x: 144, y: 621.07, width: 297.64, height: 148.82 });
});

test('keeps a document on the sheet when the position is hostile', async () => {
  const captured = await capturePrint(withLayout({
    centerImage: false,
    scalePercent: 100,
    topIn: 1e9,
    leftIn: -1e9,
  }));
  const draw = captured.draws[0];

  // Offsets are clamped to two feet and the box is anchored back on the page,
  // so the operator gets a print they can see rather than a blank sheet.
  assert.ok(draw.x >= 0 && draw.x < captured.pageSize.width, 'left edge stays on the sheet');
  assert.ok(draw.y >= 0 && draw.y < captured.pageSize.height, 'bottom edge stays on the sheet');
  assert.ok(draw.width > 0 && draw.height > 0, 'the document still has a printable size');
  assertDraw(draw, { x: 0, y: 0, width: 595.28, height: 297.64 });
});

test('fits the document inside the printable area defined by the margin', async () => {
  const captured = await capturePrint(withLayout({
    centerImage: true,
    scaleToFit: true,
    scalePercent: 640,
    marginIn: 2,
  }));
  const area = { width: A4_POINTS.width - 4 * 72, height: A4_POINTS.height - 4 * 72 };

  // The 640 % percentage is ignored in favour of the printable area, which is the
  // A4 page inset by two inches on every side and therefore 307.28 x 553.89 pt.
  assert.ok(area.width < captured.draws[0].width + TOLERANCE);
  assert.ok(captured.draws[0].width <= area.width + TOLERANCE, 'fits the printable width');
  assert.ok(captured.draws[0].height <= area.height + TOLERANCE, 'fits the printable height');
  assertDraw(captured.draws[0], { x: 144, y: 344.125, width: 307.28, height: 153.64 });
  assertClose(captured.draws[0].width / captured.draws[0].height, 2, 'aspect ratio');
});

test('ignores the margin when scale to fit is off', async () => {
  const withoutMargin = await capturePrint(withLayout({
    centerImage: false,
    scalePercent: 50,
    topIn: 1,
    leftIn: 1,
    marginIn: 0,
    scaleToFit: false,
  }));
  const withMargin = await capturePrint(withLayout({
    centerImage: false,
    scalePercent: 50,
    topIn: 1,
    leftIn: 1,
    marginIn: 3,
    scaleToFit: false,
  }));

  assertDraw(withMargin.draws[0], withoutMargin.draws[0]);
  assertDraw(withoutMargin.draws[0], { x: 72, y: 621.07, width: 297.64, height: 148.82 });
});

test('normalises a hostile layout record instead of composing an empty page', async () => {
  const hostile = {
    orientation: 'sideways',
    marginIn: 9e9,
    topIn: Number.NaN,
    leftIn: -9e9,
    scalePercent: 1e9,
    scaleToFit: 'yes',
    centerImage: undefined,
  };

  assert.deepEqual(sanitizePrintLayout(hostile), {
    orientation: 'portrait',
    marginIn: 4,
    topIn: 0,
    leftIn: -24,
    scalePercent: 640,
    scaleToFit: false,
    centerImage: true,
  });

  const captured = await capturePrint(withLayout(hostile as unknown as PrintJobLayout));
  const draw = captured.draws[0];

  assert.deepEqual(captured.pageSize, A4_POINTS);
  assert.equal(captured.options.orientation, undefined);
  assert.ok(draw.width > 0 && draw.height > 0, 'the document still has a printable size');
  assert.ok(draw.x >= 0 && draw.y >= 0);
  // 595.28 pt page-fitted source at the clamped 640 % ceiling.
  assertClose(draw.width, 595.28 * 6.4, 'clamped width');
});

test('rejects a layout record that is not an object', async () => {
  assert.equal(sanitizePrintLayout(undefined), null);
  assert.equal(sanitizePrintLayout(null), null);
  assert.equal(sanitizePrintLayout('landscape'), null);
  assert.equal(sanitizePrintLayout([{ orientation: 'landscape' }]), null);
  assert.equal(sanitizePrintLayout(42), null);
});

test('transposes a passport grid sheet without changing the copy geometry', async () => {
  const captured = await capturePrint(withLayout({ orientation: 'landscape' }, {
    serviceType: 'passport_photo',
    paperSize: 'Passport Grid (4-in-1)',
    gridCount: 4,
  }));

  assert.deepEqual(captured.pageSize, { width: 432, height: 288 });
  assert.equal(captured.options.paperSize, '4x6');
  assert.equal(captured.options.orientation, 'landscape');
  assert.equal(captured.draws.length, 4);
  for (const draw of captured.draws) {
    assertClose(draw.width, (35 / 25.4) * 72, 'copy width');
    assertClose(draw.height, (45 / 25.4) * 72, 'copy height');
    assert.ok(draw.x >= 0 && draw.x + draw.width <= 432 + TOLERANCE, 'copy stays on the sheet');
    assert.ok(draw.y >= 0 && draw.y + draw.height <= 288 + TOLERANCE, 'copy stays on the sheet');
  }
});

test('passes only the spooler orientation through for a customer PDF job', async () => {
  const captured = await capturePrint({
    ...createJob(await createPdfDataUrl()),
    printLayout: {
      orientation: 'landscape',
      marginIn: 2,
      centerImage: false,
      topIn: 1,
      leftIn: 1,
      scalePercent: 50,
      scaleToFit: true,
    },
  });

  // The customer's own pages are untouched: re-composing them would alter the
  // document, so only the spooler orientation applies.
  assert.equal(captured.pageCount, 1);
  assert.deepEqual(captured.pageSize, A4_POINTS);
  assert.equal(captured.draws.length, 0);
  assert.equal(captured.options.orientation, 'landscape');
});

test('still validates the uploaded file before honouring a layout', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'alif-shohoj-print-layout-invalid-'));
  let called = false;
  const service = new PrintService({
    userDataPath: directory,
    print: async () => { called = true; },
  });

  try {
    await assert.rejects(
      service.print({ ...createJob('https://example.com/private.png'), printLayout: { orientation: 'landscape' } }),
      /Unsupported print file/
    );
    assert.equal(called, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
