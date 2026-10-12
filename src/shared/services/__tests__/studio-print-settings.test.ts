import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPUTE_DPI,
  DEFAULT_PRINT_SETTINGS,
  PRINT_SETTINGS_STORAGE_KEY,
  PAPER_SIZE_CHOICES,
  clampPrintMargin,
  clampPrintScale,
  computePrintLayout,
  getPaperDimensions,
  loadPrintSettings,
  savePrintSettings,
  settingsFromHeight,
  settingsFromScale,
  settingsFromWidth,
} from '../../../features/studio-editor/printSettings.js';
import type { PrintSettings } from '../../../features/studio-editor/printSettings.js';

/** A4 sheet rasterised at the repository's 300 DPI convention. */
const A4_PX = { w: 2480, h: 3508 };

/** 2400 × 3600 px is exactly 8 × 12 in at 300 DPI, so scale percentages stay exact. */
const DOC_PX = { w: 2400, h: 3600 };

const TOLERANCE = 1e-9;

function assertClose(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < TOLERANCE, `${label}: expected ${expected}, received ${actual}`);
}

function baseSettings(overrides: Partial<PrintSettings> = {}): PrintSettings {
  return { ...DEFAULT_PRINT_SETTINGS, ...overrides };
}

function fakeStorage(initial: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? (map.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
  };
}

function withStorage(storage: Storage | undefined, run: () => void): void {
  const holder = globalThis as { localStorage?: Storage };
  const original = holder.localStorage;
  try {
    if (storage) {
      holder.localStorage = storage;
    } else {
      delete holder.localStorage;
    }
    run();
  } finally {
    if (original) {
      holder.localStorage = original;
    } else {
      delete holder.localStorage;
    }
  }
}

test('getPaperDimensions returns A4 portrait inches and swaps for landscape', () => {
  assert.deepEqual(getPaperDimensions('A4 (8.27x11.69 in)', 'portrait'), {
    widthIn: 8.268,
    heightIn: 11.693,
  });
  assert.deepEqual(getPaperDimensions('A4 (8.27x11.69 in)', 'landscape'), {
    widthIn: 11.693,
    heightIn: 8.268,
  });
  assert.deepEqual(getPaperDimensions('Legal', 'portrait'), { widthIn: 8.5, heightIn: 14 });
  assert.deepEqual(getPaperDimensions('Legal', 'landscape'), { widthIn: 14, heightIn: 8.5 });
});

test('computePrintLayout derives document size from 300 DPI pixels and scale', () => {
  const layout = computePrintLayout(baseSettings({ centerImage: false }), A4_PX);

  assertClose(layout.docWidthIn, A4_PX.w / COMPUTE_DPI, 'document width');
  assertClose(layout.docHeightIn, A4_PX.h / COMPUTE_DPI, 'document height');
  assert.equal(layout.scalePercent, 100);
  assert.deepEqual(layout.paper, { widthIn: 8.268, heightIn: 11.693 });
  assert.deepEqual(layout.printable, { widthIn: 7.768, heightIn: 11.193 });

  const half = computePrintLayout(
    baseSettings({ centerImage: false, scalePercent: 50 }),
    A4_PX
  );
  assertClose(half.docWidthIn, A4_PX.w / COMPUTE_DPI / 2, 'half-scale width');
  assertClose(half.docHeightIn, A4_PX.h / COMPUTE_DPI / 2, 'half-scale height');
  assert.equal(half.scalePercent, 50);
});

test('computePrintLayout centers the document when centerImage is set', () => {
  const half = computePrintLayout(baseSettings({ scalePercent: 50 }), A4_PX);

  assertClose(half.leftIn, (8.268 - A4_PX.w / COMPUTE_DPI / 2) / 2, 'centred left');
  assertClose(half.topIn, (11.693 - A4_PX.h / COMPUTE_DPI / 2) / 2, 'centred top');
  assert.ok(half.leftIn > 0 && half.topIn > 0, 'a half-scale sheet still leaves insets');

  // Stored offsets are ignored while centring is on.
  const ignored = computePrintLayout(baseSettings({ scalePercent: 50, topIn: 9, leftIn: 9 }), A4_PX);
  assertClose(ignored.leftIn, half.leftIn, 'stored left ignored');
  assertClose(ignored.topIn, half.topIn, 'stored top ignored');
});

