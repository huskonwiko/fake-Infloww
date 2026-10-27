'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ArrowRight,
  Info,
  BookmarkPlus,
  FileText,
  MessageCircle,
  Gift,
  Award,
  Radio,
  Users,
  RefreshCw,
  Tag,
  UserRound,
  Sparkles,
  X,
  Search,
  Pencil,
  Clock3,
  Plus,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useStudio } from '@/lib/store';
import { money, initials } from '@/lib/utils';
import { periodRange } from '@/lib/analytics';
import { revenueAmount, type RevenueMetric, type RevenueScope } from '@/lib/reconcile';
import { LinkedValue, LinkedChange } from './linked-value';
import { LinkedRevenueChart } from './linked-revenue-chart';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import type { Period } from '@/lib/types';

const channels: { id: RevenueMetric; label: string; icon: typeof Users; color: string }[] = [
  { id: 'subscriptions', label: 'Subscriptions', icon: BookmarkPlus, color: '#15b9a5' },
  { id: 'posts', label: 'Posts', icon: FileText, color: '#1fb999' },
  { id: 'messages', label: 'Messages', icon: MessageCircle, color: '#b35bdf' },
  { id: 'tips', label: 'Tips', icon: Gift, color: '#375dff' },
  { id: 'referrals', label: 'Referrals', icon: Award, color: '#e76160' },
  { id: 'streams', label: 'Streams', icon: Radio, color: '#365aff' },
];
const periods: Period[] = [
  'Today',
  'Yesterday',
  'This Week',
  'Last 7 days',
  'Last 30 days',
  'This Month',
  'Last Month',
  'Custom Date',
];
function useRevenueScope(): RevenueScope {
  const { selectedCreator, period, customRange, scenario } = useStudio();
  return {
    creatorId: selectedCreator,
    ...periodRange(period, customRange),
    net: scenario.settings.netEarnings !== false,
  };
}
function InfoMark({ text }: { text: string }) {
  return (
    <span className="ref-info" tabIndex={0} title={text} aria-label={text}>
      <Info size={15} />
    </span>
  );
}
function EmptyDocument({ text }: { text: string }) {
  return (
    <div className="ref-empty-document">
      <svg width="116" height="106" viewBox="0 0 116 106" aria-hidden="true">
        <g stroke="#505050" strokeWidth="2">
          <path d="M17 15l-6-5M94 17l6-7M10 50H2M108 48h7M29 5l-2-5M84 4l2-4" />
          <circle cx="7" cy="33" r="1.5" />
          <circle cx="106" cy="32" r="1.5" />
        </g>
        <path
          d="M32 14h39l22 20v53a12 12 0 01-12 12H32a12 12 0 01-12-12V26a12 12 0 0112-12z"
          fill="#5a5a5a"
          stroke="#a5a5a5"
          strokeWidth="3"
        />
        <path d="M70 15v17h22" fill="#aaa" stroke="#aaa" strokeWidth="3" strokeLinejoin="round" />
        <path d="M30 27h24M30 35h31M30 43h10" stroke="#a5a5a5" strokeWidth="4" strokeLinecap="round" />
        <path d="M39 57h8M64 57h8M47 77h17" stroke="#3d66ff" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <span>{text}</span>
    </div>
  );
}
export function ReferenceDashboard({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { scenario, period, setPeriod, updateScenario, selectedCreator } = useStudio();
  const scope = useRevenueScope();
  const [employee, setEmployee] = useState('all');
  const clocked = scenario.settings.clockedIn ?? [];
  const relevantShifts = scenario.shifts
    .filter((shift) => shift.date >= scope.from.slice(0, 10) && shift.date <= scope.to.slice(0, 10))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return (
    <div className="ref-dashboard">
      <section className="ref-panel ref-earnings-summary">
        <div className="ref-overview-heading">
          <div className="ref-heading-inline">
            <h1>Creator earnings overview</h1>
            <InfoMark text="Click any amount to edit matching simulated transactions. All reports stay linked." />
            <span className="ref-timezone">UTC+00:00</span>
            <InfoMark text="Revenue periods use UTC calendar dates." />
          </div>
          <div className="ref-overview-controls">
            <select
              aria-label="Earnings basis"
              className="ref-basis-select"
              value={scope.net ? 'net' : 'gross'}
              onChange={(e) =>
                updateScenario((d) => {
                  d.settings.netEarnings = e.target.value === 'net';
                })
              }
            >
              <option value="net">Net earnings</option>
              <option value="gross">Gross earnings</option>
            </select>
            <div className="ref-period-pills">
              {(['Yesterday', 'Today', 'This Week', 'This Month'] as Period[]).map((p) => (
                <button key={p} className={period === p ? 'active' : ''} onClick={() => setPeriod(p)}>
                  {p === 'This Week' ? 'This week' : p === 'This Month' ? 'This month' : p}
                </button>
              ))}
              {!['Yesterday', 'Today', 'This Week', 'This Month'].includes(period) && (
                <span className="ref-current-period">{period}</span>
              )}
            </div>
          </div>
        </div>
        <div className="ref-summary-grid">
          <div className="ref-total">
            <span className="ref-total-emblem">
              <Sparkles size={27} />
            </span>
            <span className="ref-total-label">Total earnings</span>
            <LinkedValue metric="total" scope={scope} label="Total earnings" className="ref-total-number" />
          </div>
          <div className="ref-category-pairs">
            {[0, 1, 2].map((i) => (
              <div className="ref-category-pair" key={i}>
                {[channels[i], channels[i + 3]].map((c) => {
                  const Icon = c.icon;
                  return (
                    <div className="ref-summary-category" key={c.id}>
                      <div>
                        <LinkedValue metric={c.id} scope={scope} label={`${c.label} earnings`} />
                        <span>{c.label}</span>
                      </div>
                      <span
                        className="ref-channel-icon"
                        style={{ color: c.color, background: c.color + '16' }}
                      >
                        <Icon size={24} />
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="ref-dashboard-grid">
        <section className="ref-panel ref-shifts">
          <div className="ref-card-heading">
            <h2>My shifts</h2>
            <InfoMark text="Local shifts in the selected reporting period." />
            <button
              className="ref-subtle-button"
              onClick={() => onNavigate('scheduling')}
              aria-label="Edit shifts"
            >
              <Pencil size={15} />
            </button>
          </div>
          {relevantShifts.length ? (
            <div className="ref-shift-list">
              {relevantShifts.slice(0, 8).map((sh) => {
                const person = scenario.employees.find((e) => e.id === sh.employeeId);
                return (
                  <button key={sh.id} onClick={() => onNavigate('scheduling')}>
                    <span className="ref-shift-day">
                      {new Date(sh.date + 'T12:00:00Z').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </span>
                    <strong>{person?.name}</strong>
                    <span>
                      {sh.start} — {sh.end}
                    </span>
                  </button>
                );
              })}
              <button className="ref-add-shift" onClick={() => onNavigate('scheduling')}>
                <Plus size={14} /> Manage shifts
              </button>
            </div>
          ) : (
            <>
              <EmptyDocument text="No data" />
              <button className="ref-empty-action" onClick={() => onNavigate('scheduling')}>
                Add a shift
              </button>
            </>
          )}
        </section>
        <div className="ref-dashboard-main">
          <section className="ref-panel ref-clocked">
            <div className="ref-card-heading">
              <h2>Current clocked-in employees</h2>
              <Users size={16} />
              <span>{clocked.length}</span>
            </div>
            {clocked.length ? (
              <div className="ref-clocked-list">
                {clocked.map((session) => {
                  const employee = scenario.employees.find((e) => e.id === session.employeeId);
                  return (
                    <button key={session.employeeId} onClick={() => onNavigate('employee-performance')}>
                      <span className="avatar" style={{ background: employee?.color }}>
                        {initials(employee?.name ?? 'Employee')}
                      </span>
                      <span>
                        <strong>{employee?.name}</strong>
                        <small>
                          <Clock3 size={12} /> Since{' '}
                          {new Date(session.startedAt).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'UTC',
                          })}{' '}
                          UTC
                        </small>
                      </span>
                      <span className="ref-online-dot" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyDocument text="No employees have clocked in." />
            )}
          </section>
          <section className="ref-panel ref-employee-sales">
            <div className="ref-employee-plot-header">
              <select
                aria-label="Employee sales filter"
                value={employee}
                onChange={(e) => setEmployee(e.target.value)}
              >
                <option value="all">All employees</option>
                {scenario.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Dashboard creator"
                value={selectedCreator}
                onChange={(e) => useStudio.getState().setCreator(e.target.value)}
              >
                <option value="all">All creators</option>
                {scenario.creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <LinkedRevenueChart
              title="Employee sales"
              scope={{ ...scope, employeeId: employee }}
              type="line"
              color="#385dff"
              grain="day"
            />
          </section>
        </div>
      </div>
      <p className="ref-local-footnote">
        Fictional data · Click an amount or a graph point to edit · Automatically saved on this browser
      </p>
    </div>
  );
}
function DateFilter() {
  const { period, customRange, setPeriod, setRange } = useStudio();
  const range = periodRange(period, customRange);
  const details = useRef<HTMLDetailsElement>(null);
  const [from, setFrom] = useState(range.from),
    [to, setTo] = useState(range.to),
    [error, setError] = useState('');
  useEffect(() => {
    setFrom(range.from);
    setTo(range.to);
  }, [range.from, range.to]);
  const format = (d: string) =>
    new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  return (
    <details className="ref-date-picker" ref={details}>
      <summary>
        <CalendarDays size={17} />
        <span>{format(range.from)}</span>
        <ArrowRight size={16} />
        <span>{format(range.to)}</span>
        <ChevronDown size={15} />
      </summary>
      <div className="ref-date-popover">
        <label className="field">
          Reporting period
          <select
            aria-label="Reporting period"
            value={period}
            onChange={(e) => {
              const next = e.target.value as Period;
              setPeriod(next);
              if (next !== 'Custom Date' && details.current) details.current.open = false;
            }}
          >
            {periods.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            Start date
            <input
              aria-label="Start date"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            End date
            <input aria-label="End date" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button
          size="sm"
          onClick={() => {
            try {
              setRange({ from, to });
              setPeriod('Custom Date');
              setError('');
              if (details.current) details.current.open = false;
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Choose valid dates.');
            }
          }}
        >
          Apply dates
        </Button>
      </div>
    </details>
  );
}
export function CreatorReports({ onNavigate }: { onNavigate: (p: string) => void }) {
  const { scenario, selectedCreator, setCreator, period, customRange, setPeriod, updateScenario, saveNow } =
    useStudio();
  const base = useRevenueScope();
  const [tab, setTab] = useState('overview');
  const [tag, setTag] = useState('');
  const [tagsOpen, setTagsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [grain, setGrain] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [lineGrain, setLineGrain] = useState<'hour' | 'day' | 'week' | 'month'>('day');
  const [notice, setNotice] = useState('');
  const scope: RevenueScope = {
    ...base,
    creatorIds: tag ? scenario.creators.filter((c) => c.tags?.includes(tag)).map((c) => c.id) : undefined,
  };
  const allTags = [...new Set(scenario.creators.flatMap((c) => c.tags ?? []))];
  const selectedCreators = scenario.creators.filter(
    (c) =>
      (selectedCreator === 'all' || selectedCreator === c.id) &&
      (!tag || c.tags?.includes(tag)) &&
      `${c.name} ${c.handle}`.toLowerCase().includes(query.toLowerCase()),
  );
  const currency = scenario.settings.currency;
  const donut = useRef<HTMLDivElement>(null);
  const values = channels.map((c) => ({ ...c, value: revenueAmount(scenario, scope, c.id) }));
  const total = revenueAmount(scenario, scope, 'total');
  const reset = () => {
    setCreator('all');
    setPeriod('Last 30 days');
    setTag('');
    setQuery('');
    updateScenario((d) => {
      d.settings.netEarnings = true;
    });
  };
  return (
    <div className="ref-reports">
      <div className="ref-report-title">
        <div className="ref-heading-inline">
          <h1>Creator reports</h1>
          <span className="ref-timezone">UTC+00:00</span>
          <InfoMark text="All charts and summaries are calculated from the same local transactions." />
        </div>
        <button
          className="ref-refresh"
          aria-label="Refresh reports"
          onClick={() => {
            void saveNow()
              .then(() => {
                setNotice('Reports are up to date.');
                setTimeout(() => setNotice(''), 2500);
              })
              .catch(() => setNotice('Local save failed. Export a backup.'));
          }}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <div className="ref-report-tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button className={tab === 'performance' ? 'active' : ''} onClick={() => setTab('performance')}>
          Creator performance
        </button>
      </div>
      <div className="ref-report-filters">
        <DateFilter />
        <div className="ref-tag-filter">
          <Tag size={15} />
          <select
            aria-label="Creator tag"
            value={tag}
            onChange={(e) => {
              if (e.target.value === '__edit__') setTagsOpen(true);
              else setTag(e.target.value);
            }}
          >
            <option value="">Creator tag</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="__edit__">Edit creator tags…</option>
          </select>
          <ChevronDown size={13} />
        </div>
        <div className="ref-tag-filter">
          <UserRound size={15} />
          <select
            aria-label="Select creator"
            value={selectedCreator}
            onChange={(e) => setCreator(e.target.value)}
          >
            <option value="all">Creator</option>
            {scenario.creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </div>
        <div className="ref-net-toggle">
          <span>Show net earnings</span>
          <button
            role="switch"
            aria-label="Show net earnings"
            aria-checked={!!scope.net}
            aria-pressed={!!scope.net}
            className={scope.net ? 'on' : ''}
            onClick={() =>
              updateScenario((d) => {
                d.settings.netEarnings = !scope.net;
              })
            }
          >
            <i />
          </button>
        </div>
        <button className="ref-reset-filters" onClick={reset}>
          Reset
        </button>
        {notice && (
          <span role="status" className="ref-refresh-notice">
            {notice}
          </span>
        )}
      </div>
      <h2 className="ref-section-title">
        Earnings summary{' '}
        <InfoMark text="Click any figure to edit its source sales. Percentage changes compare equal-length periods." />
      </h2>
      <section className="ref-panel ref-report-summary">
        <div className="ref-report-total">
          <span>
            <Sparkles size={21} /> Total earnings
          </span>
          <LinkedValue label="Total earnings" metric="total" scope={scope} />
          <LinkedChange label="Total earnings" metric="total" scope={scope} />
        </div>
        <div className="ref-report-category-grid">
          {[0, 3, 1, 4, 2, 5].map((i) => {
            const c = channels[i],
              Icon = c.icon;
            return (
              <div key={c.id} className="ref-report-category">
                <span>
                  <Icon size={19} />
                  {c.label}
                </span>
                <LinkedValue label={`${c.label} earnings`} metric={c.id} scope={scope} />
                <LinkedChange label={c.label} metric={c.id} scope={scope} />
              </div>
            );
          })}
        </div>
      </section>
      {tab === 'overview' ? (
        <>
          <LinkedRevenueChart
            title="Earnings trends"
            scope={scope}
            type="bar"
            color="#b75f3e"
            grain={grain}
            onGrainChange={setGrain}
          />
          <div className="ref-report-chart-grid">
            <LinkedRevenueChart
              title="Earnings by channel"
              scope={scope}
              type="line"
              channels
              grain={lineGrain}
              onGrainChange={setLineGrain}
            />
            <section className="ref-panel ref-breakdown" ref={donut}>
              <div className="ref-card-heading">
                <h2>Earnings breakdown</h2>
              </div>
              <div className="ref-donut-plot">
                <ResponsiveContainer width="100%" height={245} initialDimension={{ width: 360, height: 245 }}>
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={values}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={72}
                      outerRadius={103}
                      paddingAngle={3}
                      stroke="none"
                      onClick={(_, index) => {
                        donut.current
                          ?.querySelector<HTMLButtonElement>(
                            `[data-testid="linked-value-${values[index].id}"]`,
                          )
                          ?.click();
                      }}
                    >
                      {values.map((v) => (
                        <Cell key={v.id} fill={v.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--panel)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                      }}
                      formatter={(v) => money(Number(v), currency)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="ref-donut-total">
                  <small>Total earnings</small>
                  <strong>{money(total, currency)}</strong>
                </div>
              </div>
              <div className="ref-donut-legend">
                {values.map((v) => (
                  <div key={v.id}>
                    <i style={{ background: v.color }} />
                    <span>{v.label}</span>
                    <LinkedValue label={`${v.label} earnings`} metric={v.id} scope={scope} small />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : (
        <section className="ref-panel ref-performance-chart">
          <LinkedRevenueChart
            title="Creator performance"
            scope={scope}
            type="line"
            channels
            grain={grain}
            onGrainChange={setGrain}
          />
        </section>
      )}
      <section className="ref-panel ref-creator-table">
        <div className="ref-card-heading">
          <h2>Creator performance</h2>
          <label className="ref-table-search">
            <Search size={14} />
            <input
              aria-label="Search creator performance"
              placeholder="Search creators"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Creator</th>
                <th>Total earnings</th>
                {channels.map((c) => (
                  <th key={c.id}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedCreators.map((c) => (
                <tr key={c.id} data-creator-id={c.id}>
                  <td>
                    <button
                      className="person-cell"
                      onClick={() => {
                        setCreator(c.id);
                        onNavigate('creator-profiles');
                      }}
                    >
                      <span className="avatar" style={{ background: c.color + '22', color: c.color }}>
                        {c.avatar ? <img src={c.avatar} alt="" /> : initials(c.name)}
                      </span>
                      <span>
                        <strong>{c.name}</strong>
                        <small>{c.handle}</small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <LinkedValue
                      label={`${c.name} total earnings`}
                      metric="total"
                      scope={{ ...scope, creatorId: c.id }}
                      small
                    />
                  </td>
                  {channels.map((channel) => (
                    <td key={channel.id}>
                      <LinkedValue
                        label={`${c.name} ${channel.label.toLowerCase()}`}
                        metric={channel.id}
                        scope={{ ...scope, creatorId: c.id }}
                        small
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {!selectedCreators.length && (
            <div className="empty-state">
              No creators match these filters. Reset the filters or edit creator tags.
            </div>
          )}
        </div>
      </section>
      <p className="ref-local-footnote">
        {period} · {periodRange(period, customRange).from} — {periodRange(period, customRange).to} · All
        amounts stay synchronized with your local transactions
      </p>
      <Dialog open={tagsOpen} onOpenChange={setTagsOpen}>
        <DialogContent>
          <div className="modal-header">
            <DialogTitle>Edit creator tags</DialogTitle>
            <DialogDescription>
              Separate tags with commas. Tags filter every graph and amount in this report.
            </DialogDescription>
          </div>
          <div className="modal-body">
            {scenario.creators.map((c) => (
              <label className="field" key={c.id}>
                {c.name}
                <input
                  aria-label={`${c.name} tags`}
                  defaultValue={c.tags?.join(', ') ?? ''}
                  onBlur={(e) => {
                    const tags = [
                      ...new Set(
                        e.target.value
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ];
                    updateScenario((d) => {
                      d.creators.find((x) => x.id === c.id)!.tags = tags;
                    });
                  }}
                />
              </label>
            ))}
          </div>
          <div className="modal-footer">
            <Button onClick={() => setTagsOpen(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
