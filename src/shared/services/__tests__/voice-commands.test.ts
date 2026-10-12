import assert from 'node:assert/strict';
import test from 'node:test';
import { getVoiceCommandHints, isVoiceCommandSupported, matchVoiceCommand, normalizeTranscript } from '../voiceCommands.js';

test('normalizes transcripts (case, punctuation, spacing)', () => {
  assert.equal(normalizeTranscript('  পরের ধাপ। '), 'পরের ধাপ');
  assert.equal(normalizeTranscript('Next Step!'), 'next step');
});

test('matches Bengali customer commands', () => {
  assert.equal(matchVoiceCommand('পরের ধাপ'), 'next');
  assert.equal(matchVoiceCommand('কনফার্ম করো'), 'confirm');
  assert.equal(matchVoiceCommand('কপি বাড়াও'), 'copies_up');
  assert.equal(matchVoiceCommand('কপি কমাও'), 'copies_down');
  assert.equal(matchVoiceCommand('রঙিন'), 'color');
  assert.equal(matchVoiceCommand('সাদা কালো'), 'bw');
  assert.equal(matchVoiceCommand('আবার বলো'), 'replay');
  assert.equal(matchVoiceCommand('সাহায্য'), 'help');
  assert.equal(matchVoiceCommand('থামো'), 'stop');
});

test('matches English customer commands', () => {
  assert.equal(matchVoiceCommand('next step'), 'next');
  assert.equal(matchVoiceCommand('confirm order'), 'confirm');
  assert.equal(matchVoiceCommand('more copies'), 'copies_up');
  assert.equal(matchVoiceCommand('fewer copies'), 'copies_down');
  assert.equal(matchVoiceCommand('black and white'), 'bw');
  assert.equal(matchVoiceCommand('say again'), 'replay');
});

test('matches shop inbox commands in both languages', () => {
  assert.equal(matchVoiceCommand('অনুমোদন করো'), 'approve');
  assert.equal(matchVoiceCommand('approve order'), 'approve');
  assert.equal(matchVoiceCommand('বাতিল করো'), 'reject');
  assert.equal(matchVoiceCommand('reject order'), 'reject');
});

test('matches commands inside longer sentences', () => {
  assert.equal(matchVoiceCommand('দয়া করে পরের ধাপে যাও'), 'next');
  assert.equal(matchVoiceCommand('please go back'), 'back');
});

test('returns null for unknown or empty input', () => {
  assert.equal(matchVoiceCommand(''), null);
  assert.equal(matchVoiceCommand('আজ আবহাওয়া কেমন'), null);
  assert.equal(matchVoiceCommand('hello world printer'), null);
});

test('provides localized hints and reports unsupported recognition in node', () => {
  assert.equal(getVoiceCommandHints('bn').length, 12);
  assert.equal(getVoiceCommandHints('en').length, 12);
  assert.equal(isVoiceCommandSupported(), false);
});
