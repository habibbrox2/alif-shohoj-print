import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorSnapshot } from '../strokeModel.js';
import { pushHistory, undo as undoHistory, redo as redoHistory, HISTORY_LIMIT } from '../editorHistory.js';

interface UseEditorHistoryOptions {
  onApplySnapshot: (snapshot: EditorSnapshot) => void;
  historyLimit?: number;
}

export function useEditorHistory({ onApplySnapshot, historyLimit = HISTORY_LIMIT }: UseEditorHistoryOptions) {
  const [history, setHistory] = useState<EditorSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const historyRef = useRef<EditorSnapshot[]>([]);
  const historyIndexRef = useRef<number>(-1);

  const resetHistory = useCallback((seed: EditorSnapshot) => {
    historyRef.current = [seed];
    historyIndexRef.current = 0;
    setHistory([seed]);
    setHistoryIndex(0);
  }, []);

  const pushSnapshot = useCallback((snapshot: EditorSnapshot, label?: string) => {
    const next = label ? { ...snapshot, label } : snapshot;
    if (next.timestamp === undefined) next.timestamp = Date.now();
    const result = pushHistory(historyRef.current, historyIndexRef.current, next, historyLimit);
    historyRef.current = result.history;
    historyIndexRef.current = result.index;
    setHistory(result.history);
    setHistoryIndex(result.index);
  }, [historyLimit]);

  const undo = useCallback(() => {
    const result = undoHistory(historyRef.current, historyIndexRef.current);
    if (!result) return false;
    historyRef.current = result.history;
    historyIndexRef.current = result.index;
    onApplySnapshot(result.history[result.index]);
    setHistory(result.history);
    setHistoryIndex(result.index);
    return true;
  }, [onApplySnapshot]);

  const redo = useCallback(() => {
    const result = redoHistory(historyRef.current, historyIndexRef.current);
    if (!result) return false;
    historyRef.current = result.history;
    historyIndexRef.current = result.index;
    onApplySnapshot(result.history[result.index]);
    setHistory(result.history);
    setHistoryIndex(result.index);
    return true;
  }, [onApplySnapshot]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < history.length - 1;

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  return {
    history,
    historyIndex,
    historyRef,
    historyIndexRef,
    resetHistory,
    pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    setHistory,
    setHistoryIndex,
  };
}
