import type { EditorSnapshot, Stroke } from './strokeModel.js';
export type { EditorSnapshot } from './strokeModel.js';

/** Maximum number of history entries to keep. */
export const HISTORY_LIMIT = 50;

/**
 * Push a new snapshot onto the history, truncating any redo tail and capping at HISTORY_LIMIT.
 * Returns the new history array and the new index.
 */
export function pushHistory(
  history: EditorSnapshot[],
  index: number,
  next: EditorSnapshot,
  limit = HISTORY_LIMIT
): { history: EditorSnapshot[]; index: number } {
  // Truncate any redo tail (entries after the current index)
  const truncated = history.slice(0, index + 1);
  // Append the new snapshot
  const appended = [...truncated, next];
  // Cap at limit
  const capped = appended.slice(-limit);
  // New index is the last entry
  const newIndex = Math.min(capped.length - 1, limit - 1);
  return { history: capped, index: newIndex };
}

/**
 * Move the history index back one step (undo).
 * Returns the new history array and new index, or null if at the beginning.
 */
export function undo(
  history: EditorSnapshot[],
  index: number
): { history: EditorSnapshot[]; index: number } | null {
  if (index <= 0) return null;
  return { history, index: index - 1 };
}

/**
 * Move the history index forward one step (redo).
 * Returns the new history array and new index, or null if at the end.
 */
export function redo(
  history: EditorSnapshot[],
  index: number
): { history: EditorSnapshot[]; index: number } | null {
  if (index >= history.length - 1) return null;
  return { history, index: index + 1 };
}