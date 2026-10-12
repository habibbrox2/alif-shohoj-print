import assert from 'node:assert/strict';
import test from 'node:test';
import { validateImageFile, ACCEPTED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES } from '../../../features/studio-editor/validateImageFile.js';

function makeFile(type: string, size: number): File {
  return new File([new Uint8Array(size)], 'test.jpg', { type });
}

test('ACCEPTED_IMAGE_TYPES contains the expected MIME types', () => {
  assert.deepEqual([...ACCEPTED_IMAGE_TYPES].sort(), [
    'image/bmp',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp',
  ]);
});

test('MAX_FILE_SIZE_BYTES is 50 MB', () => {
  assert.equal(MAX_FILE_SIZE_BYTES, 50 * 1024 * 1024);
});

test('validateImageFile accepts valid JPEG under size limit', () => {
  const result = validateImageFile(makeFile('image/jpeg', 1024));
  assert.equal(result.valid, true);
  assert.equal(result.reason, undefined);
});

test('validateImageFile accepts valid PNG under size limit', () => {
  const result = validateImageFile(makeFile('image/png', 1024));
  assert.equal(result.valid, true);
});

test('validateImageFile accepts valid WebP under size limit', () => {
  const result = validateImageFile(makeFile('image/webp', 1024));
  assert.equal(result.valid, true);
});

test('validateImageFile accepts valid BMP under size limit', () => {
  const result = validateImageFile(makeFile('image/bmp', 1024));
  assert.equal(result.valid, true);
});

test('validateImageFile accepts valid TIFF under size limit', () => {
  const result = validateImageFile(makeFile('image/tiff', 1024));
  assert.equal(result.valid, true);
});

test('validateImageFile rejects invalid MIME type with Bengali reason', () => {
  const result = validateImageFile(makeFile('application/pdf', 1024));
  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes('অবৈধ ফাইল টাইপ'));
});

test('validateImageFile rejects oversized file with Bengali reason', () => {
  const result = validateImageFile(makeFile('image/jpeg', MAX_FILE_SIZE_BYTES + 1));
  assert.equal(result.valid, false);
  assert.ok(result.reason?.includes('ফাইল আকার খুব বড়'));
});

test('validateImageFile accepts file exactly at 50 MB limit', () => {
  const result = validateImageFile(makeFile('image/jpeg', MAX_FILE_SIZE_BYTES));
  assert.equal(result.valid, true);
});