import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { withDefaults } from './domain/defaultSettings';
import { localISODate, nowMinutes } from './domain/rules';
import type { Role } from './domain/types';
import type { AuthApi, ConnectionState, DaySnapshot, Store } from './data/store';
import { useNow } from './hooks/useNow';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error';
}

interface ConfirmRequest {
  message: string;
  confirmLabel: string;
  resolve: (ok: boolean) => void;
}

export interface Kiosk {
  store: Store;
  auth: AuthApi;
  role: Role;
  /** Jour de service affiché (AAAA-MM-JJ). */
  date: string;
  day: DaySnapshot;
  now: Date;
  /** Minutes écoulées depuis minuit. */
  nowMin: number;
  connection: ConnectionState;
  toast: (text: string, kind?: Toast['kind']) => void;
  /** Lance une écriture sans bloquer l'écran ; affiche un message si elle échoue. */
  run: (p: Promise<unknown>) => void;
  confirm: (message: string, confirmLabel?: string) => Promise<boolean>;
}

const Ctx = createContext<Kiosk | null>(null);

export function useKiosk(): Kiosk {
  const k = useContext(Ctx);
  if (!k) throw new Error('useKiosk hors du KioskProvider');
  return k;
}

const EMPTY_DAY: DaySnapshot = { orders: [], settings: withDefaults(null), dayQuotas: {}, ready: false };

export function KioskProvider(props: { store: Store; auth: AuthApi; role: Role; children: ReactNode }) {
  const { store, auth, role } = props;
  const now = useNow();
  const date = localISODate(now);
  const [day, setDay] = useState<DaySnapshot>(EMPTY_DAY);
  const [connection, setConnection] = useState<ConnectionState>('online');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const toastId = useRef(0);

  useEffect(() => store.subscribeDay(date, setDay), [store, date]);
  useEffect(() => store.subscribeConnection(setConnection), [store]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 8000 : 3000);
  }, []);

  const run = useCallback(
    (p: Promise<unknown>) => {
      p.catch((err: unknown) => {
        console.error(err);
        const code = (err as { code?: string })?.code ?? '';
        toast(
          code.includes('permission')
            ? "Action refusée : cette tablette n'a pas le droit de faire ça."
            : "L'enregistrement a échoué. Vérifiez la connexion internet.",
          'error',
        );
      });
    },
    [toast],
  );

  const confirm = useCallback(
    (message: string, confirmLabel = 'Confirmer') =>
      new Promise<boolean>((resolve) => setConfirmReq({ message, confirmLabel, resolve })),
    [],
  );

  const value = useMemo<Kiosk>(
    () => ({ store, auth, role, date, day, now, nowMin: nowMinutes(now), connection, toast, run, confirm }),
    [store, auth, role, date, day, now, connection, toast, run, confirm],
  );

  const answer = (ok: boolean) => {
    confirmReq?.resolve(ok);
    setConfirmReq(null);
  };

  return (
    <Ctx.Provider value={value}>
      {props.children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
      {confirmReq && (
        <div className="modal-backdrop" onClick={() => answer(false)}>
          <div className="modal modal-small" role="dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">{confirmReq.message}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost btn-lg" onClick={() => answer(false)}>
                Annuler
              </button>
              <button className="btn btn-primary btn-lg" onClick={() => answer(true)}>
                {confirmReq.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