test('computePrintLayout honors explicit top and left when not centered', () => {
  const layout = computePrintLayout(
    baseSettings({ centerImage: false, topIn: 1.5, leftIn: 0.75 }),
    A4_PX
  );

  assert.equal(layout.topIn, 1.5);
  assert.equal(layout.leftIn, 0.75);
});

test('computePrintLayout fits to the printable area when scaleToFit is set', () => {
  // The borderless sheet is exactly the natural A4 size, so fit resolves to 100 %.
  const portraitFit = computePrintLayout(
    baseSettings({ centerImage: false, marginIn: 0, scaleToFit: true }),
    A4_PX
  );
  assertClose(portraitFit.scalePercent, (11.693 / (A4_PX.h / COMPUTE_DPI)) * 100, 'portrait fit scale');
  assertClose(portraitFit.docHeightIn, 11.693, 'height fills the sheet');

  // On a landscape A4 sheet the short axis binds.
  const landscapeFit = computePrintLayout(
    baseSettings({ orientation: 'landscape', centerImage: false, marginIn: 0, scaleToFit: true }),
    A4_PX
  );
  assertClose(landscapeFit.scalePercent, (8.268 / (A4_PX.h / COMPUTE_DPI)) * 100, 'landscape fit scale');
  assertClose(landscapeFit.docHeightIn, landscapeFit.paper.heightIn, 'landscape fit height');
  assert.ok(landscapeFit.docWidthIn <= landscapeFit.printable.widthIn + TOLERANCE, 'width fits');

  // With margins the printable area, not the sheet, is the limit.
  const marginFit = computePrintLayout(
    baseSettings({ centerImage: false, marginIn: 0.5, scaleToFit: true }),
    A4_PX
  );
  assertClose(marginFit.docWidthIn, marginFit.printable.widthIn, 'width fills the printable area');
  assert.ok(marginFit.docHeightIn <= marginFit.printable.heightIn + TOLERANCE, 'height fits');
});

test('settingsFromHeight and settingsFromWidth rescale keeping aspect ratio', () => {
  const natural = computePrintLayout(baseSettings({ centerImage: false }), DOC_PX);
  const fromHeight = settingsFromHeight(baseSettings(), DOC_PX, 6);
  const fromWidth = settingsFromWidth(baseSettings(), DOC_PX, 4);

  assert.equal(fromHeight.scalePercent, 50);
  assert.equal(fromWidth.scalePercent, 50);
  assert.equal(fromHeight.paperSize, DEFAULT_PRINT_SETTINGS.paperSize);
  assert.equal(fromWidth.orientation, DEFAULT_PRINT_SETTINGS.orientation);

  const scaled = computePrintLayout({ ...baseSettings({ centerImage: false }), ...fromHeight }, DOC_PX);
  assertClose(scaled.docHeightIn, 6, 'requested height');
  assertClose(scaled.docWidthIn / scaled.docHeightIn, natural.docWidthIn / natural.docHeightIn, 'aspect ratio');

  // Height and width are derived from the scale, never stored as separate fields.
  assert.deepEqual(Object.keys(fromHeight).sort(), Object.keys(DEFAULT_PRINT_SETTINGS).sort());

  assert.equal(settingsFromScale(baseSettings(), 400).scalePercent, 400);
  assert.equal(settingsFromScale(baseSettings(), 0).scalePercent, 1);
  assert.equal(settingsFromScale(baseSettings(), 5000).scalePercent, 640);
  assert.equal(clampPrintScale(-3), 1);
  assert.equal(clampPrintScale(640), 640);
  assert.equal(settingsFromHeight(baseSettings(), DOC_PX, 0).scalePercent, 1);
  assert.equal(settingsFromWidth(baseSettings(), DOC_PX, 999).scalePercent, 640);
  assert.equal(clampPrintMargin(-4), 0);
  assert.equal(clampPrintMargin(9), 4);
});

