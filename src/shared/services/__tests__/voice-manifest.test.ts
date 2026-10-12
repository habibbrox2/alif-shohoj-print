import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');
const spec = JSON.parse(readFileSync(join(ROOT, 'voice-manifest.json'), 'utf8'));

const allClips = [...spec.customer.clips, ...(spec.commands?.clips ?? []), ...spec.shop.clips];

test('every voice clip has Bengali and English text', () => {
  assert.ok((spec.commands?.clips ?? []).length === 12, 'expected 12 voice-command feedback clips');
  for (const clip of allClips) {
    assert.ok(clip.text?.bn?.trim(), `${clip.id} is missing Bengali text`);
    assert.ok(clip.text?.en?.trim(), `${clip.id} is missing English text`);
    assert.ok(/\.(mp3|wav)$/.test(clip.file), `${clip.id} must reference an mp3 or wav file`);
  }
});

test('voice clip ids are unique and retired ids are disjoint', () => {
  const ids = allClips.map(clip => clip.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate clip id found');
  for (const retired of spec.customer.retiredIds ?? []) {
    assert.ok(!ids.includes(retired), `${retired} is both active and retired`);
  }
});

test('generated app manifest matches the VoiceGuideClip shape', () => {
  const appManifest = JSON.parse(readFileSync(join(ROOT, 'public/audio/manifest.json'), 'utf8'));
  assert.ok(Array.isArray(appManifest.clips));
  for (const clip of appManifest.clips) {
    assert.ok(typeof clip.id === 'string');
    assert.ok(typeof clip.text_bn === 'string' && clip.text_bn.length > 0);
    assert.ok(['bn', 'en'].includes(clip.lang));
    assert.ok(typeof clip.file === 'string' && /\.(mp3|wav)$/.test(clip.file));
  }
});
