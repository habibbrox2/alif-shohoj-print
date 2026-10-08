import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import type { PrintJob } from '../../../src/shared/types.js';
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
  const directory = mkdtempSync(join(tmpdir(), 'broxprint-print-'));
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
  const directory = mkdtempSync(join(tmpdir(), 'broxprint-print-invalid-'));
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
  const directory = mkdtempSync(join(tmpdir(), 'broxprint-passport-grid-'));
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
