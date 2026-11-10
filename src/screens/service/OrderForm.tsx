import { useMemo, useState } from 'react';
import { useKiosk } from '../../KioskContext';
import { Segmented, Stepper } from '../../components/ui';
import { formatPrice, itemPrice, orderTotal, priceItem, pricePizza } from '../../domain/pricing';
import {
  BASE_LABEL,
  STATUS_LABEL,
  fromMinutes,
  newId,
  pizzaSlot,
  planPizzas,
  quotaFor,
  requestedTimeOf,
  slotLoad,
  slotOf,
  slotsForDay,
  sortedPizzas,
  toMinutes,
} from '../../domain/rules';
import type { MenuPizza, Order, OtherCategory, OtherItem, Pizza } from '../../domain/types';
import { PizzaEditor } from './PizzaEditor';

interface Draft {
  customerName: string;
  origin: string;
  /** Heure demandée par le client. */
  pickupTime: string | null;
  paid: boolean;
  note: string;
  pizzas: Pizza[];
  items: OtherItem[];
}

const CATEGORIES: Array<{ key: OtherCategory; label: string; menuKey: 'boissons' | 'kiosquitos' | 'desserts' }> = [
  { key: 'boisson', label: 'Boissons', menuKey: 'boissons' },
  { key: 'kiosquito', label: 'Kiosquitos', menuKey: 'kiosquitos' },
  { key: 'dessert', label: 'Desserts', menuKey: 'desserts' },
];

