import { PizzaDetails, PizzaOptions, PriceInput, Segmented } from '../../components/ui';
import { formatPrice } from '../../domain/pricing';
import { SIZE_LABEL } from '../../domain/rules';
import type { Base, MenuPizza, Pizza, PricedItem, Size } from '../../domain/types';

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function PizzaEditor(props: {
  index: number;
  pizza: Pizza;
  menu: MenuPizza | undefined;
  supplements: PricedItem[];
  /** Prix de la pizza seule pour la taille choisie (centimes). */
  price: number;
  /** Créneau de report si la pizza bascule sur un créneau suivant. */
  slotLabel: string | null;
  expanded: boolean;
  statusLabel: string | null;
  custom: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<Pizza>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { pizza: p, onChange } = props;
  const ingredients = props.menu?.ingredients ?? [];
  const suppPrice = (name: string) => props.supplements.find((s) => s.name === name)?.price ?? p.suppPrices?.[name] ?? 0;
  const total = props.price + p.supplements.reduce((sum, s) => sum + suppPrice(s), 0);

  return (
    <li className={`pizza-editor ${props.expanded ? 'expanded' : ''}`} data-testid="pizza-editor">
      <div className="pizza-editor-head">
        <button type="button" className="pizza-editor-summary" onClick={props.onToggle}>
          <span className="num">{props.index + 1}</span>
          <span className={`size size-${p.size}`}>{p.size}</span>
          <strong>{p.name}</strong>
          {!props.expanded && (
            <>
              <PizzaDetails pizza={p} />
              <PizzaOptions pizza={p} />
            </>
          )}
          {props.statusLabel && <span className="badge">{props.statusLabel}</span>}
          {props.slotLabel && <span className="badge badge-shift">→ créneau {props.slotLabel}</span>}
          <span className="pizza-price">{formatPrice(total)}</span>
          <span className="chevron">{props.expanded ? '▲' : '▼'}</span>
        </button>
        <button type="button" className="btn btn-ghost" onClick={props.onDuplicate} title="Dupliquer">
          ⧉ ×2
        </button>
        <button type="button" className="btn btn-ghost btn-danger" onClick={props.onRemove} aria-label="Retirer">
          ✕
        </button>
      </div>

      {props.expanded && (
        <div className="pizza-editor-body">
          <div className="editor-row">
            <span className="editor-label">Taille</span>
            <Segmented<Size>
              label="Taille"
              value={p.size}
              options={[
                { value: 'G', label: SIZE_LABEL.G },
                { value: 'P', label: SIZE_LABEL.P },
              ]}
              onChange={(size) => onChange({ size })}
            />
            <span className="editor-label">Base</span>
            <Segmented<Base>
              label="Base"
              value={p.base}
              options={[
                { value: 'tomate', label: 'Tomate' },
                { value: 'creme', label: 'Crème' },
              ]}
              onChange={(base) => onChange({ base })}
            />
          </div>
          <div className="editor-row">
            <span className="editor-label">Coupée</span>
            <Segmented
              label="Coupée"
              value={p.cut}
              options={[
                { value: true, label: 'Oui' },
                { value: false, label: 'Non' },
              ]}
              onChange={(cut) => onChange({ cut })}
            />
            <span className="editor-label">Olives</span>
            <Segmented
              label="Olives"
              value={p.olives}
              options={[
                { value: true, label: 'Oui' },
                { value: false, label: 'Non' },
              ]}
              onChange={(olives) => onChange({ olives })}
            />
          </div>

          <div className="editor-block">
            <span className="editor-label">Suppléments</span>
            <div className="chips">
              {props.supplements.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className={`chip chip-add ${p.supplements.includes(s.name) ? 'on' : ''}`}
                  onClick={() => onChange({ supplements: toggle(p.supplements, s.name) })}
                >
                  + {s.name} <small>{formatPrice(s.price)}</small>
                </button>
              ))}
            </div>
          </div>

          {ingredients.length > 0 && (
            <div className="editor-block">
              <span className="editor-label">Retirer</span>
              <div className="chips">
                {ingredients.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`chip chip-remove ${p.removed.includes(s) ? 'on' : ''}`}
                    onClick={() => onChange({ removed: toggle(p.removed, s) })}
                  >
                    − {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {props.custom && (
            <div className="editor-row">
              <span className="editor-label">Prix</span>
              <PriceInput
                label={`Prix de ${p.name}`}
                value={p.basePrice ?? 0}
                onChange={(basePrice) => onChange({ basePrice })}
              />
              <span className="muted">Pizza hors carte : indiquez son prix (sans les suppléments).</span>
            </div>
          )}

          <div className="editor-block">
            <span className="editor-label">Changement</span>
            <input
              className="input-lg"
              placeholder={props.custom ? 'Composition / changement…' : 'Ex. : remplacer jambon par poulet'}
              value={p.note}
              onChange={(e) => onChange({ note: e.target.value })}
            />
          </div>
        </div>
      )}
    </li>
  );
}
