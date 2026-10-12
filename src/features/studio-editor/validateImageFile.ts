/**
 * Accepted MIME types for image files in the Studio editor.
 */
export const ACCEPTED_IMAGE_TYPES: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/bmp',
  'image/tiff',
] as const;

/**
 * Maximum allowed file size in bytes (50 MB).
 */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Validation result for an image file.
 */
export interface ImageFileValidationResult {
  /** True if the file is valid. */
  valid: boolean;
  /** Bengali reason string if invalid; undefined if valid. */
  reason?: string;
}

/**
 * Validate a file for use in the Studio editor.
 * Checks MIME type against accepted image types and file size against the 50 MB limit.
 * Returns a result object with a Bengali reason string on failure.
 */
export function validateImageFile(file: File): ImageFileValidationResult {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      reason: 'অবৈধ ফাইল টাইপ। শুধু ছবি ফাইল (JPG, PNG, WebP, BMP, TIFF) গ্রহণযোগ্য।',
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      reason: 'ফাইল আকার খুব বড়। সর্বোচ্চ ৫০ MB অনুমোদিত।',
    };
  }

  return { valid: true };
}

/**
 * Read a File as a data URL.
 * Returns the data URL string on success, throws on error.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}