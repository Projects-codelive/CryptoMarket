import { useState, useEffect, useCallback, useRef } from 'react';

export function usePaginatedFetch(fetchFn, params) {
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Stable string key so useEffect only re-runs when params actually change
  const paramsKey = JSON.stringify(params);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn(params);
      if (!isMounted.current) return;
      // Support both { trades, total } and { history, total } shapes
      const rows = res.trades ?? res.history ?? [];
      setData(rows);
      setTotal(res.total ?? rows.length);
    } catch (err) {
      if (!isMounted.current) return;
      setError(err.response?.data?.message || 'Failed to load data.');
      setData([]);
      setTotal(0);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, total, loading, error, refresh: fetch };
}
