'use client';
import { useState, type ReactNode } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Users,
  MessageSquare,
  CreditCard,
  MoreHorizontal,
  Pencil,
  TrendingUp,
  GripVertical,
  ArrowRight,
  Check,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStudio } from '@/lib/store';
import {
  calculateMetrics,
  calculateMetricChanges,
  snapshotMetricKeys,
  chartData,
  filteredTransactions,
  periodRange,
} from '@/lib/analytics';
import { money, number, initials } from '@/lib/utils';
import { ChartPanel } from './chart-panel';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
const definitions: Record<
  string,
  { label: string; icon: typeof DollarSign; unit: 'money' | 'number' | 'percent'; hint: string }
> = {
  total: {
    label: 'Total earnings',
    icon: DollarSign,
    unit: 'money',
    hint: 'Gross revenue across all transaction categories',
  },
  net: {
    label: 'Net revenue',
    icon: CreditCard,
    unit: 'money',
    hint: 'Revenue after the simulated 20% platform fee',
  },
  gross: {
    label: 'Gross revenue',
    icon: DollarSign,
    unit: 'money',
    hint: 'Total before simulated platform fees',
  },
  messages: {
    label: 'Message revenue',
    icon: MessageSquare,
    unit: 'money',
    hint: 'Revenue from individual messages',
  },
  subscribers: {
    label: 'Total subscribers',
    icon: Users,
    unit: 'number',
    hint: 'Active paid and renewed fans',
  },
  subscriptions: {
    label: 'Subscription revenue',
    icon: Users,
    unit: 'money',
    hint: 'Revenue from subscriptions',
  },
  tips: { label: 'Tips revenue', icon: DollarSign, unit: 'money', hint: 'Voluntary fan tips' },
  ppv: { label: 'PPV revenue', icon: CreditCard, unit: 'money', hint: 'Pay-per-view simulated purchases' },
  arpu: {
    label: 'Revenue per fan',
    icon: Users,
    unit: 'money',
    hint: 'Selected revenue divided by associated fans',
  },
  newSubscribers: {
    label: 'New subscribers',
    icon: Users,
    unit: 'number',
    hint: 'New paid or renewed fans in selected period',
  },
  expired: {
    label: 'Expired subscribers',
    icon: Users,
    unit: 'number',
    hint: 'Fans with expired subscriptions',
  },
  renewed: {
    label: 'Renewed subscribers',
    icon: Users,
    unit: 'number',
    hint: 'Fans whose subscription is marked renewed',
  },
  renewalRate: {
    label: 'Renewal rate',
    icon: TrendingUp,
    unit: 'percent',
    hint: 'Renewed / (renewed + expired) × 100',
  },
  freeFans: { label: 'Free fans', icon: Users, unit: 'number', hint: 'Free subscription fans' },
  paidFans: { label: 'Paid fans', icon: Users, unit: 'number', hint: 'All paid and renewed fans' },
  conversionRate: {
    label: 'Conversion rate',
    icon: TrendingUp,
    unit: 'percent',
    hint: 'Unique purchasing fans / associated fans × 100',
  },
  averageOrderValue: {
    label: 'Average order value',
    icon: CreditCard,
    unit: 'money',
    hint: 'Selected revenue / transaction count',
  },
  growth: {
    label: 'Revenue growth',
    icon: TrendingUp,
    unit: 'percent',
    hint: 'Change compared with the previous equal-length period',
  },
  daily: {
    label: 'Daily revenue',
    icon: DollarSign,
    unit: 'money',
    hint: 'Average daily revenue over this period',
  },
  weekly: {
    label: 'Weekly revenue',
    icon: DollarSign,
    unit: 'money',
    hint: 'Average weekly revenue over this period',
  },
  monthly: {
    label: 'Monthly revenue',
    icon: DollarSign,
    unit: 'money',
    hint: 'Revenue normalized to a 30-day month',
  },
};
function SortableWidget({ id, children, editing }: { id: string; children: ReactNode; editing: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled: !editing,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="sortable-widget"
    >
      {editing && (
        <button className="widget-grip" aria-label={`Reorder ${id}`} {...attributes} {...listeners}>
          <GripVertical size={15} />
        </button>
      )}
      {children}
    </div>
  );
}
export function Dashboard({ page, onNavigate }: { page: string; onNavigate: (p: string) => void }) {
  const { scenario, selectedCreator, period, customRange, editMode, updateScenario } = useStudio();
  const metrics = calculateMetrics(scenario, selectedCreator, period, customRange);
  const tx = filteredTransactions(scenario, selectedCreator, period, customRange);
  const changes = calculateMetricChanges(scenario, selectedCreator, period, customRange);
  const dailyData = chartData(scenario, selectedCreator, period, customRange);
  const [editing, setEditing] = useState<string | null>(null);
  const [manual, setManual] = useState(true);
  const [value, setValue] = useState('');
  const [change, setChange] = useState('');
  const [color, setColor] = useState('#3dd9b0');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const keyFor = (metric: string) =>
    `${selectedCreator}:${period}${period === 'Custom Date' ? `:${customRange.from}:${customRange.to}` : ''}:${metric}`;
  const fmt = (id: string, n: number) =>
    definitions[id].unit === 'money'
      ? money(n, scenario.settings.currency)
      : definitions[id].unit === 'percent'
        ? `${n.toFixed(1)}%`
        : number(Math.round(n));
  const keys =
    page === 'revenue'
      ? ['total', 'subscriptions', 'messages', 'tips', 'ppv', 'net', 'gross', 'arpu']
      : page === 'performance'
        ? [
            'conversionRate',
            'averageOrderValue',
            'growth',
            'renewalRate',
            'daily',
            'weekly',
            'monthly',
            'arpu',
          ]
        : page === 'statistics'
          ? [
              'subscribers',
              'newSubscribers',
              'expired',
              'renewed',
              'renewalRate',
              'freeFans',
              'paidFans',
              'arpu',
            ]
          : ['total', 'net', 'messages', 'subscribers'];
  const order = [
    ...scenario.widgetOrder.filter((x) => keys.includes(x)),
    ...keys.filter((x) => !scenario.widgetOrder.includes(x)),
  ];
  const open = (id: string) => {
    if (!editMode) return;
    const override = scenario.overrides[keyFor(id)];
    setEditing(id);
    setManual(!!override);
    setValue(String(override?.value ?? metrics[id] ?? 0));
    setChange(String(override?.change ?? (Number.isFinite(changes[id]) ? changes[id] : 0)));
    setColor(override?.color ?? '#3dd9b0');
  };
  const categories = [
    { id: 'subscriptions', label: 'Subscriptions', color: '#8e7cf4' },
    { id: 'messages', label: 'Messages', color: '#46cdb2' },
    { id: 'ppv', label: 'Pay-per-view', color: '#67a8f5' },
    { id: 'tips', label: 'Tips', color: '#efb86c' },
  ];
  const creators = scenario.creators
    .filter((c) => selectedCreator === 'all' || c.id === selectedCreator)
    .map((c) => ({
      ...c,
      revenue: tx.filter((t) => t.creatorId === c.id).reduce((a, t) => a + t.amount, 0),
      fans: scenario.fans.filter((f) => f.creatorId === c.id).length,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const latest = [...tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const { from, to } = periodRange(period, customRange);
  const sparkPath = (id: string) => {
    const series = dailyData.map((day) => {
      if (id === 'subscribers' || id === 'newSubscribers')
        return scenario.fans.filter(
          (f) =>
            (selectedCreator === 'all' || f.creatorId === selectedCreator) &&
            f.joinedAt.slice(0, 10) === day.date &&
            (f.status === 'paid' || f.status === 'renewed'),
        ).length;
      const field =
        id === 'subscriptions'
          ? 'subscriptions'
          : id === 'messages'
            ? 'messages'
            : id === 'tips'
              ? 'tips'
              : id === 'ppv'
                ? 'ppv'
                : 'revenue';
      return day[field] * (id === 'net' ? 0.8 : 1);
    });
    const max = Math.max(1, ...series);
    return series
      .map(
        (n, i) =>
          `${i === 0 ? 'M' : 'L'}${(i / Math.max(1, series.length - 1)) * 100} ${28 - (n / max) * 25}`,
      )
      .join(' ');
  };

  return (
    <>
      <div className="dashboard-subnav">
        <button className={page === 'overview' ? 'active' : ''} onClick={() => onNavigate('overview')}>
          Overview
        </button>
        <button className={page === 'revenue' ? 'active' : ''} onClick={() => onNavigate('revenue')}>
          Revenue analytics
        </button>
        <button className={page === 'performance' ? 'active' : ''} onClick={() => onNavigate('performance')}>
          Performance
        </button>
        <button className={page === 'statistics' ? 'active' : ''} onClick={() => onNavigate('statistics')}>
          Subscriber insights
        </button>
        <span className="live-indicator">
          <i /> Local workspace
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (over && active.id !== over.id) {
            const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
            updateScenario((d) => {
              d.widgetOrder = next;
            });
          }
        }}
      >
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="kpi-grid">
            {order.map((id, index) => {
              const def = definitions[id],
                override = scenario.overrides[keyFor(id)],
                amount = override?.value ?? metrics[id] ?? 0,
                delta = override?.change ?? changes[id] ?? 0,
                Icon = def.icon;
              return (
                <SortableWidget id={id} key={id} editing={editMode}>
                  <div className={`kpi-card ${index === 0 ? 'featured' : ''} ${editMode ? 'editable' : ''}`}>
                    <div className="kpi-top">
                      <span>{def.label}</span>
                      <span className="kpi-icon">
                        <Icon size={16} />
                      </span>
                    </div>
                    <button
                      className="kpi-value"
                      aria-label={editMode ? `Edit ${def.label}` : def.hint}
                      onClick={() => open(id)}
                      disabled={!editMode}
                      style={override ? { color: override.color } : undefined}
                    >
                      {fmt(id, amount)}
                      {editMode && <Pencil size={14} />}
                    </button>
                    <div className="kpi-bottom">
                      {!override && snapshotMetricKeys.has(id) ? (
                        <span>Current snapshot</span>
                      ) : !override && id === 'growth' ? (
                        <span>vs. previous equal-length period</span>
                      ) : !Number.isFinite(delta) ? (
                        <span>No prior data</span>
                      ) : (
                        <>
                          <span
                            className={`trend ${delta < 0 ? 'negative' : ''}`}
                            style={override ? { color: override.color } : undefined}
                          >
                            {delta < 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{' '}
                            {Math.abs(delta).toFixed(1)}%
                          </span>
                          <span>vs. previous period</span>
                        </>
                      )}
                      {override && <span className="custom-dot" title="Custom value" />}
                    </div>
                    <svg
                      className="kpi-spark"
                      viewBox="0 0 100 30"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path
                        d={sparkPath(id)}
                        fill="none"
                        stroke={index === 0 ? '#49dab5' : '#3b665c'}
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <div className="analytics-layout">
        <ChartPanel
          chartId={`revenue-${page}`}
          title={page === 'statistics' ? 'Subscriber revenue trend' : 'Revenue overview'}
        />
        <div className="panel breakdown">
          <div className="panel-header">
            <div>
              <h3>Revenue breakdown</h3>
              <p>Every stream, in one place</p>
            </div>
            <span className="badge">Calculated</span>
          </div>
          <div className="breakdown-total">
            <span className="muted">Total revenue</span>
            <strong>{money(metrics.total ?? 0, scenario.settings.currency)}</strong>
          </div>
          <div className="stacked-bar">
            {categories.map((c) => (
              <div
                key={c.id}
                style={{
                  background: c.color,
                  width: `${metrics.total > 0 ? (metrics[c.id] / metrics.total) * 100 : 25}%`,
                }}
                title={`${c.label}: ${fmt(c.id, metrics[c.id])}`}
              />
            ))}
          </div>
          <div className="breakdown-list">
            {categories.map((c) => (
              <button key={c.id} onClick={() => (editMode ? open(c.id) : onNavigate('transactions'))}>
                <span>
                  <i style={{ background: c.color }} />
                  {c.label}
                </span>
                <strong>{money(metrics[c.id], scenario.settings.currency)}</strong>
                <small>{metrics.total ? ((metrics[c.id] / metrics.total) * 100).toFixed(1) : 0}%</small>
              </button>
            ))}
          </div>
          <div className="panel-note">
            <Check size={13} /> Synced with your local sales records
          </div>
        </div>
      </div>
      <div className="dashboard-lower">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>
                Creator performance <span className="count-label">{creators.length}</span>
              </h3>
              <p>A closer look at your roster</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('creators')}>
              View all <ArrowUpRight size={14} />
            </Button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Revenue</th>
                  <th>Fans</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c, i) => (
                  <tr key={c.id}>
                    <td>
                      <button
                        className="person-cell"
                        onClick={() => {
                          useStudio.getState().setCreator(c.id);
                          onNavigate('creator-profiles');
                        }}
                      >
                        <span className="avatar" style={{ background: c.color + '28', color: c.color }}>
                          {c.avatar ? <img src={c.avatar} alt="" /> : initials(c.name)}
                        </span>
                        <span>
                          <b>{c.name}</b>
                          <small>{c.handle.startsWith('@') ? c.handle : `@${c.handle}`}</small>
                        </span>
                        {i === 0 && <span className="tiny-tag">TOP</span>}
                      </button>
                    </td>
                    <td className="strong">{money(c.revenue, scenario.settings.currency)}</td>
                    <td>{number(c.fans)}</td>
                    <td>
                      <div className="share-progress">
                        <span
                          style={{
                            width: `${metrics.total ? (c.revenue / metrics.total) * 100 : 0}%`,
                            background: c.color,
                          }}
                        />
                      </div>
                      <small className="muted">
                        {metrics.total ? ((c.revenue / metrics.total) * 100).toFixed(1) : 0}%
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!creators.length && (
            <div className="empty-state">Add your first fictional creator in Creators.</div>
          )}
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Recent activity</h3>
              <p>Your latest simulated sales</p>
            </div>
            <button
              className="button icon ghost"
              aria-label="View sales records"
              onClick={() => onNavigate('sales-records')}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="activity-list">
            {latest.map((t) => {
              const fan = scenario.fans.find((f) => f.id === t.fanId),
                creator = scenario.creators.find((c) => c.id === t.creatorId);
              return (
                <button key={t.id} className="activity-item" onClick={() => onNavigate('sales-records')}>
                  <span className={`activity-icon ${t.category}`}>
                    <DollarSign size={16} />
                  </span>
                  <span>
                    <b>{fan?.name ?? 'Fictional fan'}</b>
                    <small>
                      {t.category === 'ppv'
                        ? 'PPV purchase'
                        : t.category === 'tip'
                          ? 'Sent a tip'
                          : t.category === 'subscription'
                            ? 'New subscription'
                            : 'Message purchase'}{' '}
                      · {creator?.name}
                    </small>
                  </span>
                  <span className="activity-amount">
                    <b>+{money(t.amount, scenario.settings.currency)}</b>
                    <small>
                      {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </small>
                  </span>
                </button>
              );
            })}
            {!latest.length && (
              <div className="empty-state">No sales in this period. Add a transaction to begin.</div>
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-footnote">
        <span>
          Reporting period: {from} — {to} · {number(tx.length)} transactions
        </span>
        <button onClick={() => onNavigate('studio')}>
          Make it yours in Studio Editor <ArrowRight size={13} />
        </button>
      </div>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editing) return;
              updateScenario((d) => {
                const key = keyFor(editing);
                if (manual) d.overrides[key] = { value: Number(value), change: Number(change), color };
                else delete d.overrides[key];
              });
              setEditing(null);
            }}
          >
            <div className="modal-header">
              <DialogTitle>Edit {editing ? definitions[editing].label : ''}</DialogTitle>
              <DialogDescription>
                {editing ? definitions[editing].hint : ''}. Overrides apply to this creator and period.
              </DialogDescription>
            </div>
            <div className="modal-body">
              <label className="field">
                Value source
                <select
                  value={manual ? 'manual' : 'calculated'}
                  onChange={(e) => setManual(e.target.value === 'manual')}
                >
                  <option value="calculated">Calculated from local data</option>
                  <option value="manual">Custom value (manual override)</option>
                </select>
              </label>
              <div className="form-grid">
                <label className="field">
                  Value
                  <input
                    aria-label="KPI value"
                    required
                    type="number"
                    step="any"
                    value={value}
                    disabled={!manual}
                    onChange={(e) => setValue(e.target.value)}
                  />
                </label>
                <label className="field">
                  Evolution (%)
                  <input
                    type="number"
                    step="any"
                    value={change}
                    disabled={!manual}
                    onChange={(e) => setChange(e.target.value)}
                  />
                </label>
              </div>
              <label className="field">
                Indicator color
                <input
                  aria-label="Indicator color"
                  type="color"
                  value={color}
                  disabled={!manual}
                  onChange={(e) => setColor(e.target.value)}
                />
              </label>
              <p className="muted">
                Custom values are marked in the dashboard and Studio Editor. Transactions remain the source
                for calculated reports.
              </p>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit">Apply changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