test('loadPrintSettings falls back to defaults for missing or invalid stored values', () => {
  assert.equal(PRINT_SETTINGS_STORAGE_KEY, 'alif-shohoj-print-studio-print-settings');

  withStorage(undefined, () => {
    assert.deepEqual(loadPrintSettings(), DEFAULT_PRINT_SETTINGS);
  });

  withStorage(fakeStorage({ [PRINT_SETTINGS_STORAGE_KEY]: '{ not json' }), () => {
    assert.deepEqual(loadPrintSettings(), DEFAULT_PRINT_SETTINGS);
  });

  withStorage(fakeStorage({ [PRINT_SETTINGS_STORAGE_KEY]: '42' }), () => {
    assert.deepEqual(loadPrintSettings(), DEFAULT_PRINT_SETTINGS);
  });

  withStorage(
    fakeStorage({
      [PRINT_SETTINGS_STORAGE_KEY]: JSON.stringify({
        paperSize: 'Custom',
        orientation: 'sideways',
        marginIn: 99,
        centerImage: 'yes',
        topIn: 'nope',
        leftIn: 12,
        scalePercent: -5,
        scaleToFit: 1,
        showBoundingBox: false,
      }),
    }),
    () => {
      const recovered = loadPrintSettings();
      assert.equal(recovered.paperSize, DEFAULT_PRINT_SETTINGS.paperSize);
      assert.equal(recovered.orientation, DEFAULT_PRINT_SETTINGS.orientation);
      assert.equal(recovered.marginIn, 4);
      assert.equal(recovered.centerImage, DEFAULT_PRINT_SETTINGS.centerImage);
      assert.equal(recovered.topIn, DEFAULT_PRINT_SETTINGS.topIn);
      assert.equal(recovered.leftIn, 12);
      assert.equal(recovered.scalePercent, 1);
      assert.equal(recovered.scaleToFit, DEFAULT_PRINT_SETTINGS.scaleToFit);
      assert.equal(recovered.showBoundingBox, false);
    }
  );

  withStorage(
    fakeStorage({
      [PRINT_SETTINGS_STORAGE_KEY]: JSON.stringify({
        paperSize: 'Legal',
        orientation: 'landscape',
        marginIn: 0.5,
        centerImage: false,
        topIn: 1,
        leftIn: 2,
        scalePercent: 250,
        scaleToFit: true,
        showBoundingBox: true,
      }),
    }),
    () => {
      const stored = loadPrintSettings();
      assert.deepEqual(stored, {
        paperSize: 'Legal',
        orientation: 'landscape',
        marginIn: 0.5,
        centerImage: false,
        topIn: 1,
        leftIn: 2,
        scalePercent: 250,
        scaleToFit: true,
        showBoundingBox: true,
      });
    }
  );

  // A storage implementation that throws must behave like "no storage".
  const blocked: Storage = {
    ...fakeStorage({}),
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
  };
  withStorage(blocked, () => {
    assert.deepEqual(loadPrintSettings(), DEFAULT_PRINT_SETTINGS);
    assert.doesNotThrow(() => savePrintSettings(DEFAULT_PRINT_SETTINGS));
  });

  const writable = fakeStorage({});
  withStorage(writable, () => {
    savePrintSettings(baseSettings({ scalePercent: 125 }));
    assert.deepEqual(JSON.parse(writable.getItem(PRINT_SETTINGS_STORAGE_KEY) as string), {
      ...DEFAULT_PRINT_SETTINGS,
      scalePercent: 125,
    });
    assert.equal(loadPrintSettings().scalePercent, 125);
  });

  // 'Custom' is not offered: the print service rejects it.
  const choices = PAPER_SIZE_CHOICES as ReadonlyArray<string>;
  assert.equal(choices.includes('Custom'), false);
  assert.equal(choices.includes('Legal'), true);
});
