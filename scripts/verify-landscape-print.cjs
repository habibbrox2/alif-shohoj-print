const { app, BrowserWindow } = require('electron');
const { PDFDocument } = require('pdf-lib');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

async function makePdf(width, height) {
  const pdf = await PDFDocument.create();
  pdf.addPage([width, height]);
  return Buffer.from(await pdf.save());
}

app.whenReady().then(async () => {
  let exitCode = 0;
  try {
    const inputPath = path.join(os.tmpdir(), 'landscape-input.pdf');
    const outputPath = path.join(os.tmpdir(), 'landscape-output.pdf');
    // A portrait source page: the print step must rotate it to landscape.
    fs.writeFileSync(inputPath, await makePdf(595.28, 841.89));

    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true } });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('load timeout')), 20000);
      win.webContents.once('did-finish-load', () => { clearTimeout(t); resolve(); });
      win.webContents.once('did-fail-load', (_e, code, desc) => { clearTimeout(t); reject(new Error(desc)); });
      win.loadFile(inputPath);
    });

    const data = await win.webContents.printToPDF({
      pageSize: 'A4',
      landscape: true,
      printBackground: true,
    });
    fs.writeFileSync(outputPath, data);

    const outDoc = await PDFDocument.load(fs.readFileSync(outputPath));
    const page = outDoc.getPage(0);
    const { width, height } = page.getSize();
    console.log(`OUTPUT_PAGE_SIZE: ${width} x ${height}`);
    if (!(width > height)) {
      throw new Error(`Expected landscape output, got ${width} x ${height}`);
    }
    console.log('LANDSCAPE PRINT VERIFIED');

    // Optional real-printer smoke test when VERIFY_PRINTER is set.
    const printer = process.env.VERIFY_PRINTER;
    if (printer) {
      await new Promise((resolve, reject) => {
        win.webContents.print({ silent: true, deviceName: printer, copies: 1, pageSize: 'A4', landscape: true }, (ok, reason) => {
          if (ok) resolve(); else reject(new Error(reason || 'print failed'));
        });
      });
      console.log(`REAL PRINTER PRINT OK: ${printer}`);
    }
  } catch (err) {
    console.error('VERIFY ERROR:', err && err.stack ? err.stack : err);
    exitCode = 1;
  }
  app.exit(exitCode);
});