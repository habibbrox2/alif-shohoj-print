import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterPhysicalPrinterDetails,
  filterPhysicalPrinters,
  isVirtualPrinter,
  isVirtualPrinterDetail,
  toPrinterPageSize,
} from '../print-targets.js';

test('maps the 4x6 sheet to microns', () => {
  assert.deepEqual(toPrinterPageSize('4x6'), { width: 4 * 25400, height: 6 * 25400 });
});

test('keeps named paper sizes unchanged', () => {
  assert.equal(toPrinterPageSize('A4'), 'A4');
  assert.equal(toPrinterPageSize('Legal'), 'Legal');
});

test('detects virtual document printers', () => {
  assert.equal(isVirtualPrinter('Microsoft Print to PDF'), true);
  assert.equal(isVirtualPrinter('Microsoft XPS Document Writer'), true);
  assert.equal(isVirtualPrinter('OneNote (Desktop)'), true);
  assert.equal(isVirtualPrinter('Fax'), true);
  assert.equal(isVirtualPrinter('EPSON L220 Series'), false);
});

test('filters virtual printers from a printer list', () => {
  const printers = ['EPSON L220 Series', 'Microsoft Print to PDF', 'TOSHIBA e-STUDIO2523ASeries GDI'];
  assert.deepEqual(filterPhysicalPrinters(printers), ['EPSON L220 Series', 'TOSHIBA e-STUDIO2523ASeries GDI']);
});

test('detects virtual printers from port and driver metadata', () => {
  assert.equal(isVirtualPrinterDetail({ name: 'Adobe PDF', portName: 'Documents\\\\*.pdf', driverName: 'Adobe PDF Converter' }), true);
  assert.equal(isVirtualPrinterDetail({ name: 'Microsoft Print to PDF', portName: 'PORTPROMPT:', driverName: 'Microsoft Print To PDF' }), true);
  assert.equal(isVirtualPrinterDetail({ name: 'EPSON L220 Series', portName: 'USB001', driverName: 'EPSON L220 Series' }), false);
});

test('filters physical printers from printer details', () => {
  const details = [
    { name: 'EPSON L220 Series', portName: 'USB001', driverName: 'EPSON L220 Series' },
    { name: 'Microsoft Print to PDF', portName: 'PORTPROMPT:', driverName: 'Microsoft Print To PDF' },
  ];
  assert.deepEqual(filterPhysicalPrinterDetails(details).map(detail => detail.name), ['EPSON L220 Series']);
});