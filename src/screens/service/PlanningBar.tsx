import { useEffect, useMemo, useRef, useState } from 'react';
import { useKiosk } from '../../KioskContext';
import { Stepper } from '../../components/ui';
import {
  fromMinutes,
  loadLevel,
  pizzaSlot,
  quotaFor,
  slotLoad,
  slotOf,
  slotsForDay,
  toMinutes,
} from '../../domain/rules';

/** Bandeau des créneaux de 10 min : pizzas prévues / maximum, réglable au toucher. */
export function PlanningBar() {
  const { day, date, nowMin, store, run } = useKiosk();
  const { settings, dayQuotas, orders } = day;
  const [editing, setEditing] = useState<string | null>(null);
  const currentSlot = slotOf(fromMinutes(nowMin));
  const scroller = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => {
    const list = slotsForDay(settings.openingHours);
    // Créneaux hors horaires mais qui contiennent des pizzas.
    for (const o of orders)
      for (const p of Object.values(o.pizzas)) {
        const s = pizzaSlot(o, p);
        if (!list.includes(s)) list.push(s);
      }
    return list.sort((a, b) => toMinutes(a) - toMinutes(b));
  }, [settings.openingHours, orders]);

  useEffect(() => {
    // Fait défiler le bandeau pour montrer le créneau en cours (avec le précédent).
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('.slot-current, .slot-future');
    if (box && el) box.scrollLeft = Math.max(0, el.offsetLeft - 96);
  }, [day.ready, currentSlot]);

  const editQuota = editing ? quotaFor(editing, settings, dayQuotas) : null;
  const editLoad = editing ? slotLoad(orders, editing) : null;
  const setQuota = (q: number | null) => editing && run(store.setSlotQuota(date, editing, q));

  return (
    <section className="planning" aria-label="Planning de production">
      <div className="planning-scroll" ref={scroller}>
        {slots.map((slot) => {
          const quota = quotaFor(slot, settings, dayQuotas);
          const load = slotLoad(orders, slot);
          const level = loadLevel(load.total, quota);
          const past = toMinutes(slot) + 10 <= nowMin;
          const cls = [
            'slot',
            `level-${level}`,
            slot === currentSlot ? 'slot-current' : past ? 'slot-past' : 'slot-future',
            dayQuotas[slot] !== undefined ? 'slot-custom' : '',
          ].join(' ');
          return (
            <button key={slot} className={cls} onClick={() => setEditing(slot)} data-testid={`slot-${slot}`}>
              <span className="slot-time">{slot}</span>
              <span className="slot-count">
                {load.total}/{quota}
              </span>
              <span className="slot-sizes">{load.total > 0 ? `${load.G} G · ${load.P} P` : 'libre'}</span>
            </button>
          );
        })}
      </div>

      {editing && editQuota !== null && editLoad && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal modal-small" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>
              Créneau {editing} – {fromMinutes(toMinutes(editing) + 10)}
            </h2>
            <p className="muted">Nombre maximum de pizzas sur ce créneau, toutes tailles confondues.</p>
            <div className="quota-edit">
              <label>Pizzas maximum</label>
              <Stepper label="pizzas" value={editQuota} onChange={(n) => setQuota(n)} />
            </div>
            <p className="muted">
              Déjà prévues : {editLoad.total} pizza(s) ({editLoad.G} grande(s), {editLoad.P} petite(s)). Maximum par
              défaut : {settings.defaultQuota}.
            </p>
            <div className="modal-actions">
              {dayQuotas[editing] !== undefined && (
                <button className="btn btn-ghost btn-lg" onClick={() => setQuota(null)}>
                  Revenir au défaut
                </button>
              )}
              <button className="btn btn-primary btn-lg" onClick={() => setEditing(null)}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
