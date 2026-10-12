#!/usr/bin/env node
/**
 * Generate Bengali + English voice-guide MP3 clips.
 *
 * Provider model mirrors the create-voice-agent skill's TTS providers:
 *   - `google` (default): free Google Translate TTS, no key needed. MP3 output.
 *   - `sarvam`: Sarvam `bulbul:v3` with Bengali `bn-IN` support (needs
 *     SARVAM_API_KEY). WAV output — set when better Bengali quality matters.
 *   - `elevenlabs` (opt-in): ElevenLabs `eleven_multilingual_v2`, needs
 *     ELEVENLABS_API_KEY plus per-language voice ids.
 * (Skill-local providers such as SherpaOnnx/Qwen need local models or
 * private endpoints, so they are documented here but not wired in.)
 *
 * Source of truth: <repo>/voice-manifest.json (versioned clip texts).
 * Output (served from Vite `public/`):
 *   public/audio/bn/C01.mp3 … C27.mp3   customer Bengali clips
 *   public/audio/en/C01.mp3 … C27.mp3   customer English clips
 *   public/audio/bn/VC01.mp3 … VC12.mp3 voice-command feedback (Bengali)
 *   public/audio/en/VC01.mp3 … VC12.mp3 voice-command feedback (English)
 *   public/sounds/S01.mp3 … S06.mp3     shop Bengali clips
 *   public/sounds/en/S01.mp3 … S06.mp3  shop English clips
 *   public/audio/manifest.json          regenerated app manifest
 *
 * The app keeps working without clips: VoiceGuideService falls back to the
 * on-device Web Speech TTS. Clips only make the voice consistent and instant.
 *
 * Usage:
 *   npm run voice:clips                  generate everything missing
 *   npm run voice:clips -- --force       regenerate all clips
 *   npm run voice:clips -- --lang bn      Bengali clips only
 *   npm run voice:clips -- --only C01,VC04 regenerate a subset (both langs)
 *   npm run voice:clips -- --dry-run     list clips without downloading
 *   npm run voice:clips -- --provider elevenlabs --eleven-voice-bn <id>
 *     --eleven-voice-en <id>             premium voices (needs ELEVENLABS_API_KEY)
 *   SARVAM_API_KEY=... npm run voice:clips -- --provider sarvam
 *     --sarvam-speaker kavya             natural Bengali voice (WAV output)
 *   Pace/pitch shape the delivery (bulbul v3 pitch range is -0.5..0.5):
 *   serious clips default to pace 0.85 / pitch -0.3, success clips to
 *   0.97 / +0.2, the rest to 0.92 / 0. `-- --pace X --pitch Y` overrides all.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_PATH = join(ROOT, 'voice-manifest.json');
const PUBLIC_DIR = join(ROOT, 'public');
const APP_MANIFEST_PATH = join(PUBLIC_DIR, 'audio', 'manifest.json');
const APP_MANIFEST_VERSION = '1.2.0';

const GOOGLE_TTS_URL = 'https://translate.google.com/translate_tts';
const ELEVENLABS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const CHUNK_LIMIT = 180;
const CONCURRENCY = 2;
const REQUEST_DELAY_MS = 400;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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
const FORCE = hasFlag('--force');
const LANG_FILTER = (flagValue('--lang') || 'all').toLowerCase();
const PROVIDER = (flagValue('--provider') || 'google').toLowerCase();
const ELEVEN_VOICE_BN = flagValue('--eleven-voice-bn') || null;
const ELEVEN_VOICE_EN = flagValue('--eleven-voice-en') || '21m00Tcm4TlvDq8ikWAM';
const SARVAM_SPEAKER = flagValue('--sarvam-speaker') || 'kavya';
const SARVAM_MODEL = flagValue('--sarvam-model') || 'bulbul:v3';
// Speaking pace/pitch. Defaults implement the voice-quality guide:
// slightly slower than 1.0 for clear articulation; serious clips slower and
// lower (গাম্ভীর্য), success clips a touch brighter (উৎসাহ). Explicit flags
// apply to every clip and disable the mood table.
const PACE_FLAG = flagValue('--pace') === null ? null : Number(flagValue('--pace'));
const PITCH_FLAG = flagValue('--pitch') === null ? null : Number(flagValue('--pitch'));
// bulbul v3/v4 pitch range is [-0.5, 0.5]; pace 0.5-2.0.
const SERIOUS_CLIPS = new Set(['C09', 'C19', 'C20', 'C21', 'C24', 'C25', 'S02', 'S03', 'S04', 'S05', 'S06']);
const WARM_CLIPS = new Set(['C01', 'C08', 'C15', 'C17', 'C18', 'C23', 'C27', 'VC11']);

function prosodyFor(id) {
  if (PACE_FLAG !== null || PITCH_FLAG !== null) {
    return { pace: PACE_FLAG ?? 0.92, pitch: PITCH_FLAG ?? 0 };
  }
  if (SERIOUS_CLIPS.has(id)) return { pace: 0.85, pitch: -0.3 };
  if (WARM_CLIPS.has(id)) return { pace: 0.97, pitch: 0.2 };
  return { pace: 0.92, pitch: 0 };
}
// Sarvam returns WAV (no ffmpeg/MP3 encoder on a stock Windows agent PC),
// so sarvam runs write .wav siblings; other providers keep .mp3.
const OUT_EXT = PROVIDER === 'sarvam' ? 'wav' : 'mp3';
const OTHER_EXT = OUT_EXT === 'wav' ? 'mp3' : 'wav';
const ONLY = new Set(
  (flagValue('--only') || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean),
);

if (!['all', 'bn', 'en'].includes(LANG_FILTER)) {
  console.error('Expected --lang=all|bn|en.');
  process.exit(1);
}
if (!['google', 'elevenlabs', 'sarvam'].includes(PROVIDER)) {
  console.error('Expected --provider=google|elevenlabs|sarvam.');
  process.exit(1);
}
if ((PACE_FLAG !== null && !(PACE_FLAG >= 0.5 && PACE_FLAG <= 2)) ||
    (PITCH_FLAG !== null && !(PITCH_FLAG >= -0.5 && PITCH_FLAG <= 0.5))) {
  console.error('Expected --pace 0.5-2.0 and --pitch -0.5-0.5 (bulbul v3 range).');
  process.exit(1);
}
if (PROVIDER === 'sarvam' && !process.env.SARVAM_API_KEY) {
  console.error('Sarvam needs SARVAM_API_KEY in the environment (see https://dashboard.sarvam.ai).');
  process.exit(1);
}
if (PROVIDER === 'elevenlabs') {
  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('ElevenLabs needs ELEVENLABS_API_KEY in the environment.');
    process.exit(1);
  }
  if (LANG_FILTER !== 'en' && !ELEVEN_VOICE_BN) {
    console.error('ElevenLabs needs --eleven-voice-bn <voice-id> for Bengali clips.');
    process.exit(1);
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function pushSection(jobs, clips, paths, lang = LANG_FILTER) {
  for (const clip of clips) {
    const file = clip.file.replace(/\.mp3$/, `.${OUT_EXT}`);
    if (lang !== 'en') {
      jobs.push({
        id: clip.id,
        lang: 'bn',
        text: clip.text.bn,
        out: join(PUBLIC_DIR, paths.bnDir, file),
        publicFile: `${paths.bnDir}/${file}`.replace(/\\/g, '/'),
      });
    }
    if (lang !== 'bn' && clip.text.en) {
      jobs.push({
        id: clip.id,
        lang: 'en',
        text: clip.text.en,
        out: join(PUBLIC_DIR, paths.enDir, file),
        publicFile: `${paths.enDir}/${file}`.replace(/\\/g, '/'),
      });
    }
  }
}

function buildJobs(spec, filters = {}) {
  const lang = filters.lang ?? LANG_FILTER;
  const only = filters.only ?? ONLY;
  const jobs = [];
  const push = (clips, paths) => pushSection(jobs, clips, paths, lang);
  push(spec.customer.clips, { bnDir: 'audio/bn', enDir: 'audio/en' });
  if (Array.isArray(spec.commands?.clips)) {
    push(spec.commands.clips, { bnDir: 'audio/bn', enDir: 'audio/en' });
  }
  // Shop Bengali clips keep the legacy `sounds/Sxx.mp3` path.
  push(spec.shop.clips, { bnDir: 'sounds', enDir: 'sounds/en' });
  return only.size > 0 ? jobs.filter(job => only.has(job.id.toUpperCase())) : jobs;
}

// Google caps a single request around 200 characters, so split long texts
// at sentence or word boundaries and concatenate the MP3 frames afterwards.
function splitIntoChunks(text) {
  if (text.length <= CHUNK_LIMIT) return [text];
  const chunks = [];
  const sentences = text.split(/(?<=[।.!?])\s+/);
  let current = '';
  for (const sentence of sentences) {
    if ((`${current} ${sentence}`.trim()).length <= CHUNK_LIMIT) {
      current = `${current} ${sentence}`.trim();
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= CHUNK_LIMIT) {
      current = sentence;
      continue;
    }
    const words = sentence.split(/\s+/);
    current = '';
    for (const word of words) {
      if ((`${current} ${word}`.trim()).length <= CHUNK_LIMIT) {
        current = `${current} ${word}`.trim();
      } else {
        if (current) chunks.push(current);
        current = word;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

async function fetchGoogleChunk(text, lang) {
  const url = `${GOOGLE_TTS_URL}?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.status === 429) {
        await sleep(2000 * attempt);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) throw new Error('Received empty audio.');
      return buffer;
    } catch (error) {
      lastError = error;
      await sleep(1000 * attempt);
    }
  }
  throw lastError ?? new Error('TTS request failed.');
}

async function fetchElevenLabs(text, lang) {
  const voiceId = lang === 'bn' ? ELEVEN_VOICE_BN : ELEVEN_VOICE_EN;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${ELEVENLABS_URL}/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });
      if (response.status === 429) {
        await sleep(2000 * attempt);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length === 0) throw new Error('Received empty audio.');
      return buffer;
    } catch (error) {
      lastError = error;
      await sleep(1000 * attempt);
    }
  }
  throw lastError ?? new Error('ElevenLabs request failed.');
}

async function fetchSarvam(text, lang, prosody = { pace: 0.92, pitch: 0 }) {
  // Per the sarvam-ai skill: bulbul model, bn-IN/en-IN codes, base64 WAV.
  const target_language_code = lang === 'bn' ? 'bn-IN' : 'en-IN';
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'api-subscription-key': process.env.SARVAM_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          target_language_code,
          speaker: SARVAM_SPEAKER,
          model: SARVAM_MODEL,
          speech_sample_rate: 16000,
          pace: prosody.pace,
          pitch: prosody.pitch,
        }),
      });
      if (response.status === 429) {
        await sleep(2000 * attempt);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const buffer = Buffer.from(data.audios[0], 'base64');
      if (buffer.length === 0) throw new Error('Received empty audio.');
      return buffer;
    } catch (error) {
      lastError = error;
      await sleep(1000 * attempt);
    }
  }
  throw lastError ?? new Error('Sarvam request failed.');
}

async function synthesize(text, lang, prosody) {
  if (PROVIDER === 'sarvam') {
    const audio = await fetchSarvam(text, lang, prosody ?? { pace: 0.92, pitch: 0 });
    await sleep(REQUEST_DELAY_MS);
    return audio;
  }
  if (PROVIDER === 'elevenlabs') {
    const audio = await fetchElevenLabs(text, lang);
    await sleep(REQUEST_DELAY_MS);
    return audio;
  }
  const parts = [];
  for (const chunk of splitIntoChunks(text)) {
    parts.push(await fetchGoogleChunk(chunk, lang));
    await sleep(REQUEST_DELAY_MS);
  }
  return Buffer.concat(parts);
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf8'));
  const jobs = buildJobs(spec);
  if (jobs.length === 0) {
    console.log('No clips match the given filters.');
    return;
  }

  const filterNote = ONLY.size > 0 ? `, only=${[...ONLY].join(',')}` : '';
  console.log(`Voice clips: ${jobs.length} jobs (provider=${PROVIDER}, lang=${LANG_FILTER}${filterNote}${FORCE ? ', force' : ''}).`);
  if (DRY_RUN) {
    for (const job of jobs) console.log(`  ${job.id} [${job.lang}] ${job.publicFile} — ${job.text}`);
    return;
  }

  const pending = jobs.filter(job => FORCE || !existsSync(job.out) || statSync(job.out).size === 0);
  console.log(`${pending.length} to synthesise, ${jobs.length - pending.length} already exist.`);

  let failed = 0;
  await runWithConcurrency(pending, CONCURRENCY, async job => {
    try {
      const audio = await synthesize(job.text, job.lang, prosodyFor(job.id));
      mkdirSync(dirname(job.out), { recursive: true });
      writeFileSync(job.out, audio);
      // Drop the stale sibling from a previous provider run (mp3 <-> wav).
      const sibling = job.out.replace(new RegExp(`\\.${OUT_EXT}$`), `.${OTHER_EXT}`);
      if (existsSync(sibling)) {
        rmSync(sibling);
        console.log(`  removed stale ${sibling.split(/[\\/]/).slice(-2).join('/')}`);
      }
      console.log(`  ok ${job.id} [${job.lang}] ${(audio.length / 1024).toFixed(1)} KB`);
    } catch (error) {
      failed += 1;
      console.error(`  FAIL ${job.id} [${job.lang}]: ${error.message}`);
    }
  });

  // Regenerate the app manifest only when at least one clip is on disk, so a
  // fully failed run never clobbers the last good manifest.
  const byId = new Map();
  for (const clip of [...spec.customer.clips, ...(spec.commands?.clips ?? []), ...spec.shop.clips]) {
    byId.set(clip.id, clip);
  }
  // The manifest covers every clip on disk (unfiltered), so subset runs never
  // drop entries generated by earlier runs.
  const clips = [];
  for (const job of buildJobs(spec, { lang: 'all', only: new Set() })) {
    if (!existsSync(job.out) || statSync(job.out).size === 0) continue;
    const source = byId.get(job.id);
    clips.push({
      id: job.id,
      text_bn: source.text.bn,
      ...(source.text.en ? { text_en: source.text.en } : {}),
      file: job.publicFile,
      lang: job.lang,
    });
  }
  if (clips.length > 0) {
    mkdirSync(dirname(APP_MANIFEST_PATH), { recursive: true });
    writeFileSync(APP_MANIFEST_PATH, `${JSON.stringify({ version: APP_MANIFEST_VERSION, clips }, null, 2)}\n`);
    console.log(`Manifest written: public/audio/manifest.json (${clips.length} entries).`);
  } else {
    console.log('No clips on disk; keeping the existing public/audio/manifest.json.');
  }

  if (failed > 0) {
    console.error(`${failed} clip(s) failed. Re-run the same command to retry only the missing files.`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});
