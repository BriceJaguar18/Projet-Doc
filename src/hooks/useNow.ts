import { useEffect, useState } from 'react';

/** Heure courante, rafraîchie régulièrement (pour l'horloge et les alertes de retard). */
export function useNow(intervalMs = 10_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
