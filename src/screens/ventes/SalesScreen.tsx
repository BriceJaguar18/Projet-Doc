import { useEffect, useMemo, useState } from 'react';
import { useKiosk } from '../../KioskContext';
import { Segmented, TopBar } from '../../components/ui';
import { formatPrice } from '../../domain/pricing';
import { frenchDate, ordersInPeriod, salesCsv, servicePeriods, summarizeSales } from '../../domain/sales';
import type { Order } from '../../domain/types';
import { navigate } from '../../hooks/useHashRoute';

/** Fait télécharger un fichier par le navigateur (dossier « Téléchargements » de la tablette). */
function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Récapitulatif des ventes d'un service (midi, soir) ou de la journée, avec export tableur. */
export function SalesScreen() {
  const { day, date: today, store, toast } = useKiosk();
  const periods = servicePeriods(day.settings.openingHours);
  const [date, setDate] = useState(today);
  const [periodId, setPeriodId] = useState('jour');
  const [past, setPast] = useState<{ date: string; orders: Order[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Aujourd'hui : données en direct. Autre jour : chargées une fois.
  useEffect(() => {
    if (date === today || past?.date === date) return;
    let cancelled = false;
    setLoading(true);
    store
      .fetchDay(date)
      .then((orders) => !cancelled && setPast({ date, orders }))
      .catch(() => !cancelled && toast('Impossible de charger ce jour. Vérifiez la connexion internet.', 'error'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, today, past, store, toast]);

  const dayOrders = date === today ? day.orders : past?.date === date ? past.orders : [];
  const orders = useMemo(
    () => ordersInPeriod(dayOrders, day.settings.openingHours, periodId),
    [dayOrders, day.settings.openingHours, periodId],
  );
  const sum = useMemo(() => summarizeSales(orders), [orders]);
  const period = periods.find((p) => p.id === periodId) ?? periods[0];

  const exportFile = () => {
    const slug = period.id === 'jour' ? 'journee' : period.label.split(' ')[0].toLowerCase();
    download(
      `ventes-${date}-${slug}.csv`,
      salesCsv(orders, { date, periodLabel: period.label, exportedAt: new Date() }),
    );
    toast('Fichier téléchargé (dossier Téléchargements)');
  };

  return (
    <div className="screen screen-sales">
      <TopBar title="Ventes">
        <button className="btn btn-ghost btn-lg" onClick={() => navigate('service')}>
          ← Retour
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={exportFile}
          disabled={orders.length === 0}
          data-testid="export-sales"
        >
          ⬇ Télécharger le récapitulatif
        </button>
      </TopBar>

      <main className="sales">
        <div className="sales-filters">
          <label className="sales-date">
            Jour{' '}
            <input
              id="ventes-date"
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <Segmented
            label="Période"
            value={periodId}
            options={periods.map((p) => ({ value: p.id, label: p.label }))}
            onChange={setPeriodId}
          />
        </div>

        <section className="sales-summary" aria-label="Résumé">
          <div className="kpi kpi-main">
            <span className="kpi-label">Total des ventes</span>
            <span className="kpi-value" data-testid="sales-total">
              {formatPrice(sum.total)}
            </span>
            <span className="kpi-sub">
              {frenchDate(date)} · {period.label}
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Commandes</span>
            <span className="kpi-value">{sum.orders}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Pizzas</span>
            <span className="kpi-value">{sum.pizzas}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Panier moyen</span>
            <span className="kpi-value">{formatPrice(sum.orders ? Math.round(sum.total / sum.orders) : 0)}</span>
          </div>
        </section>

        {sum.unpaid.orders > 0 && (
          <p className="sales-warning">
            {sum.unpaid.orders} commande(s) non marquée(s) payée(s), pour {formatPrice(sum.unpaid.total)}. Elles sont
            comptées dans le total.
          </p>
        )}

        {loading && <p className="empty">Chargement…</p>}
        {!loading && orders.length === 0 && <p className="empty">Aucune commande sur cette période.</p>}

        {orders.length > 0 && (
          <div className="sales-grid">
            <section className="card sales-table-card">
              <h2>Articles vendus</h2>
              <div className="table-scroll">
                <table className="sales-table" data-testid="sales-table">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Taille</th>
                      <th className="num">Qté</th>
                      <th className="num">Prix unitaire</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  {sum.byCategory.map((c) => (
                    <tbody key={c.category}>
                      <tr className="cat-row">
                        <th colSpan={5}>{c.category}</th>
                      </tr>
                      {sum.lines
                        .filter((l) => l.category === c.category)
                        .map((l) => (
                          <tr key={`${l.name}|${l.detail}|${l.unitPrice}`}>
                            <td>{l.name}</td>
                            <td>{l.detail}</td>
                            <td className="num">{l.qty}</td>
                            <td className="num">{formatPrice(l.unitPrice)}</td>
                            <td className="num">{formatPrice(l.total)}</td>
                          </tr>
                        ))}
                      <tr className="subtotal">
                        <td colSpan={2}>Total {c.category}</td>
                        <td className="num">{c.qty}</td>
                        <td />
                        <td className="num">{formatPrice(c.total)}</td>
                      </tr>
                    </tbody>
                  ))}
                  <tfoot>
                    <tr>
                      <td colSpan={4}>Total des ventes</td>
                      <td className="num">{formatPrice(sum.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="card">
              <h2>Par origine</h2>
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Origine</th>
                    <th className="num">Commandes</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sum.byOrigin.map((o) => (
                    <tr key={o.origin}>
                      <td>{o.origin}</td>
                      <td className="num">{o.orders}</td>
                      <td className="num">{formatPrice(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                Le fichier téléchargé contient aussi le détail de chaque commande. Il s'ouvre avec Excel, Numbers ou
                Google Sheets.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
