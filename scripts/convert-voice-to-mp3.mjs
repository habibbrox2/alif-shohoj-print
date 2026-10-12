#!/usr/bin/env node
/**
 * Convert generated voice-guide WAV clips to MP3 (64 kbps mono) and point
 * public/audio/manifest.json at the .mp3 files.
 *
 * Needs ffmpeg on PATH (winget install Gyan.FFmpeg). Run in a fresh
 * terminal after installing:  npm run voice:mp3
 *
 * Usage:
 *   npm run voice:mp3                  convert every .wav in the manifest
 *   npm run voice:mp3 -- --dry-run     list what would be converted
 *   npm run voice:mp3 -- --only C01,VC04 convert a subset
 *   npm run voice:mp3 -- --keep-wav    keep the .wav files afterwards
 */

import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(ROOT, 'public');
const APP_MANIFEST_PATH = join(PUBLIC_DIR, 'audio', 'manifest.json');

const rawArgs = process.argv.slice(2);
const hasFlag = name => rawArgs.includes(name);
const flagValue = name => {
  for (let i = 0; i < rawArgs.length; i += 1) {
    if (rawArgs[i] === name) return rawArgs[i + 1] ?? null;
    if (rawArgs[i].startsWith(`${name}=`)) return rawArgs[i].slice(name.length + 1);
  }
  return null;
};
const DRY_RUN = hasFlag('--dry-run');
const KEEP_WAV = hasFlag('--keep-wav');
const ONLY = new Set(
  (flagValue('--only') || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean),
);

async function main() {
  try {
    await execFileAsync('ffmpeg', ['-version']);
  } catch {
    console.error('ffmpeg not found on PATH. Install it first: winget install Gyan.FFmpeg');
    console.error('Then open a fresh terminal and re-run this command.');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(APP_MANIFEST_PATH, 'utf8'));
  let jobs = manifest.clips.filter(clip => clip.file.endsWith('.wav'));
  if (ONLY.size > 0) jobs = jobs.filter(clip => ONLY.has(clip.id.toUpperCase()));
  if (jobs.length === 0) {
    console.log('Nothing to convert: no .wav entries match.');
    return;
  }
  console.log(`${jobs.length} clips to convert to MP3 (64 kbps mono).`);
  if (DRY_RUN) {
    for (const clip of jobs) console.log(`  ${clip.id} [${clip.lang}] ${clip.file}`);
    return;
  }

  let failed = 0;
  for (const clip of jobs) {
    const wavPath = join(PUBLIC_DIR, clip.file);
    const mp3File = clip.file.replace(/\.wav$/, '.mp3');
    const mp3Path = join(PUBLIC_DIR, mp3File);
    if (!existsSync(wavPath)) {
      console.error(`  SKIP ${clip.id}: missing ${clip.file}`);
      failed += 1;
      continue;
    }
    try {
      await execFileAsync('ffmpeg', [
        '-y', '-v', 'error', '-i', wavPath, '-ac', '1', '-b:a', '64k', mp3Path,
      ]);
      clip.file = mp3File;
      if (!KEEP_WAV) rmSync(wavPath);
      console.log(`  ok ${clip.id} [${clip.lang}]`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${clip.id}: ${error.message}`);
    }
  }

  writeFileSync(APP_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Manifest updated: ${manifest.clips.length} entries.`);
  if (!KEEP_WAV) console.log('Source .wav files removed (re-run voice:clips to regenerate).');
  if (failed > 0) process.exit(1);
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
