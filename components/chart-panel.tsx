'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartNoAxesCombined, Check, Download, Grip, Plus, Settings2, Trash2, Upload, X } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { chartData } from '@/lib/analytics';
import { download, money, uid } from '@/lib/utils';
import type { ChartConfig, ChartPoint, ChartSeries, Period, Scenario } from '@/lib/types';

const palette = ['#a694ff', '#56cbb5', '#f8b96b', '#71a9ff', '#f18bb8', '#c3d77b'];
const validDay = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

/** RFC-4180-style CSV reader: supports quoted commas, quotes and line breaks. */
export function parseChartCSV(
  text: string,
  existing: ChartSeries[] = [],
): { series: ChartSeries[]; points: ChartPoint[] } {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = '',
    quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || cell === '') quoted = !quoted;
      else throw new Error('Invalid quote in CSV.');
    } else if (!quoted && (c === ',' || c === '\n' || c === '\r')) {
      row.push(cell);
      cell = '';
      if (c !== ',') {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        if (c === '\r' && source[i + 1] === '\n') i++;
      }
    } else cell += c;
  }
  if (quoted) throw new Error('An opening quote has no closing quote.');
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length < 2 || rows[0].length < 2 || rows[0][0].trim().toLowerCase() !== 'date')
    throw new Error('Expected a date column, at least one series, and one data row.');
  if (rows.length > 5001) throw new Error('Import up to 5,000 points at a time.');
  const headers = rows[0].slice(1).map((h) => h.trim());
  if (headers.some((h) => !h) || new Set(headers.map((h) => h.toLowerCase())).size !== headers.length)
    throw new Error('Every series must have a unique, nonempty name.');
  const series = headers.map((label, i) => {
    const match = existing.find((s) => s.label.toLowerCase() === label.toLowerCase() || s.id === label);
    return {
      id: match?.id || `series-${i}-${uid()}`,
      label: match?.label || label,
      color: match?.color || palette[i % palette.length],
    };
  });
  const points = rows.slice(1).map((r, i) => {
    const date = r[0].trim();
    if (r.length !== headers.length + 1 || !validDay(date))
      throw new Error(`Row ${i + 2}: use YYYY-MM-DD and a value for every series.`);
    const values: Record<string, number> = {};
    series.forEach((s, k) => {
      const n = Number(r[k + 1].trim());
      if (!r[k + 1].trim() || !Number.isFinite(n))
        throw new Error(`Row ${i + 2}: values must be finite numbers.`);
      values[s.id] = n;
    });
    return { id: uid(), date, values };
  });
  return { series, points: points.sort((a, b) => a.date.localeCompare(b.date)) };
}

export function serializeChartCSV(config: Pick<ChartConfig, 'series' | 'points'>): string {
  const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  return [
    ['date', ...config.series.map((s) => s.label)],
    ...config.points.map((p) => [p.date, ...config.series.map((s) => p.values[s.id] ?? 0)]),
  ]
    .map((r) => r.map(escape).join(','))
    .join('\r\n');
}

/** Aggregate only the transactions belonging to the requested employee and creator. */
export function scopedChartData(
  scenario: Scenario,
  creatorId: string,
  period: Period,
  customRange: { from: string; to: string },
  employeeId?: string,
) {
  const source = employeeId
    ? { ...scenario, transactions: scenario.transactions.filter((t) => t.employeeId === employeeId) }
    : scenario;
  return chartData(source, creatorId, period, customRange);
}

