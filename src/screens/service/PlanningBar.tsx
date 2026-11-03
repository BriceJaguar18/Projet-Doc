import { useEffect, useMemo, useRef, useState } from 'react';
import { useKiosk } from '../../KioskContext';
import { Stepper } from '../../components/ui';
import { fromMinutes, loadLevel, quotaFor, slotLoad, slotOf, slotsForDay, toMinutes } from '../../domain/rules';
import type { Quota } from '../../domain/types';

/** Bandeau des créneaux de 10 min : charge / quota, réglable au toucher. */
export function PlanningBar() {
  const { day, date, nowMin, store, run } = useKiosk();
  const { settings, dayQuotas, orders } = day;
  const [editing, setEditing] = useState<string | null>(null);
  const currentSlot = slotOf(fromMinutes(nowMin));
  const scroller = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => {
    const list = slotsForDay(settings.openingHours);
    // Créneaux hors horaires mais qui contiennent des commandes.
    for (const o of orders) if (!list.includes(o.slot)) list.push(o.slot);
    return list.sort((a, b) => toMinutes(a) - toMinutes(b));
  }, [settings.openingHours, orders]);

  useEffect(() => {
    // Fait défiler le bandeau pour montrer le créneau en cours (avec le précédent).
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('.slot-current, .slot-future');
    if (box && el) box.scrollLeft = Math.max(0, el.offsetLeft - 96);
  }, [day.ready, currentSlot]);

  const editQuota = editing ? quotaFor(editing, settings, dayQuotas) : null;
  const setQuota = (q: Quota | null) => editing && run(store.setSlotQuota(date, editing, q));

  return (
    <section className="planning" aria-label="Planning de production">
      <div className="planning-scroll" ref={scroller}>
        {slots.map((slot) => {
          const quota = quotaFor(slot, settings, dayQuotas);
          const load = slotLoad(orders, slot);
          const level = loadLevel(load, quota);
          const past = toMinutes(slot) + 10 <= nowMin;
          const cls = [
            'slot',
            `level-${level}`,
            slot === currentSlot ? 'slot-current' : past ? 'slot-past' : 'slot-future',
            dayQuotas[slot] ? 'slot-custom' : '',
          ].join(' ');
          return (
            <button key={slot} className={cls} onClick={() => setEditing(slot)} data-testid={`slot-${slot}`}>
              <span className="slot-time">{slot}</span>
              <span className="slot-load">
                G {load.G}/{quota.G}
              </span>
              <span className="slot-load">
                P {load.P}/{quota.P}
              </span>
            </button>
          );
        })}
      </div>

      {editing && editQuota && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal modal-small" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>
              Créneau {editing} – {fromMinutes(toMinutes(editing) + 10)}
            </h2>
            <p className="muted">Nombre maximum de pizzas sur ce créneau (selon l'affluence).</p>
            <div className="quota-edit">
              <label>Grandes</label>
              <Stepper label="grandes" value={editQuota.G} onChange={(G) => setQuota({ ...editQuota, G })} />
              <label>Petites</label>
              <Stepper label="petites" value={editQuota.P} onChange={(P) => setQuota({ ...editQuota, P })} />
            </div>
            <p className="muted">
              Réservé : {slotLoad(orders, editing).G} grande(s), {slotLoad(orders, editing).P} petite(s). Quota par
              défaut : {settings.defaultQuota.G} G / {settings.defaultQuota.P} P.
            </p>
            <div className="modal-actions">
              {dayQuotas[editing] && (
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
