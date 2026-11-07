import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from '../api/client';

interface Settled<T> {
  /** The request this result belongs to; loading is derived by comparing keys. */
  requestKey: string | null;
  data: T | null;
  error: unknown;
}

/**
 * Loads data with an abortable fetcher. Re-runs when `key` changes and can be
 * reloaded manually. Stale responses are ignored, and the previous data stays
 * available while a new request is in flight.
 */
export function useApiData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  key: string,
) {
  const [reloadCount, setReloadCount] = useState(0);
  const requestKey = `${key}#${reloadCount}`;
  const [settled, setSettled] = useState<Settled<T>>({
    requestKey: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetcher(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setSettled({ requestKey, data, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setSettled({ requestKey, data: null, error });
      });
    return () => controller.abort();
    // The fetcher is keyed by `requestKey` so callers can pass inline functions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const loading = settled.requestKey !== requestKey;
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  /** Replaces the loaded data after a successful mutation, without refetching. */
  const setData = useCallback(
    (data: T) => setSettled({ requestKey, data, error: null }),
    [requestKey],
  );

  return {
    data: settled.data,
    error: loading ? null : settled.error,
    loading,
    reload,
    setData,
  };
}
