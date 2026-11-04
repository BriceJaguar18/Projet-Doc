import { useCallback, useEffect, useRef, useState } from 'react';
import { local } from '../data/safeStorage';

/**
 * Petit « bip » joué quand une nouvelle commande arrive.
 * Les navigateurs n'autorisent le son qu'après un premier appui sur l'écran :
 * le son se déverrouille au premier toucher.
 */
export function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(() => local.get('kiosque-son') !== 'off');

  useEffect(() => {
    const unlock = () => {
      if (!ctxRef.current) {
        try {
          ctxRef.current = new AudioContext();
        } catch {
          return;
        }
      }
      void ctxRef.current.resume();
    };
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  const beep = useCallback(() => {
    const ctx = ctxRef.current;
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    [0, 0.18].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t + offset);
      gain.gain.exponentialRampToValueAtTime(0.4, t + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + offset);
      osc.stop(t + offset + 0.16);
    });
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((e) => {
      local.set('kiosque-son', e ? 'off' : 'on');
      return !e;
    });
  }, []);

  return { beep, enabled, toggle };
}

/** Appelle `onNew` quand un identifiant inconnu apparaît (après le premier chargement). */
export function useOnNewIds(ids: string[], ready: boolean, onNew: (newIds: string[]) => void) {
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (!seen.current) {
      seen.current = new Set(ids);
      return;
    }
    const fresh = ids.filter((id) => !seen.current!.has(id));
    fresh.forEach((id) => seen.current!.add(id));
    if (fresh.length) onNew(fresh);
  }, [ids, ready, onNew]);
}