function Plot({
  config,
  compact = false,
  currency,
}: {
  config: ChartConfig;
  compact?: boolean;
  currency: string;
}) {
  const gradientId = useId().replaceAll(':', '');
  const data = config.points.map((p) => ({ date: p.date, ...p.values }));
  const axes = (
    <>
      <CartesianGrid stroke="var(--border, #2a2a37)" strokeDasharray="3 6" vertical={false} />
      <XAxis
        dataKey="date"
        axisLine={false}
        tickLine={false}
        minTickGap={40}
        tick={{ fill: '#858597', fontSize: 11 }}
        tickFormatter={(d) =>
          new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        }
      />
      <YAxis
        width={52}
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#858597', fontSize: 11 }}
        domain={[config.yMin ?? 'auto', config.yMax ?? 'auto']}
        tickFormatter={(n) =>
          new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency,
            notation: 'compact',
            maximumFractionDigits: 1,
          }).format(n)
        }
        allowDataOverflow={config.yMin !== null || config.yMax !== null}
      />
      <Tooltip
        contentStyle={{
          background: 'var(--surface, #1b1b26)',
          border: '1px solid var(--border, #343443)',
          borderRadius: 10,
          color: 'var(--text, #f4f3ff)',
        }}
        formatter={(v) => money(Number(v), currency)}
        labelFormatter={(d) => String(d)}
      />
      <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 12, paddingTop: 16 }} />
    </>
  );
  return (
    <div
      style={{ width: '100%', height: compact ? 220 : 300 }}
      aria-label={`${config.title}, ${config.type} chart, ${data.length} editable points`}
      role="img"
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        initialDimension={{ width: 800, height: compact ? 220 : 300 }}
      >
        {config.type === 'bar' ? (
          <BarChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
            {axes}
            {config.series.map((s) => (
              <Bar
                key={s.id}
                dataKey={s.id}
                name={s.label}
                fill={s.color}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        ) : config.type === 'line' ? (
          <LineChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
            {axes}
            {config.series.map((s) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.label}
                stroke={s.color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 16, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {config.series.map((s) => (
                <linearGradient
                  key={s.id}
                  id={`fill-${gradientId}-${s.id.replaceAll(':', '-')}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.27} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0.015} />
                </linearGradient>
              ))}
            </defs>
            {axes}
            {config.series.map((s) => (
              <Area
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.label}
                stroke={s.color}
                fill={`url(#fill-${gradientId}-${s.id.replaceAll(':', '-')})`}
                strokeWidth={2.5}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function PointCanvas({
  config,
  onChange,
  currency,
}: {
  config: ChartConfig;
  onChange: (id: string, seriesId: string, value: number) => void;
  currency: string;
}) {
  const [seriesId, setSeriesId] = useState(config.series[0]?.id || '');
  const [drag, setDrag] = useState<{ id: string; value: number } | null>(null);
  const activeSeries = config.series.find((s) => s.id === seriesId) || config.series[0];
  const svg = useRef<SVGSVGElement>(null);
  if (!activeSeries || !config.points.length) return null;
  const visible = config.points.slice(0, 120);
  const values = visible.map((p) => p.values[activeSeries.id] || 0);
  const min = config.yMin ?? Math.min(0, ...values),
    max = config.yMax ?? Math.max(1, ...values) * 1.15;
  const span = Math.max(1, max - min),
    width = 850,
    height = 160;
  const x = (i: number) => 36 + (i / Math.max(1, visible.length - 1)) * (width - 68);
  const y = (value: number) => 12 + (1 - (value - min) / span) * (height - 36);
  const valueFromPointer = (clientY: number) => {
    const bounds = svg.current!.getBoundingClientRect();
    const py = ((clientY - bounds.top) / bounds.height) * height;
    return Math.round((min + (1 - Math.max(0, Math.min(1, (py - 12) / (height - 36)))) * span) * 100) / 100;
  };
  return (
    <div style={{ margin: '16px 0', padding: 14, border: '1px solid var(--border)', borderRadius: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          <Grip size={13} style={{ display: 'inline' }} /> Drag a point to change its value · arrows adjust
          selected points
        </span>
        <select
          aria-label="Curve to drag"
          className="select"
          value={activeSeries.id}
          onChange={(e) => setSeriesId(e.target.value)}
        >
          {config.series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', display: 'block', touchAction: 'none', overflow: 'visible' }}
        onPointerMove={(e) => {
          if (drag) setDrag({ ...drag, value: valueFromPointer(e.clientY) });
        }}
        onPointerUp={() => {
          if (drag) {
            onChange(drag.id, activeSeries.id, drag.value);
            setDrag(null);
          }
        }}
        onPointerCancel={() => setDrag(null)}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="36"
              x2={width - 32}
              y1={12 + t * (height - 36)}
              y2={12 + t * (height - 36)}
              stroke="var(--border)"
              strokeDasharray="4 5"
            />
            <text x="0" y={16 + t * (height - 36)} fill="#858597" fontSize="10">
              {Math.round(max - t * span)}
            </text>
          </g>
        ))}
        <polyline
          points={visible
            .map((p, i) => `${x(i)},${y(drag?.id === p.id ? drag.value : p.values[activeSeries.id] || 0)}`)
            .join(' ')}
          fill="none"
          stroke={activeSeries.color}
          strokeWidth="2"
        />
        {visible.map((p, i) => (
          <circle
            key={p.id}
            cx={x(i)}
            cy={y(drag?.id === p.id ? drag.value : p.values[activeSeries.id] || 0)}
            r={drag?.id === p.id ? 7 : 4.5}
            fill={activeSeries.color}
            stroke="var(--surface, #171720)"
            strokeWidth="2"
            tabIndex={0}
            role="slider"
            aria-label={`${p.date} ${activeSeries.label}`}
            aria-valuenow={p.values[activeSeries.id] || 0}
            aria-valuemin={min}
            aria-valuemax={max}
            style={{ cursor: 'ns-resize' }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                onChange(
                  p.id,
                  activeSeries.id,
                  (p.values[activeSeries.id] || 0) + (e.key === 'ArrowUp' ? 10 : -10),
                );
              }
            }}
            onPointerDown={(e) => {
              svg.current?.setPointerCapture(e.pointerId);
              setDrag({ id: p.id, value: p.values[activeSeries.id] || 0 });
            }}
          >
            <title>
              {p.date}: {money(drag?.id === p.id ? drag.value : p.values[activeSeries.id] || 0, currency)}
            </title>
          </circle>
        ))}
        {drag && (
          <text x="40" y="154" fill={activeSeries.color} fontSize="12">
            {money(drag.value, currency)}
          </text>
        )}
      </svg>
      {config.points.length > 120 && (
        <small className="muted">
          Drag view shows the first 120 points. All points are available in the table.
        </small>
      )}
    </div>
  );
}

export function ChartPanel({
  chartId,
  title = 'Revenue overview',
  compact = false,
  creatorId,
  employeeId,
}: {
  chartId: string;
  title?: string;
  compact?: boolean;
  creatorId?: string;
  employeeId?: string;
}) {
  const {
    scenario,
    selectedCreator: globalSelectedCreator,
    period,
    customRange,
    editMode,
    updateScenario,
  } = useStudio();
  const selectedCreator = creatorId ?? globalSelectedCreator;
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState('0');
  const [bulkSeries, setBulkSeries] = useState('');
  const source = useMemo(
    () => scopedChartData(scenario, selectedCreator, period, customRange, employeeId),
    [scenario, selectedCreator, period, customRange, employeeId],
  );
  const scopedChartId = employeeId ? `${chartId}:employee:${employeeId}` : chartId;
  const scope = `${scopedChartId}:${selectedCreator}:${period}${period === 'Custom Date' ? `:${customRange.from}:${customRange.to}` : ''}`;
  const saved = scenario.charts[scope];
  const defaultSeries: ChartSeries[] = [
    { id: 'revenue', label: 'Total earnings', color: palette[0] },
    { id: 'messages', label: 'Message revenue', color: palette[1] },
  ];
  const generated: ChartConfig = {
    title,
    type: 'area',
    series: defaultSeries,
    points: source.map((p) => ({
      id: p.date,
      date: p.date,
      values: {
        revenue: p.revenue,
        subscriptions: p.subscriptions,
        messages: p.messages,
        tips: p.tips,
        ppv: p.ppv,
      },
    })),
    manual: false,
    yMin: 0,
    yMax: null,
  };
  const config: ChartConfig = saved
    ? { ...saved, points: saved.manual ? saved.points : generated.points }
    : generated;
  useEffect(() => {
    const node = dialog.current;
    if (open && node && !node.open) node.showModal();
    else if (!open && node?.open) node.close();
  }, [open]);
  useEffect(() => {
    setSelected(new Set());
    setError('');
  }, [scope, scenario.id]);
  const patch = (recipe: (draft: ChartConfig) => void, manual = false) => {
    updateScenario((d) => {
      const next = structuredClone(config);
      if (!manual && saved && !config.manual) next.points = structuredClone(saved.points);
      if (manual) next.manual = true;
      recipe(next);
      d.charts[scope] = next;
    });
  };
  const setPoint = (id: string, series: string, value: number) => {
    if (!Number.isFinite(value)) return;
    patch((d) => {
      const p = d.points.find((p) => p.id === id);
      if (p) p.values[series] = value;
    }, true);
  };
  const total = config.points.reduce((sum, p) => sum + (p.values[config.series[0]?.id] || 0), 0);
  return (
    <section className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h3>{config.title}</h3>
          <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
            {config.manual
              ? 'Customized data · independent of transactions'
              : 'Calculated from local transactions'}{' '}
            <span style={{ opacity: 0.5 }}> / </span> {period}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${config.manual ? 'warning' : ''}`}>
            {config.manual ? 'Custom' : 'Live data'}
          </span>
          {editMode && (
            <button
              className="button small secondary"
              onClick={() => setOpen(true)}
              aria-label={`Edit ${config.title}`}
            >
              <Settings2 size={14} /> Edit chart
            </button>
          )}
        </div>
      </div>
      <div
        style={{ padding: '10px 18px 10px 10px', cursor: editMode ? 'pointer' : undefined }}
        role={editMode ? 'button' : undefined}
        tabIndex={editMode ? 0 : undefined}
        aria-label={editMode ? `Open ${config.title} editor` : undefined}
        onClick={() => {
          if (editMode) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (editMode && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Plot config={config} compact={compact} currency={scenario.settings.currency} />
      </div>
      <div
        style={{
          padding: '0 24px 18px',
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span className="muted">
          {config.points.length} data points · {config.series.length} series
        </span>
        <span>
          {money(total, scenario.settings.currency)} <span className="muted">in selected period</span>
        </span>
      </div>
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby={`chart-title-${chartId}`}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const bounds = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < bounds.left ||
              e.clientX > bounds.right ||
              e.clientY < bounds.top ||
              e.clientY > bounds.bottom
            )
              setOpen(false);
          }
        }}
        style={{
          width: 'min(1050px, calc(100vw - 32px))',
          maxHeight: '90vh',
          padding: 0,
          border: '1px solid var(--border)',
          borderRadius: 16,
          color: 'var(--text)',
          background: 'var(--surface, #171720)',
        }}
      >
        <div className="modal-header">
          <div>
            <h2 id={`chart-title-${chartId}`} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <ChartNoAxesCombined size={20} /> Chart studio
            </h2>
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Changes autosave to this creator and period. Transaction data stays intact.
            </p>
          </div>
          <button className="button icon" aria-label="Close chart editor" onClick={() => setOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div
          className="modal-body"
          style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 160px)', padding: 24 }}
        >
          <div
            className="form-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}
          >
            <label className="field">
              Chart title
              <input
                className="input"
                value={config.title}
                onChange={(e) =>
                  patch((d) => {
                    d.title = e.target.value;
                  })
                }
              />
            </label>
            <label className="field">
              Chart type
              <select
                className="select"
                value={config.type}
                onChange={(e) =>
                  patch((d) => {
                    d.type = e.target.value as ChartConfig['type'];
                  })
                }
              >
                <option value="area">Area</option>
                <option value="line">Line</option>
                <option value="bar">Bar</option>
              </select>
            </label>
            <label className="field">
              Data mode
              <select
                className="select"
                value={config.manual ? 'custom' : 'calculated'}
                onChange={(e) =>
                  patch((d) => {
                    d.manual = e.target.value === 'custom';
                  })
                }
              >
                <option value="calculated">Calculated</option>
                <option value="custom">Customized</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginTop: 14 }}>
            <label className="field">
              Y-axis minimum
              <input
                className="input"
                type="number"
                placeholder="Auto"
                value={config.yMin ?? ''}
                onChange={(e) => {
                  const n = e.target.value === '' ? null : Number(e.target.value);
                  if (n === null || config.yMax === null || n < config.yMax)
                    patch((d) => {
                      d.yMin = n;
                    });
                }}
              />
            </label>
            <label className="field">
              Y-axis maximum
              <input
                className="input"
                type="number"
                placeholder="Auto"
                value={config.yMax ?? ''}
                onChange={(e) => {
                  const n = e.target.value === '' ? null : Number(e.target.value);
                  if (n === null || config.yMin === null || n > config.yMin)
                    patch((d) => {
                      d.yMax = n;
                    });
                }}
              />
            </label>
            <button
              className="button secondary small"
              onClick={() => {
                download(
                  `${chartId}-${period.replaceAll(' ', '-')}.csv`,
                  serializeChartCSV(config),
                  'text/csv;charset=utf-8',
                );
              }}
            >
              <Download size={14} /> Export CSV
            </button>
            <button className="button secondary small" onClick={() => file.current?.click()}>
              <Upload size={14} /> Import CSV
            </button>
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv"
              aria-label="Import chart CSV"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const imported = parseChartCSV(await f.text(), config.series);
                  patch((d) => {
                    d.series = imported.series;
                    d.points = imported.points;
                  }, true);
                  setSelected(new Set());
                  setError('');
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Could not read CSV.');
                }
                e.target.value = '';
              }}
            />
          </div>
          {error && (
            <p role="alert" style={{ color: '#ff8c97', marginTop: 10 }}>
              {error}
            </p>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            CSV columns: date,{config.series.map((s) => s.label).join(',')}. Dates use YYYY-MM-DD. Editing
            points enables customized mode.
          </p>
          {open && <Plot config={config} compact currency={scenario.settings.currency} />}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 16,
              marginBottom: 12,
            }}
          >
            <h3>Series & legend</h3>
            <button
              className="button secondary small"
              onClick={() =>
                patch((d) => {
                  const id = uid();
                  d.series.push({
                    id,
                    label: `Series ${d.series.length + 1}`,
                    color: palette[d.series.length % palette.length],
                  });
                  d.points.forEach((p) => {
                    p.values[id] = 0;
                  });
                }, true)
              }
            >
              <Plus size={14} /> Add series
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {config.series.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <input
                  type="color"
                  aria-label={`${s.label} color`}
                  value={s.color}
                  onChange={(e) =>
                    patch((d) => {
                      d.series.find((x) => x.id === s.id)!.color = e.target.value;
                    })
                  }
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    background: 'transparent',
                    border: 0,
                    cursor: 'pointer',
                  }}
                />
                <input
                  className="input"
                  aria-label={`${s.label} legend`}
                  value={s.label}
                  onChange={(e) =>
                    patch((d) => {
                      d.series.find((x) => x.id === s.id)!.label = e.target.value;
                    })
                  }
                  style={{ width: 145 }}
                />
                <button
                  className="button icon small"
                  aria-label={`Delete series ${s.label}`}
                  disabled={config.series.length <= 1}
                  onClick={() =>
                    patch((d) => {
                      d.series = d.series.filter((x) => x.id !== s.id);
                      d.points.forEach((p) => {
                        delete p.values[s.id];
                      });
                    }, true)
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <PointCanvas config={config} onChange={setPoint} currency={scenario.settings.currency} />
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <h3>
              Editable data{' '}
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                ({config.points.length} points)
              </span>
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="button secondary small"
                disabled={!selected.size}
                onClick={() => {
                  patch((d) => {
                    d.points = d.points.filter((p) => !selected.has(p.id));
                  }, true);
                  setSelected(new Set());
                }}
              >
                <Trash2 size={14} /> Delete selected
              </button>
              <button
                className="button primary small"
                onClick={() =>
                  patch((d) => {
                    const last = d.points.at(-1)?.date || new Date().toISOString().slice(0, 10);
                    const date = new Date(`${last}T12:00:00Z`);
                    date.setUTCDate(date.getUTCDate() + 1);
                    d.points.push({
                      id: uid(),
                      date: date.toISOString().slice(0, 10),
                      values: Object.fromEntries(d.series.map((s) => [s.id, 0])),
                    });
                  }, true)
                }
              >
                <Plus size={14} /> Add point
              </button>
            </div>
          </div>
          {selected.size > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
                padding: 12,
                background: 'var(--hover, #222231)',
                borderRadius: 8,
                marginBottom: 12,
              }}
            >
              <span className="muted">{selected.size} selected</span>
              <select
                className="select"
                aria-label="Bulk series"
                value={config.series.find((s) => s.id === bulkSeries)?.id || config.series[0]?.id}
                onChange={(e) => setBulkSeries(e.target.value)}
              >
                {config.series.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ width: 120 }}
                type="number"
                aria-label="Bulk point value"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
              />
              <button
                className="button secondary small"
                onClick={() => {
                  const n = Number(bulkValue);
                  if (Number.isFinite(n))
                    patch((d) => {
                      d.points.forEach((p) => {
                        if (selected.has(p.id))
                          p.values[d.series.find((s) => s.id === bulkSeries)?.id || d.series[0].id] = n;
                      });
                    }, true);
                }}
              >
                <Check size={14} /> Apply value
              </button>
            </div>
          )}
          <div className="table-wrap" style={{ maxHeight: 350, overflow: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all chart points"
                      checked={config.points.length > 0 && selected.size === config.points.length}
                      onChange={(e) =>
                        setSelected(e.target.checked ? new Set(config.points.map((p) => p.id)) : new Set())
                      }
                    />
                  </th>
                  <th>Date</th>
                  {config.series.map((s) => (
                    <th key={s.id}>{s.label}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {config.points.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select point ${p.date}`}
                        checked={selected.has(p.id)}
                        onChange={(e) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        className="input"
                        aria-label={`Point date ${p.date}`}
                        value={p.date}
                        onChange={(e) => {
                          if (validDay(e.target.value))
                            patch((d) => {
                              d.points.find((x) => x.id === p.id)!.date = e.target.value;
                              d.points.sort((a, b) => a.date.localeCompare(b.date));
                            }, true);
                        }}
                      />
                    </td>
                    {config.series.map((s) => (
                      <td key={s.id}>
                        <input
                          type="number"
                          step="any"
                          className="input"
                          aria-label={`${p.date} ${s.label} value`}
                          value={p.values[s.id] ?? 0}
                          onChange={(e) => setPoint(p.id, s.id, Number(e.target.value))}
                          style={{ minWidth: 100 }}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        className="button icon small"
                        aria-label={`Delete point ${p.date}`}
                        onClick={() => {
                          patch((d) => {
                            d.points = d.points.filter((x) => x.id !== p.id);
                          }, true);
                          setSelected((prev) => {
                            const next = new Set(prev);
                            next.delete(p.id);
                            return next;
                          });
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!config.points.length && (
              <div className="empty-state">Add a point or import a CSV file to start a new curve.</div>
            )}
          </div>
        </div>
        <div
          className="modal-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <span className="muted" style={{ fontSize: 12 }}>
            <Check size={13} style={{ display: 'inline' }} /> Saved automatically ·{' '}
            {config.manual ? 'Custom values' : 'Calculated values'}
          </span>
          <button className="button primary" onClick={() => setOpen(false)}>
            Done
          </button>
        </div>
      </dialog>
    </section>
  );
}
