import { useState } from 'react';
import { useKiosk } from '../../KioskContext';
import { Segmented, TopBar } from '../../components/ui';
import { byPickup, orderAlert } from '../../domain/rules';
import type { Order } from '../../domain/types';
import { navigate } from '../../hooks/useHashRoute';
import { useWakeLock } from '../../hooks/useWakeLock';
import { OrderCard } from './OrderCard';
import { OrderForm } from './OrderForm';
import { PlanningBar } from './PlanningBar';

type Filter = 'encours' | 'recuperees' | 'toutes';

export function ServiceScreen() {
  const { day, nowMin } = useKiosk();
  useWakeLock();
  const [filter, setFilter] = useState<Filter>('encours');
  const [form, setForm] = useState<{ order: Order | null } | null>(null);

  const all = [...day.orders].sort(byPickup);
  const enCours = all.filter((o) => !o.collected);
  const recuperees = all.filter((o) => o.collected);
  const shown = filter === 'encours' ? enCours : filter === 'recuperees' ? recuperees : all;
  const lates = enCours.filter((o) => orderAlert(o, nowMin, day.settings.preAlertMinutes)?.kind === 'retard').length;

  // Si la commande en cours de modification change (ex. la cuisine la met au four), on suit la version à jour.
  const editing = form?.order ? (day.orders.find((o) => o.id === form.order!.id) ?? form.order) : null;

  return (
    <div className="screen screen-service">
      <TopBar title="Service">
        {lates > 0 && <span className="badge badge-retard big">{lates} en retard</span>}
        <button className="btn btn-ghost btn-lg" onClick={() => navigate('ventes')} data-testid="open-sales">
          📊 Ventes
        </button>
        <button className="btn btn-ghost btn-lg" onClick={() => navigate('reglages')} aria-label="Réglages">
          ⚙ Réglages
        </button>
        <button className="btn btn-primary btn-lg" onClick={() => setForm({ order: null })} data-testid="new-order">
          + Nouvelle commande
        </button>
      </TopBar>

      <PlanningBar />

      <div className="list-toolbar">
        <Segmented<Filter>
          label="Filtre"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'encours', label: `En cours (${enCours.length})` },
            { value: 'recuperees', label: `Récupérées (${recuperees.length})` },
            { value: 'toutes', label: `Toutes (${all.length})` },
          ]}
        />
        <div className="legend" aria-label="Légende">
          <span className="lg status-attente">En attente</span>
          <span className="lg status-preparation">Préparation</span>
          <span className="lg status-four">Au four</span>
          <span className="lg status-prete">Prête</span>
          <span className="lg lg-collected">Récupérée</span>
          <span className="lg lg-paid">Payée</span>
        </div>
      </div>

      <main className="order-grid">
        {!day.ready && <p className="empty">Chargement…</p>}
        {day.ready && shown.length === 0 && (
          <p className="empty">
            {filter === 'encours' ? 'Aucune commande en cours.' : 'Aucune commande.'}
          </p>
        )}
        {shown.map((o) => (
          <OrderCard key={o.id} order={o} onEdit={(order) => setForm({ order })} />
        ))}
      </main>

      {form && <OrderForm initial={editing} onClose={() => setForm(null)} />}
    </div>
  );
}
