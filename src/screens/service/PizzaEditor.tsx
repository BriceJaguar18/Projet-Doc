import { PizzaDetails, PizzaOptions, Segmented } from '../../components/ui';
import { SIZE_LABEL } from '../../domain/rules';
import type { Base, MenuPizza, Pizza, Size } from '../../domain/types';

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function PizzaEditor(props: {
  index: number;
  pizza: Pizza;
  menu: MenuPizza | undefined;
  supplements: string[];
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
                  key={s}
                  type="button"
                  className={`chip chip-add ${p.supplements.includes(s) ? 'on' : ''}`}
                  onClick={() => onChange({ supplements: toggle(p.supplements, s) })}
                >
                  + {s}
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
