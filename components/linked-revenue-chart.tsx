'use client';
import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Info } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { revenueSeries, reconcileRevenue, type RevenueScope, type RevenueMetric } from '@/lib/reconcile';
import { money } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
type Grain = 'hour' | 'day' | 'week' | 'month';
export function LinkedRevenueChart({
  title,
  scope,
  type = 'bar',
  metric = 'total',
  grain = 'day',
  onGrainChange,
  color = '#b75f3e',
  channels = false,
}: {
  title: string;
  scope: RevenueScope;
  type?: 'bar' | 'line';
  metric?: RevenueMetric;
  grain?: Grain;
  onGrainChange?: (g: Grain) => void;
  color?: string;
  channels?: boolean;
  editable?: boolean;
}) {
  const { scenario, updateScenario } = useStudio();
  const data = revenueSeries(scenario, scope, grain);
  const [selected, setSelected] = useState<number | null>(null);
  const [field, setField] = useState<RevenueMetric>(metric);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [channel, setChannel] = useState<RevenueMetric>('messages');
  const chartKeys = channels
    ? (['subscriptions', 'posts', 'messages', 'tips', 'referrals', 'streams'] as RevenueMetric[])
    : [metric];
  const colors = ['#62b157', '#d99353', '#ac76cd', '#3972fa', '#f18581', '#39bba6'];
  const open = (i: number, k: RevenueMetric) => {
    setSelected(i);
    setField(k);
    setDraft(String((data[i] as unknown as Record<string, number>)[k] ?? 0));
    setError('');
  };
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="#333333" />
      <XAxis
        dataKey="date"
        tickLine={false}
        axisLine={false}
        minTickGap={35}
        tick={{ fill: '#999', fontSize: 12 }}
        tickFormatter={(d) =>
          grain === 'hour'
            ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
            : new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: 'UTC',
              })
        }
      />
      <YAxis
        width={57}
        tickLine={false}
        axisLine={false}
        tick={{ fill: '#999', fontSize: 12 }}
        domain={[0, 'auto']}
        tickFormatter={(v) => money(Number(v), scenario.settings.currency).replace('.00', '')}
      />
      <Tooltip
        contentStyle={{ background: '#222', border: '1px solid #444', borderRadius: 8 }}
        formatter={(v) => money(Number(v), scenario.settings.currency)}
      />
    </>
  );
  return (
    <section className="ref-panel ref-linked-chart" data-chart-title={title}>
      <div className="ref-card-heading">
        <h2>{title}</h2>
        <Info size={15} />
        {channels && (
          <select
            aria-label="Channel to edit"
            value={channel}
            onChange={(e) => setChannel(e.target.value as RevenueMetric)}
          >
            {chartKeys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        )}
        <div className="ref-chart-grains">
          {onGrainChange &&
            (['hour', 'day', 'week', 'month'] as Grain[]).map((g) => (
              <button key={g} className={grain === g ? 'active' : ''} onClick={() => onGrainChange(g)}>
                {g[0].toUpperCase() + g.slice(1)}
              </button>
            ))}
        </div>
      </div>
      <div className="ref-chart-canvas">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 300 }}>
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 18, right: 14, bottom: 6, left: 0 }}>
              {axes}
              <Bar
                isAnimationActive={false}
                dataKey={metric}
                fill={color}
                stroke="#df987a"
                radius={[3, 3, 0, 0]}
                maxBarSize={38}
                onClick={(_, i) => open(i, metric)}
                shape={(p: unknown) => {
                  const a = p as { x: number; y: number; width: number; height: number; index: number };
                  return (
                    <rect
                      x={a.x}
                      y={a.y}
                      width={a.width}
                      height={Math.max(5, a.height)}
                      rx={3}
                      fill={color}
                      stroke="#da9272"
                      tabIndex={0}
                      role="button"
                      aria-label={`Edit revenue ${data[a.index]?.date}`}
                      onClick={() => open(a.index, metric)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          open(a.index, metric);
                        }
                      }}
                    />
                  );
                }}
              />
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 18, right: 14, bottom: 6, left: 0 }}>
              {axes}
              {chartKeys.map((k, index) => (
                <Line
                  key={k}
                  type="linear"
                  dataKey={k}
                  stroke={channels ? colors[index] : color}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  activeDot={false}
                  dot={(p: unknown) => {
                    const a = p as { cx: number; cy: number; index: number };
                    return (
                      <circle
                        key={`${k}-${a.index}`}
                        cx={a.cx}
                        cy={a.cy}
                        r={4.5}
                        fill="#fff"
                        stroke={channels ? colors[index] : color}
                        strokeWidth={2}
                        tabIndex={0}
                        role="button"
                        aria-label={`Edit ${k === 'total' ? 'revenue' : k} ${data[a.index]?.date}`}
                        onClick={() => open(a.index, k)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') open(a.index, k);
                        }}
                      />
                    );
                  }}
                />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <div className="ref-chart-edit-dates">
        <label>
          Click a point to edit, or select a date
          <select
            aria-label={`Edit date for ${title}`}
            value=""
            onChange={(e) => {
              if (e.target.value !== '') open(Number(e.target.value), channels ? channel : metric);
            }}
          >
            <option value="">Select date…</option>
            {data.map((d, i) => (
              <option key={d.date} value={i}>
                {d.date}
              </option>
            ))}
          </select>
        </label>
        <span className="ref-linked-chart-total">
          {money(
            data.reduce((n, d) => n + d.total, 0),
            scenario.settings.currency,
          )}
        </span>
      </div>
      <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selected === null) return;
              try {
                const n = Number(draft);
                if (draft.trim() === '') throw new Error('Enter an amount.');
                updateScenario((d) =>
                  reconcileRevenue(
                    d,
                    { ...scope, from: data[selected].from, to: data[selected].to },
                    field,
                    n,
                  ),
                );
                setSelected(null);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not update this point.');
              }
            }}
          >
            <div className="modal-header">
              <DialogTitle>Edit chart value</DialogTitle>
              <DialogDescription>
                {selected === null ? '' : data[selected]?.date} · {field} · {scope.net ? 'Net' : 'Gross'}{' '}
                earnings
              </DialogDescription>
            </div>
            <div className="modal-body">
              <label className="field">
                Amount
                <input
                  autoFocus
                  aria-label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <p className="muted">
                Matching transactions change together. The summary, other graphs and fan spending recalculate
                automatically.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