export function OrderForm({ initial, onClose }: { initial: Order | null; onClose: () => void }) {
  const { day, date, nowMin, store, run, toast } = useKiosk();
  const { settings, dayQuotas, orders } = day;

  const [draft, setDraft] = useState<Draft>(() =>
    initial
      ? {
          customerName: initial.customerName,
          origin: initial.origin,
          pickupTime: requestedTimeOf(initial),
          paid: initial.paid,
          note: initial.note,
          pizzas: sortedPizzas(initial),
          items: initial.items,
        }
      : {
          customerName: '',
          origin: settings.origins[0] ?? 'Comptoir',
          pickupTime: null,
          paid: false,
          note: '',
          pizzas: [],
          items: [],
        },
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [customPizza, setCustomPizza] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  /* ---------------------------- Créneaux ---------------------------- */

  const need = draft.pizzas.length;
  const selectedSlot = draft.pickupTime ? slotOf(draft.pickupTime) : null;
  const slots = useMemo(() => {
    const list = slotsForDay(settings.openingHours).filter((s) => toMinutes(s) + 10 > nowMin);
    if (selectedSlot && !list.includes(selectedSlot)) list.push(selectedSlot);
    return list.sort((a, b) => toMinutes(a) - toMinutes(b));
  }, [settings.openingHours, nowMin, selectedSlot]);

  /** Places libres sur un créneau, sans compter cette commande. */
  const freeIn = (slot: string) =>
    quotaFor(slot, settings, dayQuotas) - slotLoad(orders, slot, initial?.id ?? undefined).total;

  // En modification, une pizza déjà lancée en cuisine garde son créneau.
  const pinned: Record<string, string> = {};
  if (initial) {
    for (const p of Object.values(initial.pizzas)) {
      if (p.status !== 'attente') pinned[p.id] = pizzaSlot(initial, p);
    }
  }
  const planArgs = draft.pickupTime
    ? { orders, settings, dayQuotas, requestedTime: draft.pickupTime, pizzas: draft.pizzas, pinned, excludeOrderId: initial?.id }
    : null;
  const plan = planArgs ? planPizzas(planArgs) : null;
  const forcedPlan = planArgs ? planPizzas({ ...planArgs, force: true }) : null;

  const pricedPizzas = draft.pizzas.map((p) => pricePizza(p, settings));
  const pricedItems = draft.items.map((it) => priceItem(it, settings));
  const total = orderTotal({ pizzas: Object.fromEntries(pricedPizzas.map((p) => [p.id, p])), items: pricedItems });

  /* ----------------------------- Pizzas ----------------------------- */

  const addPizza = (menu: MenuPizza | { name: string; base: 'tomate' }, custom = false) => {
    const p: Pizza = {
      id: newId(),
      position: draft.pizzas.length,
      name: menu.name,
      size: 'G',
      base: menu.base,
      supplements: [],
      removed: [],
      note: '',
      cut: settings.defaultCut,
      olives: settings.defaultOlives,
      status: 'attente',
      ...(custom ? { custom: true, basePrice: 0 } : {}),
    };
    set({ pizzas: [...draft.pizzas, p] });
    setExpanded(p.id);
  };

  const updatePizza = (id: string, patch: Partial<Pizza>) =>
    set({ pizzas: draft.pizzas.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const duplicatePizza = (p: Pizza) => {
    const copy = { ...p, id: newId(), status: 'attente' as const };
    const idx = draft.pizzas.findIndex((x) => x.id === p.id);
    const list = [...draft.pizzas];
    list.splice(idx + 1, 0, copy);
    set({ pizzas: list });
  };

  const removePizza = (id: string) => set({ pizzas: draft.pizzas.filter((p) => p.id !== id) });

  /* -------------------------- Autres ventes -------------------------- */

  const qtyOf = (category: OtherCategory, name: string) =>
    draft.items.find((i) => i.category === category && i.name === name)?.qty ?? 0;

  const setQty = (category: OtherCategory, name: string, qty: number) => {
    const others = draft.items.filter((i) => !(i.category === category && i.name === name));
    set({ items: qty > 0 ? [...others, { category, name, qty }] : others });
  };

  /* ---------------------------- Validation ---------------------------- */

  const submit = (force: boolean) => {
    const errs: string[] = [];
    if (!draft.customerName.trim()) errs.push('Indiquez le nom du client.');
    if (!draft.pickupTime) errs.push("Choisissez l'heure de retrait.");
    if (draft.pizzas.length === 0 && draft.items.length === 0) errs.push('Ajoutez au moins un produit.');
    setErrors(errs);
    const chosen = force ? forcedPlan : plan;
    if (errs.length || !draft.pickupTime || !chosen) return;

    const pizzas = Object.fromEntries(
      pricedPizzas.map((p, i) => [p.id, { ...p, position: i, slot: chosen.slots[p.id] }]),
    );
    const items = CATEGORIES.flatMap((c) => pricedItems.filter((i) => i.category === c.key));
    const content = {
      customerName: draft.customerName.trim(),
      origin: draft.origin,
      requestedTime: draft.pickupTime,
      pickupTime: chosen.pickupTime,
      slot: slotOf(draft.pickupTime),
      paid: draft.paid,
      note: draft.note.trim(),
      pizzas,
      items,
    };

    if (initial) {
      run(store.updateOrder(initial, { ...initial, ...content }));
      toast('Commande modifiée');
    } else {
      run(store.createOrder({ id: newId(), serviceDate: date, collected: false, createdAt: Date.now(), ...content }));
      toast(
        chosen.pickupTime !== draft.pickupTime
          ? `Commande de ${content.customerName} enregistrée : retrait à ${chosen.pickupTime}`
          : `Commande de ${content.customerName} enregistrée`,
      );
    }
    onClose();
  };

  const menuNames = new Set(settings.menu.pizzas.map((p) => p.name));

  return (
    <div className="modal-backdrop">
      <div className="modal modal-full" role="dialog" aria-label={initial ? 'Modifier la commande' : 'Nouvelle commande'}>
        <header className="modal-head">
          <h2>{initial ? `Modifier la commande de ${initial.customerName}` : 'Nouvelle commande'}</h2>
          <button className="btn btn-ghost btn-lg" onClick={onClose}>
            Annuler
          </button>
        </header>

        <div className="modal-body form">
          {/* ------------------------------ Client ------------------------------ */}
          <section className="form-section form-grid-2">
            <div>
              <h3>Nom du client</h3>
              <input
                className="input-lg"
                placeholder="Nom"
                value={draft.customerName}
                autoComplete="off"
                onChange={(e) => set({ customerName: e.target.value })}
                data-testid="input-name"
              />
            </div>
            <div>
              <h3>Origine</h3>
              <Segmented
                label="Origine"
                value={draft.origin}
                options={[...new Set([...settings.origins, draft.origin])].map((o) => ({ value: o, label: o }))}
                onChange={(origin) => set({ origin })}
              />
            </div>
          </section>

          {/* ------------------------------ Retrait ----------------------------- */}
          <section className="form-section">
            <h3>
              Heure de retrait
              {draft.pickupTime && <span className="chosen-time"> : {draft.pickupTime}</span>}
            </h3>
            {slots.length === 0 && (
              <p className="muted">
                Plus aucun créneau aujourd'hui dans les horaires d'ouverture : indiquez l'heure dans « Autre heure ».
              </p>
            )}
            <div className="slot-grid">
              {slots.map((slot) => {
                const free = freeIn(slot);
                const fit = need > 0 && free >= need ? 'fits' : free > 0 ? 'partial' : 'full';
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`slot-pick ${fit} ${slot === selectedSlot ? 'on' : ''}`}
                    onClick={() => set({ pickupTime: slot })}
                    data-testid={`pick-${slot}`}
                  >
                    <strong>{slot}</strong>
                    <small>{free > 0 ? `${free} place${free > 1 ? 's' : ''}` : 'complet'}</small>
                  </button>
                );
              })}
            </div>
            <div className="time-fine">
              {selectedSlot && (
                <Segmented
                  label="Minute précise"
                  value={draft.pickupTime ?? ''}
                  options={[0, 5].map((m) => {
                    const t = fromMinutes(toMinutes(selectedSlot) + m);
                    return { value: t, label: t };
                  })}
                  onChange={(pickupTime) => set({ pickupTime })}
                />
              )}
              <label className="muted">
                Autre heure :{' '}
                <input
                  type="time"
                  step={300}
                  value={draft.pickupTime ?? ''}
                  onChange={(e) => e.target.value && set({ pickupTime: e.target.value })}
                />
              </label>
            </div>
          </section>

          {/* ------------------------------ Pizzas ------------------------------ */}
          <section className="form-section">
            <h3>Pizzas ({draft.pizzas.length})</h3>
            <div className="menu-grid">
              {settings.menu.pizzas.map((m) => (
                <button key={m.name} type="button" className={`menu-btn base-${m.base}`} onClick={() => addPizza(m)}>
                  {m.name}
                  <small>{BASE_LABEL[m.base]}</small>
                </button>
              ))}
              <div className="menu-custom">
                <input
                  placeholder="Autre pizza…"
                  value={customPizza}
                  onChange={(e) => setCustomPizza(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!customPizza.trim()}
                  onClick={() => {
                    addPizza({ name: customPizza.trim(), base: 'tomate' }, true);
                    setCustomPizza('');
                  }}
                >
                  Ajouter
                </button>
              </div>
            </div>

            <ol className="pizza-editors">
              {draft.pizzas.map((p, i) => (
                <PizzaEditor
                  key={p.id}
                  index={i}
                  pizza={p}
                  menu={settings.menu.pizzas.find((m) => m.name === p.name)}
                  supplements={settings.menu.supplements}
                  price={pricedPizzas[i]?.basePrice ?? 0}
                  slotLabel={plan && plan.shifted && plan.slots[p.id] !== plan.requestedSlot ? plan.slots[p.id] : null}
                  expanded={expanded === p.id}
                  onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
                  onChange={(patch) => updatePizza(p.id, patch)}
                  onDuplicate={() => duplicatePizza(p)}
                  onRemove={() => removePizza(p.id)}
                  statusLabel={initial?.pizzas[p.id] ? STATUS_LABEL[initial.pizzas[p.id].status] : null}
                  custom={!!p.custom || !menuNames.has(p.name)}
                />
              ))}
            </ol>
          </section>

          {/* --------------------------- Autres ventes -------------------------- */}
          <section className="form-section">
            <h3>Autres ventes</h3>
            <div className="others-grid">
              {CATEGORIES.map((c) => {
                const names = [
                  ...new Set([
                    ...settings.menu[c.menuKey].map((x) => x.name),
                    ...draft.items.filter((i) => i.category === c.key).map((i) => i.name),
                  ]),
                ];
                return (
                  <div key={c.key} className="others-col">
                    <h4>{c.label}</h4>
                    {names.map((name) => (
                      <div key={name} className={`other-line ${qtyOf(c.key, name) ? 'on' : ''}`}>
                        <span>
                          {name}{' '}
                          <small className="price">{formatPrice(itemPrice(settings, c.key, name) ?? 0)}</small>
                        </span>
                        <Stepper
                          label={name}
                          value={qtyOf(c.key, name)}
                          onChange={(q) => setQty(c.key, name, q)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ------------------------------- Fin ------------------------------- */}
          <section className="form-section form-grid-2">
            <div>
              <h3>Remarque (facultatif)</h3>
              <input
                className="input-lg"
                placeholder="Ex. : client attend dans la voiture"
                value={draft.note}
                onChange={(e) => set({ note: e.target.value })}
              />
            </div>
            <div>
              <h3>Déjà payée ?</h3>
              <Segmented
                label="Payée"
                value={draft.paid}
                options={[
                  { value: false, label: 'Non' },
                  { value: true, label: 'Oui' },
                ]}
                onChange={(paid) => set({ paid })}
              />
            </div>
          </section>
        </div>

        <footer className="modal-foot">
          <div className="foot-info">
            {plan && need > 0 && plan.shifted ? (
              <span className="shift-warning" data-testid="shift-warning">
                ⚠ Créneau {plan.requestedSlot} : {plan.freeInRequested > 0 ? `plus que ${plan.freeInRequested} place(s)` : 'complet'}.{' '}
                {plan.perSlot.map((x) => `${x.count} pizza(s) à ${x.slot}`).join(', ')} →{' '}
                <strong>retrait à {plan.pickupTime}</strong>
              </span>
            ) : plan && need > 0 ? (
              <span className="capacity-ok">
                Créneau {plan.requestedSlot} : {quotaFor(plan.requestedSlot, settings, dayQuotas) - freeIn(plan.requestedSlot) + need}/
                {quotaFor(plan.requestedSlot, settings, dayQuotas)} pizzas avec cette commande
              </span>
            ) : (
              <span className="muted">{need} pizza(s)</span>
            )}
            {errors.map((e) => (
              <span key={e} className="form-error">
                {e}
              </span>
            ))}
          </div>
          <span className="order-total-lg" data-testid="form-total">
            Total {formatPrice(total)}
          </span>
          {plan && need > 0 && plan.shifted && (
            <button className="btn btn-lg btn-warning" onClick={() => submit(true)} data-testid="force-order">
              Forcer tout sur {plan.requestedSlot}
            </button>
          )}
          <button className="btn btn-lg btn-primary" onClick={() => submit(false)} data-testid="submit-order">
            {plan && need > 0 && plan.shifted ? `Enregistrer (retrait ${plan.pickupTime})` : 'Enregistrer'}
          </button>
        </footer>
      </div>
    </div>
  );
}
