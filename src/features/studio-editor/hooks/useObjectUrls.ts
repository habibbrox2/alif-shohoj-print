import { useCallback, useEffect, useRef } from 'react';

export function useObjectUrls() {
  const urlsRef = useRef<Set<string>>(new Set());

  const track = useCallback((url: string): string => {
    if (url?.startsWith('blob:')) {
      urlsRef.current.add(url);
    }
    return url;
  }, []);

  const revoke = useCallback((url?: string | null) => {
    if (!url?.startsWith('blob:')) return;
    try {
      URL.revokeObjectURL(url);
    } catch {}
    urlsRef.current.delete(url);
  }, []);

  const revokeAll = useCallback(() => {
    for (const url of urlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
    urlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      revokeAll();
    };
  }, [revokeAll]);

  return { track, revoke, revokeAll, urlsRef };
}
