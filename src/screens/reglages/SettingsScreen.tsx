import { useEffect, useState } from 'react';
import { useKiosk } from '../../KioskContext';
import { PriceInput, Segmented, Stepper, TopBar } from '../../components/ui';
import type { Base, MenuPizza, OpeningRange, PricedItem, Settings } from '../../domain/types';
import { navigate } from '../../hooks/useHashRoute';
import { DemoTools } from '../DemoTools';

/** Édition d'une liste de textes (suppléments, boissons...). */
function ListEditor(props: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !props.items.includes(v)) props.onChange([...props.items, v]);
    setDraft('');
  };
  return (
    <div className="list-editor">
      <div className="chips">
        {props.items.map((it) => (
          <span key={it} className="chip chip-static">
            {it}
            <button
              type="button"
              aria-label={`Retirer ${it}`}
              onClick={() => props.onChange(props.items.filter((x) => x !== it))}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="inline-add">
        <input
          placeholder={props.placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" className="btn btn-outline" onClick={add} disabled={!draft.trim()}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

/** Liste d'articles avec leur prix (suppléments, boissons, kiosquitos, desserts). */
function PricedListEditor(props: {
  id: string;
  items: PricedItem[];
  onChange: (items: PricedItem[]) => void;
  placeholder: string;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const set = (i: number, patch: Partial<PricedItem>) =>
    props.onChange(props.items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = () => {
    const v = name.trim();
    if (v && !props.items.some((it) => it.name === v)) props.onChange([...props.items, { name: v, price }]);
    setName('');
    setPrice(0);
  };
  return (
    <div className="priced-list">
      {props.items.map((it, i) => (
        <div key={i} className="priced-row">
          <input
            id={`${props.id}-nom-${i}`}
            aria-label="Nom"
            value={it.name}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <PriceInput id={`${props.id}-prix-${i}`} label={`Prix de ${it.name}`} value={it.price} onChange={(p) => set(i, { price: p })} />
          <button
            type="button"
            className="btn btn-ghost btn-danger"
            aria-label={`Retirer ${it.name}`}
            onClick={() => props.onChange(props.items.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="priced-row priced-add">
        <input
          id={`${props.id}-nouveau`}
          placeholder={props.placeholder}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <PriceInput id={`${props.id}-nouveau-prix`} label="Prix du nouvel article" value={price} onChange={setPrice} />
        <button type="button" className="btn btn-outline" onClick={add} disabled={!name.trim()}>
          Ajouter
        </button>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const { day, store, run, toast, auth, confirm } = useKiosk();
  const [s, setS] = useState<Settings>(day.settings);
  const [dirty, setDirty] = useState(false);

  // Tant que rien n'est modifié ici, on suit les réglages enregistrés.
  useEffect(() => {
    if (!dirty) setS(day.settings);
  }, [day.settings, dirty]);

  const update = (patch: Partial<Settings>) => {
    setS((x) => ({ ...x, ...patch }));
    setDirty(true);
  };
  const updateMenu = (patch: Partial<Settings['menu']>) => update({ menu: { ...s.menu, ...patch } });
  const setPizza = (i: number, patch: Partial<MenuPizza>) =>
    updateMenu({ pizzas: s.menu.pizzas.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const setRange = (i: number, patch: Partial<OpeningRange>) =>
    update({ openingHours: s.openingHours.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  const save = () => {
    const clean = (list: PricedItem[]) =>
      list
        .map((it) => ({ ...it, name: it.name.trim() }))
        .filter((it, i, all) => it.name && all.findIndex((x) => x.name === it.name) === i);
    const cleaned: Settings = {
      ...s,
      menu: {
        supplements: clean(s.menu.supplements),
        boissons: clean(s.menu.boissons),
        kiosquitos: clean(s.menu.kiosquitos),
        desserts: clean(s.menu.desserts),
        pizzas: s.menu.pizzas
          .map((p) => ({ ...p, name: p.name.trim(), ingredients: p.ingredients.map((x) => x.trim()).filter(Boolean) }))
          .filter((p) => p.name),
      },
      openingHours: s.openingHours.filter((r) => r.start && r.end && r.start < r.end),
    };
    run(store.saveSettings(cleaned));
    setDirty(false);
    toast('Réglages enregistrés');
    navigate('service');
  };

  const leave = async () => {
    if (!dirty || (await confirm('Quitter sans enregistrer les modifications ?', 'Quitter'))) {
      setDirty(false);
      navigate('service');
    }
  };

  return (
    <div className="screen screen-settings">
      <TopBar title="Réglages">
        <button className="btn btn-ghost btn-lg" onClick={leave}>
          ← Retour
        </button>
        <button className="btn btn-primary btn-lg" onClick={save} disabled={!dirty}>
          Enregistrer
        </button>
      </TopBar>

      <main className="settings">
        <section className="card">
          <h2>Planning de production</h2>
          <div className="settings-row">
            <span>Pizzas maximum par créneau de 10 min (toutes tailles)</span>
            <Stepper label="pizzas par créneau" value={s.defaultQuota} onChange={(defaultQuota) => update({ defaultQuota })} />
          </div>
          <p className="muted">
            Si une commande dépasse les places restantes, les pizzas en trop passent sur le créneau suivant. Pour un
            rush ponctuel, touchez directement un créneau dans le bandeau de l'écran Service.
          </p>
          <div className="settings-row">
            <span>Pré-alerte « À lancer » (minutes avant le retrait)</span>
            <Stepper label="minutes" value={s.preAlertMinutes} max={60} onChange={(preAlertMinutes) => update({ preAlertMinutes })} />
          </div>
          <h3>Horaires d'ouverture</h3>
          {s.openingHours.map((r, i) => (
            <div key={i} className="settings-row">
              <span>
                De <input type="time" value={r.start} onChange={(e) => setRange(i, { start: e.target.value })} /> à{' '}
                <input type="time" value={r.end} onChange={(e) => setRange(i, { end: e.target.value })} />
              </span>
              <button
                className="btn btn-ghost btn-danger"
                onClick={() => update({ openingHours: s.openingHours.filter((_, j) => j !== i) })}
              >
                Retirer
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline"
            onClick={() => update({ openingHours: [...s.openingHours, { start: '18:00', end: '22:00' }] })}
          >
            + Ajouter une plage
          </button>
        </section>

        <section className="card">
          <h2>Valeurs par défaut d'une pizza</h2>
          <div className="settings-row">
            <span>Coupée</span>
            <Segmented
              value={s.defaultCut}
              options={[
                { value: true, label: 'Oui' },
                { value: false, label: 'Non' },
              ]}
              onChange={(defaultCut) => update({ defaultCut })}
            />
          </div>
          <div className="settings-row">
            <span>Olives</span>
            <Segmented
              value={s.defaultOlives}
              options={[
                { value: true, label: 'Oui' },
                { value: false, label: 'Non' },
              ]}
              onChange={(defaultOlives) => update({ defaultOlives })}
            />
          </div>
          <h3>Origines des commandes</h3>
          <ListEditor items={s.origins} onChange={(origins) => update({ origins })} placeholder="Ex. : Deliveroo" />
        </section>

        <section className="card card-wide">
          <h2>Carte des pizzas</h2>
          <table className="menu-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Base</th>
                <th>Ingrédients (séparés par des virgules, pour pouvoir les retirer)</th>
                <th>Prix Grande</th>
                <th>Prix Petite</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.menu.pizzas.map((p, i) => (
                <tr key={i}>
                  <td>
                    <input value={p.name} onChange={(e) => setPizza(i, { name: e.target.value })} />
                  </td>
                  <td>
                    <Segmented<Base>
                      value={p.base}
                      options={[
                        { value: 'tomate', label: 'Tomate' },
                        { value: 'creme', label: 'Crème' },
                      ]}
                      onChange={(base) => setPizza(i, { base })}
                    />
                  </td>
                  <td>
                    <input
                      className="wide"
                      value={p.ingredients.join(', ')}
                      onChange={(e) => setPizza(i, { ingredients: e.target.value.split(',').map((x) => x.trimStart()) })}
                    />
                  </td>
                  <td>
                    <PriceInput
                      id={`pizza-${i}-prix-g`}
                      label={`Prix ${p.name} grande`}
                      value={p.priceG}
                      onChange={(priceG) => setPizza(i, { priceG })}
                    />
                  </td>
                  <td>
                    <PriceInput
                      id={`pizza-${i}-prix-p`}
                      label={`Prix ${p.name} petite`}
                      value={p.priceP}
                      onChange={(priceP) => setPizza(i, { priceP })}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-danger"
                      aria-label={`Retirer ${p.name}`}
                      onClick={() => updateMenu({ pizzas: s.menu.pizzas.filter((_, j) => j !== i) })}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            className="btn btn-outline"
            onClick={() => updateMenu({ pizzas: [...s.menu.pizzas, { name: '', base: 'tomate', ingredients: [], priceG: 0, priceP: 0 }] })}
          >
            + Ajouter une pizza
          </button>
        </section>

        <section className="card">
          <h2>Suppléments</h2>
          <PricedListEditor
            id="supplements"
            items={s.menu.supplements}
            onChange={(supplements) => updateMenu({ supplements })}
            placeholder="Nouveau supplément"
          />
        </section>
        <section className="card">
          <h2>Boissons</h2>
          <PricedListEditor
            id="boissons"
            items={s.menu.boissons}
            onChange={(boissons) => updateMenu({ boissons })}
            placeholder="Nouvelle boisson"
          />
        </section>
        <section className="card">
          <h2>Kiosquitos</h2>
          <PricedListEditor
            id="kiosquitos"
            items={s.menu.kiosquitos}
            onChange={(kiosquitos) => updateMenu({ kiosquitos })}
            placeholder="Nouveau kiosquito"
          />
        </section>
        <section className="card">
          <h2>Desserts</h2>
          <PricedListEditor
            id="desserts"
            items={s.menu.desserts}
            onChange={(desserts) => updateMenu({ desserts })}
            placeholder="Nouveau dessert"
          />
        </section>

        <section className="card">
          <h2>Cette tablette</h2>
          {store.kind === 'demo' ? (
            <DemoTools store={store} auth={auth} />
          ) : (
            <button
              className="btn btn-outline btn-danger"
              onClick={async () => {
                if (await confirm('Déconnecter cette tablette ? Il faudra ressaisir le mot de passe.', 'Déconnecter')) {
                  void auth.signOut();
                }
              }}
            >
              Déconnecter la tablette
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
