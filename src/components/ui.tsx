import type { ReactNode } from 'react';
import { useKiosk } from '../KioskContext';
import { BASE_LABEL, type OrderAlert } from '../domain/rules';
import type { Pizza } from '../domain/types';

export function Clock() {
  const { now } = useKiosk();
  return (
    <span className="clock" data-testid="clock">
      {now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export function TopBar(props: { title: string; children?: ReactNode }) {
  const { store, connection } = useKiosk();
  return (
    <>
      <header className="topbar">
        <div className="topbar-title">
          <span className="logo" aria-hidden>
            🍕
          </span>
          <h1>{props.title}</h1>
          <Clock />
          <span className={`conn conn-${connection}`} title="État de la connexion">
            {connection === 'online' ? 'Synchronisé' : connection === 'pending' ? 'Envoi…' : 'Hors ligne'}
          </span>
        </div>
        <div className="topbar-actions">{props.children}</div>
      </header>
      {store.kind === 'demo' && (
        <div className="banner banner-demo">
          MODE DÉMO — les données restent sur cet appareil (synchronisation entre onglets uniquement).
        </div>
      )}
      {connection === 'offline' && (
        <div className="banner banner-offline" role="alert">
          Pas d'internet : les changements sont gardés sur cette tablette et partiront automatiquement au retour de la
          connexion. L'autre tablette ne les voit pas encore.
        </div>
      )}
    </>
  );
}

export function Segmented<T extends string | boolean>(props: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  label?: string;
  testId?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={props.label} data-testid={props.testId}>
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={o.value === props.value ? 'on' : ''}
          aria-pressed={o.value === props.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper(props: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const { value, min = 0, max = 99 } = props;
  return (
    <div className="stepper" aria-label={props.label}>
      <button
        type="button"
        aria-label={`Moins ${props.label ?? ''}`}
        disabled={value <= min}
        onClick={() => props.onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button
        type="button"
        aria-label={`Plus ${props.label ?? ''}`}
        disabled={value >= max}
        onClick={() => props.onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function AlertBadge({ alert }: { alert: OrderAlert }) {
  if (!alert) return null;
  if (alert.kind === 'retard')
    return (
      <span className="badge badge-retard" data-testid="badge-retard">
        ⚠ RETARD +{alert.minutes} min
      </span>
    );
  return (
    <span className="badge badge-bientot" data-testid="badge-bientot">
      À lancer · retrait dans {alert.minutes} min
    </span>
  );
}

export function OriginBadge({ origin }: { origin: string }) {
  const cls = origin.toLowerCase().replace(/[^a-z]/g, '');
  return <span className={`badge badge-origin origin-${cls}`}>{origin}</span>;
}

/** Détails d'une pizza : base, suppléments, retraits, changement. */
export function PizzaDetails({ pizza }: { pizza: Pizza }) {
  return (
    <span className="pizza-details">
      <span className={`base base-${pizza.base}`}>Base {BASE_LABEL[pizza.base]}</span>
      {pizza.supplements.map((s) => (
        <span key={`+${s}`} className="supp">
          + {s}
        </span>
      ))}
      {pizza.removed.map((s) => (
        <span key={`-${s}`} className="removed">
          − {s}
        </span>
      ))}
      {pizza.note && <span className="change">✎ {pizza.note}</span>}
    </span>
  );
}

/** Coupée / Olives : affichés systématiquement. */
export function PizzaOptions({ pizza, big }: { pizza: Pizza; big?: boolean }) {
  return (
    <span className={`pizza-options ${big ? 'big' : ''}`}>
      <span className={`opt ${pizza.cut ? 'opt-yes' : 'opt-no'}`}>{pizza.cut ? 'COUPÉE' : 'NON COUPÉE'}</span>
      <span className={`opt ${pizza.olives ? 'opt-yes' : 'opt-no'}`}>{pizza.olives ? 'OLIVES' : 'SANS OLIVES'}</span>
    </span>
  );
}
