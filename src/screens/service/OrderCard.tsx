import { useKiosk } from '../../KioskContext';
import { AlertBadge, OriginBadge, PizzaDetails, PizzaOptions } from '../../components/ui';
import { STATUS_LABEL, orderAlert, sortedPizzas } from '../../domain/rules';
import type { Order, OtherCategory } from '../../domain/types';

const CATEGORY_ICON: Record<OtherCategory, string> = { boisson: '🥤', kiosquito: '🥟', dessert: '🍨' };

export function OrderCard({ order, onEdit }: { order: Order; onEdit: (o: Order) => void }) {
  const { store, run, nowMin, day, confirm } = useKiosk();
  const pizzas = sortedPizzas(order);
  const alert = orderAlert(order, nowMin, day.settings.preAlertMinutes);
  const inOven = pizzas.filter((p) => p.status === 'four');

  const cls = [
    'order-card',
    order.collected ? 'collected' : '',
    order.paid ? 'paid' : '',
    alert ? `alert-${alert.kind}` : '',
  ].join(' ');

  const toggleCollected = async () => {
    if (!order.collected && !order.paid) {
      const ok = await confirm(
        `La commande de ${order.customerName} n'est pas marquée payée. Confirmer qu'elle est récupérée ?`,
        'Oui, récupérée',
      );
      if (!ok) return;
    }
    run(store.setCollected(order.id, !order.collected));
  };

  const remove = async () => {
    if (await confirm(`Supprimer définitivement la commande de ${order.customerName} ?`, 'Supprimer')) {
      run(store.deleteOrder(order.id));
    }
  };

  return (
    <article className={cls} data-testid={`order-${order.customerName}`}>
      <header className="order-head">
        <span className="pickup">{order.pickupTime}</span>
        <span className="customer">{order.customerName}</span>
        <OriginBadge origin={order.origin} />
        {order.collected && <span className="badge badge-collected">Récupérée</span>}
        <AlertBadge alert={alert} />
        <span className="head-tools">
          <button className="btn btn-ghost btn-small" onClick={() => onEdit(order)}>
            ✎ Modifier
          </button>
          <button className="btn btn-ghost btn-small btn-danger" onClick={remove} aria-label="Supprimer">
            🗑
          </button>
        </span>
      </header>

      {pizzas.length > 0 && (
        <ul className="pizza-rows">
          {pizzas.map((p) => (
            <li key={p.id} className={`pizza-row status-${p.status}`} data-testid="pizza-row" data-status={p.status}>
              <div className="pizza-main">
                <span className="pizza-title">
                  <span className={`size size-${p.size}`}>{p.size}</span>
                  <span className="pizza-name">{p.name}</span>
                </span>
                <PizzaDetails pizza={p} />
                <PizzaOptions pizza={p} />
              </div>
              <div className="pizza-side">
                <span className="status-label">{STATUS_LABEL[p.status]}</span>
                {p.status === 'four' && !order.collected && (
                  <button
                    className="btn btn-ready"
                    onClick={() => run(store.setPizzaStatuses(order.id, [p.id], 'prete'))}
                  >
                    Prête ✓
                  </button>
                )}
                {p.status === 'prete' && !order.collected && (
                  <button
                    className="btn btn-ghost btn-small"
                    title="Annuler « Prête »"
                    onClick={() => run(store.setPizzaStatuses(order.id, [p.id], 'four'))}
                  >
                    ↩
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {order.items.length > 0 && (
        <ul className="other-items">
          {order.items.map((it, i) => (
            <li key={i} className={order.paid ? 'paid-text' : ''}>
              {CATEGORY_ICON[it.category]} {it.qty}× {it.name}
            </li>
          ))}
        </ul>
      )}

      {order.note && <p className="order-note">✎ {order.note}</p>}

      <footer className="order-actions">
        {inOven.length > 1 && !order.collected && (
          <button
            className="btn btn-ready"
            onClick={() =>
              run(
                store.setPizzaStatuses(
                  order.id,
                  inOven.map((p) => p.id),
                  'prete',
                ),
              )
            }
          >
            Tout prêt ✓
          </button>
        )}
        <button
          className={`btn ${order.paid ? 'btn-on' : 'btn-outline'}`}
          aria-pressed={order.paid}
          onClick={() => run(store.setPaid(order.id, !order.paid))}
        >
          {order.paid ? 'Payée ✓' : 'Payée ?'}
        </button>
        <button
          className={`btn ${order.collected ? 'btn-on-pink' : 'btn-outline'}`}
          aria-pressed={order.collected}
          onClick={toggleCollected}
        >
          {order.collected ? 'Récupérée ✓' : 'Récupérée ?'}
        </button>
      </footer>
    </article>
  );
}
