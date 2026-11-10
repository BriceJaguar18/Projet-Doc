import { useCallback, useMemo, useState } from 'react';
import { useKiosk } from '../../KioskContext';
import { AlertBadge, OriginBadge, PizzaDetails, PizzaOptions, TopBar } from '../../components/ui';
import {
  SIZE_LABEL,
  byPickup,
  fromMinutes,
  kitchenBack,
  kitchenNext,
  orderAlert,
  pizzaSlot,
  quotaFor,
  slotLoad,
  sortedPizzas,
  toMinutes,
} from '../../domain/rules';
import type { Order, Pizza, PizzaStatus } from '../../domain/types';
import { useBeep, useOnNewIds } from '../../hooks/useBeep';
import { useWakeLock } from '../../hooks/useWakeLock';

const NEXT_LABEL: Partial<Record<PizzaStatus, string>> = {
  attente: 'Lancer préparation',
  preparation: 'Au four',
};

const BACK_LABEL: Partial<Record<PizzaStatus, string>> = {
  four: '↩ Retour préparation',
  preparation: '↩ Annuler',
};

export function KitchenScreen() {
  const { day, auth, store } = useKiosk();
  useWakeLock();
  const { beep, enabled: soundOn, toggle: toggleSound } = useBeep();
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  // Commandes à produire : non récupérées, avec au moins une pizza pas encore prête.
  const todo = useMemo(
    () =>
      day.orders
        .filter((o) => !o.collected && sortedPizzas(o).some((p) => p.status !== 'prete'))
        .sort(byPickup),
    [day.orders],
  );

  // Une colonne par créneau de production. Une commande dont des pizzas ont basculé sur le
  // créneau suivant apparaît dans les deux colonnes, chacune avec ses pizzas.
  const groups = useMemo(() => {
    const map = new Map<string, Array<{ order: Order; pizzas: Pizza[] }>>();
    for (const o of todo) {
      const bySlot = new Map<string, Pizza[]>();
      for (const p of sortedPizzas(o)) {
        const s = pizzaSlot(o, p);
        bySlot.set(s, [...(bySlot.get(s) ?? []), p]);
      }
      for (const [slot, pizzas] of bySlot) {
        if (pizzas.every((p) => p.status === 'prete')) continue;
        map.set(slot, [...(map.get(slot) ?? []), { order: o, pizzas }]);
      }
    }
    return [...map.entries()].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
  }, [todo]);

  const ids = useMemo(() => day.orders.map((o) => o.id), [day.orders]);
  const onNew = useCallback(
    (newIds: string[]) => {
      beep();
      setFresh((s) => new Set([...s, ...newIds]));
      setTimeout(
        () =>
          setFresh((s) => {
            const n = new Set(s);
            newIds.forEach((id) => n.delete(id));
            return n;
          }),
        15000,
      );
    },
    [beep],
  );
  useOnNewIds(ids, day.ready, onNew);

  const pizzaCount = todo.reduce((n, o) => n + sortedPizzas(o).filter((p) => p.status !== 'prete').length, 0);

  return (
    <div className="screen screen-kitchen">
      <TopBar title="Cuisine">
        <span className="muted big">{pizzaCount} pizza(s) à faire</span>
        <button className="btn btn-ghost btn-lg" onClick={toggleSound}>
          {soundOn ? '🔔 Son activé' : '🔕 Son coupé'}
        </button>
        {store.kind === 'firebase' && (
          <button className="btn btn-ghost" onClick={() => void auth.signOut()} title="Déconnecter la tablette">
            ⏏
          </button>
        )}
      </TopBar>

      <main className="kitchen">
        {!day.ready && <p className="empty">Chargement…</p>}
        {day.ready && todo.length === 0 && <p className="empty big">Rien à préparer pour le moment 👌</p>}
        {groups.map(([slot, entries]) => {
          const load = slotLoad(day.orders, slot);
          const quota = quotaFor(slot, day.settings, day.dayQuotas);
          return (
            <section key={slot} className="kitchen-slot" data-testid={`kitchen-slot-${slot}`}>
              <h2 className="kitchen-slot-head">
                <span>
                  {slot} – {fromMinutes(toMinutes(slot) + 10)}
                </span>
                <small>
                  {load.total}/{quota} pizzas · {load.G} G · {load.P} P
                </small>
              </h2>
              <div className="ticket-stack">
                {entries.map(({ order, pizzas }) => (
                  <Ticket key={order.id} order={order} pizzas={pizzas} slot={slot} fresh={fresh.has(order.id)} />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function Ticket(props: { order: Order; pizzas: Pizza[]; slot: string; fresh: boolean }) {
  const { order, pizzas, slot, fresh } = props;
  const { store, run, nowMin, day } = useKiosk();
  const alert = orderAlert(order, nowMin, day.settings.preAlertMinutes, pizzas);
  // Autres créneaux de la même commande (pizzas reportées ou déjà faites avant).
  const elsewhere = [...new Set(sortedPizzas(order).map((p) => pizzaSlot(order, p)))]
    .filter((s) => s !== slot)
    .map((s) => ({ slot: s, count: sortedPizzas(order).filter((p) => pizzaSlot(order, p) === s).length }));
  const waiting = pizzas.filter((p) => p.status === 'attente');
  const preparing = pizzas.filter((p) => p.status === 'preparation');
  const setAll = (list: Pizza[], status: PizzaStatus) =>
    run(
      store.setPizzaStatuses(
        order.id,
        list.map((p) => p.id),
        status,
      ),
    );

  return (
    <article
      className={`ticket ${alert ? `alert-${alert.kind}` : ''} ${fresh ? 'fresh' : ''}`}
      data-testid={`ticket-${order.customerName}`}
      data-slot={slot}
    >
      <header className="ticket-head">
        <span className="pickup">{order.pickupTime}</span>
        <span className="customer">{order.customerName}</span>
        <OriginBadge origin={order.origin} />
        {fresh && <span className="badge badge-new">NOUVELLE</span>}
        <AlertBadge alert={alert} />
      </header>
      {elsewhere.length > 0 && (
        <p className="ticket-split">
          Même commande : {elsewhere.map((e) => `${e.count} pizza(s) sur ${e.slot}`).join(', ')}
        </p>
      )}

      <ul className="ticket-pizzas">
        {pizzas.map((p) => {
          const next = kitchenNext(p.status);
          const back = kitchenBack(p.status);
          return (
            <li key={p.id} className={`ticket-pizza status-${p.status}`} data-testid="kitchen-pizza" data-status={p.status}>
              <div className="ticket-pizza-info">
                <div className="ticket-pizza-title">
                  <span className={`size size-${p.size}`}>{p.size}</span>
                  <span>
                    {p.name} <small>({SIZE_LABEL[p.size]})</small>
                  </span>
                </div>
                <PizzaDetails pizza={p} />
                <PizzaOptions pizza={p} big />
              </div>
              <div className="ticket-pizza-actions">
                {p.status === 'four' && <span className="state-label">AU FOUR</span>}
                {p.status === 'prete' && <span className="state-label">PRÊTE ✓</span>}
                {next && (
                  <button
                    className={`btn btn-xl btn-next-${next}`}
                    onClick={() => run(store.setPizzaStatuses(order.id, [p.id], next))}
                  >
                    {NEXT_LABEL[p.status]}
                  </button>
                )}
                {back && (
                  <button
                    className="btn btn-ghost btn-back"
                    onClick={() => run(store.setPizzaStatuses(order.id, [p.id], back))}
                  >
                    {BACK_LABEL[p.status]}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {(waiting.length > 1 || preparing.length > 1) && (
        <footer className="ticket-foot">
          {waiting.length > 1 && (
            <button className="btn btn-lg btn-next-preparation" onClick={() => setAll(waiting, 'preparation')}>
              Tout lancer ({waiting.length})
            </button>
          )}
          {preparing.length > 1 && (
            <button className="btn btn-lg btn-next-four" onClick={() => setAll(preparing, 'four')}>
              Tout au four ({preparing.length})
            </button>
          )}
        </footer>
      )}
    </article>
  );
}
