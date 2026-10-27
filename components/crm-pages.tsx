'use client';
import { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  ExternalLink,
  Mail,
  Plus,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useStudio } from '@/lib/store';
import { parseScenario } from '@/lib/schema';
import { periodRange } from '@/lib/analytics';
import { initials, money, number, uid } from '@/lib/utils';
import type { Scenario, Transaction } from '@/lib/types';
import { EntityTable, type EntityRow, type EntityColumn, type EntityField } from './entity-table';
import { ChartPanel } from './chart-panel';

type Collection =
  | 'creators'
  | 'employees'
  | 'fans'
  | 'transactions'
  | 'campaigns'
  | 'links'
  | 'scripts'
  | 'smartLists'
  | 'shifts';
const text = (key: string, label: string, required = true): EntityField => ({ key, label, required });
const numeric = (key: string, label: string, max?: number): EntityField => ({
  key,
  label,
  type: 'number',
  required: true,
  min: 0,
  max,
});
const date = (key: string, label: string): EntityField => ({ key, label, type: 'date', required: true });
const options = (key: string, label: string, values: { id: string; name: string }[]): EntityField => ({
  key,
  label,
  type: 'select',
  required: true,
  options: values.map((v) => ({ value: v.id, label: v.name })),
});
const status = (key: string, label: string, values: string[]): EntityField => ({
  key,
  label,
  type: 'select',
  required: true,
  options: values.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })),
});
const toRows = (values: unknown[]): EntityRow[] => values as EntityRow[];
const sum = (ts: Transaction[]) => ts.reduce((a, t) => a + t.amount, 0);
function Avatar({ name, color, avatar }: { name: string; color?: string; avatar?: string }) {
  return (
    <span className="avatar" style={{ background: color ?? '#6856b9' }}>
      {avatar && /^data:image\/|^https?:\/\//.test(avatar) ? (
        <img
          src={avatar}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
function Person({
  name,
  subtitle,
  color,
  avatar,
}: {
  name: string;
  subtitle?: string;
  color?: string;
  avatar?: string;
}) {
  return (
    <div className="person-cell">
      <Avatar name={name} color={color} avatar={avatar} />
      <span>
        <strong>{name}</strong>
        {subtitle && <small className="muted">{subtitle}</small>}
      </span>
    </div>
  );
}
function Stats({ items }: { items: { label: string; value: string; detail?: string }[] }) {
  return (
    <div className="crm-stat-grid">
      {items.map((item) => (
        <div className="panel crm-stat" key={item.label}>
          <span className="muted">{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail && <small className="muted">{item.detail}</small>}
        </div>
      ))}
    </div>
  );
}
function scopedTransactions(s: Scenario, creatorId: string, from: string, to: string) {
  return s.transactions.filter(
    (t) =>
      (creatorId === 'all' || t.creatorId === creatorId) &&
      t.date.slice(0, 10) >= from.slice(0, 10) &&
      t.date.slice(0, 10) <= to.slice(0, 10),
  );
}
export function CrmPage({ page }: { page: string }) {
  const { scenario: s, selectedCreator, period, customRange, editMode, updateScenario } = useStudio();
  const range = periodRange(period, customRange);
  const ts = useMemo(
    () => scopedTransactions(s, selectedCreator, range.from, range.to),
    [s, selectedCreator, range.from, range.to],
  );
  const creators = s.creators.filter((c) => selectedCreator === 'all' || c.id === selectedCreator);
  const fans = s.fans.filter((f) => selectedCreator === 'all' || f.creatorId === selectedCreator);
  const currency = s.settings.currency;
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const chartEmployee = s.employees.find((employee) => employee.id === selectedEmployee) ?? s.employees[0];
  const creatorName = (id: unknown) => s.creators.find((c) => c.id === id)?.name ?? 'Unknown creator';
  const fanName = (id: unknown) => s.fans.find((f) => f.id === id)?.name ?? 'Unknown fan';
  const employeeName = (id: unknown) => s.employees.find((e) => e.id === id)?.name ?? 'Unassigned';
  function save(collection: Collection, row: EntityRow) {
    const next = structuredClone(s);
    const list = next[collection] as unknown as EntityRow[];
    const index = list.findIndex((r) => r.id === row.id);
    if (index < 0) list.push(row);
    else list[index] = row;
    if (collection === 'fans')
      next.transactions = next.transactions.map((t) =>
        t.fanId === row.id ? { ...t, creatorId: String(row.creatorId) } : t,
      );
    if (collection === 'transactions')
      next.messages = next.messages.map((m) => {
        if (m.saleId !== row.id) return m;
        return row.category === 'ppv' && m.fanId === row.fanId
          ? { ...m, ppvAmount: Number(row.amount) }
          : { ...m, saleId: undefined };
      });
    const valid = parseScenario(JSON.stringify(next));
    updateScenario((d) => Object.assign(d, valid));
  }
  function remove(collection: Collection, id: string) {
    if (collection === 'employees' && s.transactions.some((t) => t.employeeId === id))
      throw new Error(
        'Reassign this employee’s transactions in Sales records before deleting them. Historical sales are never silently attributed to another employee.',
      );
    if ((collection === 'creators' || collection === 'employees') && s[collection].length <= 1)
      throw new Error(`Keep at least one ${collection === 'creators' ? 'creator' : 'employee'}.`);
    updateScenario((d) => {
      (d[collection] as unknown as EntityRow[]) = (d[collection] as unknown as EntityRow[]).filter(
        (r) => r.id !== id,
      );
      if (collection === 'creators') {
        const fanIds = d.fans.filter((f) => f.creatorId === id).map((f) => f.id);
        d.fans = d.fans.filter((f) => f.creatorId !== id);
        d.transactions = d.transactions.filter((t) => t.creatorId !== id);
        d.messages = d.messages.filter((m) => !fanIds.includes(m.fanId));
        const campaignIds = d.campaigns.filter((c) => c.creatorId === id).map((c) => c.id);
        d.campaigns = d.campaigns.filter((c) => c.creatorId !== id);
        d.links = d.links.filter((l) => !campaignIds.includes(l.campaignId));
        for (const key of Object.keys(d.overrides)) if (key.includes(id)) delete d.overrides[key];
        for (const key of Object.keys(d.charts)) if (key.includes(id)) delete d.charts[key];
      }
      if (collection === 'fans') {
        d.transactions = d.transactions.filter((t) => t.fanId !== id);
        d.messages = d.messages.filter((m) => m.fanId !== id);
      }
      if (collection === 'employees') {
        d.shifts = d.shifts.filter((sh) => sh.employeeId !== id);
      }
      if (collection === 'campaigns') d.links = d.links.filter((l) => l.campaignId !== id);
      if (collection === 'transactions')
        d.messages = d.messages.map((m) => (m.saleId === id ? { ...m, saleId: undefined } : m));
    });
  }
  function table(
    collection: Collection,
    title: string,
    rows: EntityRow[],
    columns: EntityColumn[],
    fields: EntityField[],
    subtitle?: string,
    validate?: (r: EntityRow) => string | null,
  ) {
    return (
      <EntityTable
        key={page}
        title={title}
        subtitle={subtitle}
        rows={rows}
        columns={columns}
        fields={fields}
        editable={editMode}
        onSave={(r) => save(collection, r)}
        onDelete={(id) => remove(collection, id)}
        validate={validate}
      />
    );
  }
  const creatorFields: EntityField[] = [
    text('name', 'Name'),
    text('handle', 'Username'),
    { key: 'avatar', label: 'Profile image (local file)', type: 'image' },
    { key: 'color', label: 'Profile color', type: 'color', defaultValue: '#8b5cf6' },
    date('addedAt', 'Joined date'),
  ];
  const employeeFields: EntityField[] = [
    text('name', 'Employee name'),
    text('role', 'Role'),
    { key: 'color', label: 'Profile color', type: 'color', defaultValue: '#7c6aee' },
    numeric('hoursWorked', 'Hours worked'),
    numeric('messagesSent', 'Messages sent'),
    numeric('conversionRate', 'Conversion rate (%)', 100),
  ];
  const fanFields: EntityField[] = [
    options('creatorId', 'Creator', s.creators),
    text('name', 'Fan name'),
    text('username', 'Username'),
    { key: 'avatar', label: 'Avatar (local file)', type: 'image' },
    date('joinedAt', 'Join date'),
    status('status', 'Subscription status', ['paid', 'free', 'expired', 'renewed']),
    { key: 'tags', label: 'Tags (comma separated)', type: 'tags' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    numeric('unread', 'Unread messages'),
  ];
  const transactionFields: EntityField[] = [
    options('creatorId', 'Creator', s.creators),
    options('fanId', 'Fan', s.fans),
    options('employeeId', 'Employee', s.employees),
    date('date', 'Date'),
    status('category', 'Revenue category', [
      'subscription',
      'message',
      'tip',
      'ppv',
      'post',
      'referral',
      'stream',
    ]),
    numeric('amount', 'Amount'),
  ];
  const transactionColumns: EntityColumn[] = [
    { key: 'id', label: 'Transaction', render: (r) => <span className="mono">#{r.id.slice(0, 8)}</span> },
    { key: 'date', label: 'Date', render: (r) => new Date(String(r.date)).toLocaleDateString('en-GB') },
    { key: 'creatorId', label: 'Creator', render: (r) => creatorName(r.creatorId) },
    { key: 'fanId', label: 'Fan', render: (r) => fanName(r.fanId) },
    { key: 'employeeId', label: 'Employee', render: (r) => employeeName(r.employeeId) },
    {
      key: 'category',
      label: 'Type',
      render: (r) => <span className="badge">{String(r.category).toUpperCase()}</span>,
    },
    { key: 'amount', label: 'Amount', render: (r) => <strong>{money(Number(r.amount), currency)}</strong> },
  ];
  const creatorColumns: EntityColumn[] = [
    {
      key: 'name',
      label: 'Creator',
      render: (r) => (
        <Person
          name={String(r.name)}
          subtitle={`@${String(r.handle).replace(/^@/, '')}`}
          color={String(r.color)}
          avatar={String(r.avatar)}
        />
      ),
    },
    { key: 'addedAt', label: 'Joined', render: (r) => String(r.addedAt).slice(0, 10) },
    {
      key: 'fans',
      label: 'Fans',
      sortValue: (r) => s.fans.filter((f) => f.creatorId === r.id).length,
      render: (r) => number(s.fans.filter((f) => f.creatorId === r.id).length),
    },
    {
      key: 'revenue',
      label: 'Gross revenue',
      sortValue: (r) => sum(ts.filter((t) => t.creatorId === r.id)),
      render: (r) => money(sum(ts.filter((t) => t.creatorId === r.id)), currency),
    },
    {
      key: 'net',
      label: 'Net revenue',
      render: (r) => money(sum(ts.filter((t) => t.creatorId === r.id)) * 0.8, currency),
    },
  ];
  const fanColumns: EntityColumn[] = [
    {
      key: 'name',
      label: 'Fan',
      render: (r) => (
        <Person
          name={String(r.name)}
          subtitle={`@${String(r.username).replace(/^@/, '')}`}
          avatar={String(r.avatar)}
        />
      ),
    },
    { key: 'creatorId', label: 'Creator', render: (r) => creatorName(r.creatorId) },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span className={`badge ${r.status === 'expired' ? 'warning' : ''}`}>{String(r.status)}</span>
      ),
    },
    { key: 'joinedAt', label: 'Joined', render: (r) => String(r.joinedAt).slice(0, 10) },
    {
      key: 'spent',
      label: 'Total spent',
      sortValue: (r) => sum(ts.filter((t) => t.fanId === r.id)),
      render: (r) => money(sum(ts.filter((t) => t.fanId === r.id)), currency),
    },
    {
      key: 'tags',
      label: 'Tags',
      render: (r) => (
        <div className="tag-list">
          {(r.tags as string[]).map((tag) => (
            <span className="badge" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      ),
    },
  ];
  const employeeColumns: EntityColumn[] = [
    {
      key: 'name',
      label: 'Employee',
      render: (r) => <Person name={String(r.name)} subtitle={String(r.role)} color={String(r.color)} />,
    },
    {
      key: 'sales',
      label: 'Total sales',
      sortValue: (r) => sum(ts.filter((t) => t.employeeId === r.id)),
      render: (r) => money(sum(ts.filter((t) => t.employeeId === r.id)), currency),
    },
    { key: 'messagesSent', label: 'Messages (manual)', render: (r) => number(Number(r.messagesSent)) },
    {
      key: 'average',
      label: 'Avg. sale',
      render: (r) => {
        const sales = ts.filter((t) => t.employeeId === r.id);
        return money(sales.length ? sum(sales) / sales.length : 0, currency);
      },
    },
    { key: 'conversionRate', label: 'Conversion (manual)', render: (r) => `${r.conversionRate}%` },
    { key: 'hoursWorked', label: 'Hours (manual)', render: (r) => number(Number(r.hoursWorked)) },
    {
      key: 'hourly',
      label: 'Sales / recorded hour',
      render: (r) =>
        money(
          Number(r.hoursWorked) > 0
            ? sum(ts.filter((t) => t.employeeId === r.id)) / Number(r.hoursWorked)
            : 0,
          currency,
        ),
    },
  ];
  if (page === 'scheduling')
    return (
      <Scheduling
        scenario={s}
        editMode={editMode}
        update={updateScenario}
        fields={[
          options('employeeId', 'Employee', s.employees),
          date('date', 'Date'),
          { key: 'start', label: 'Start', type: 'time', required: true, defaultValue: '09:00' },
          { key: 'end', label: 'End', type: 'time', required: true, defaultValue: '17:00' },
        ]}
        save={(row) => save('shifts', row)}
        remove={(id) => remove('shifts', id)}
      />
    );
  if (page === 'mass-messages')
    return <MassMessages scenario={s} fans={fans} editMode={editMode} update={updateScenario} />;
  if (
    page === 'creators' ||
    page === 'creator-profiles' ||
    page === 'creator-analytics' ||
    page === 'creator-reports'
  )
    return (
      <div className="page-stack">
        <Stats
          items={[
            {
              label: 'Active creators',
              value: String(creators.length),
              detail: 'Independent local profiles',
            },
            { label: 'Gross revenue', value: money(sum(ts), currency), detail: period },
            { label: 'Fans', value: number(fans.length), detail: 'Across selected creators' },
            {
              label: 'Average per creator',
              value: money(creators.length ? sum(ts) / creators.length : 0, currency),
            },
          ]}
        />
        {page === 'creator-analytics' && (
          <ChartPanel chartId="creator-revenue-analytics" title="Creator revenue trend" />
        )}
        {page === 'creator-profiles' && (
          <div className="creator-grid">
            {creators.map((c) => {
              const tx = ts.filter((t) => t.creatorId === c.id);
              return (
                <article className="panel creator-card" key={c.id}>
                  <div
                    className="creator-card-cover"
                    style={{ background: `linear-gradient(125deg, ${c.color}66, transparent)` }}
                  />
                  <Avatar name={c.name} color={c.color} avatar={c.avatar} />
                  <h3>{c.name}</h3>
                  <p className="muted">@{c.handle.replace(/^@/, '')}</p>
                  <div className="creator-card-stats">
                    <span>
                      <strong>{money(sum(tx), currency)}</strong>
                      <small>Revenue</small>
                    </span>
                    <span>
                      <strong>{s.fans.filter((f) => f.creatorId === c.id).length}</strong>
                      <small>Fans</small>
                    </span>
                  </div>
                  <button className="button secondary" onClick={() => setSelectedProfile(c.id)}>
                    View breakdown <ArrowUpRight size={14} />
                  </button>
                </article>
              );
            })}
          </div>
        )}
        {table(
          'creators',
          page === 'creator-reports'
            ? 'Creator performance report'
            : page === 'creator-analytics'
              ? 'Creator revenue analytics'
              : 'Creators',
          toRows(creators),
          page === 'creator-analytics' || page === 'creator-reports'
            ? [
                ...creatorColumns,
                ...(['subscription', 'message', 'tip', 'ppv', 'post', 'referral', 'stream'] as const).map(
                  (category) => ({
                    key: category,
                    label: category === 'ppv' ? 'PPV' : category.charAt(0).toUpperCase() + category.slice(1),
                    sortValue: (r: EntityRow) =>
                      sum(ts.filter((t) => t.creatorId === r.id && t.category === category)),
                    render: (r: EntityRow) =>
                      money(sum(ts.filter((t) => t.creatorId === r.id && t.category === category)), currency),
                  }),
                ),
              ]
            : creatorColumns,
          creatorFields,
          'Revenue follows the selected creator and period. Fan counts are current profile totals. Edit source records to update calculations.',
        )}
        {selectedProfile &&
          (() => {
            const c = s.creators.find((c) => c.id === selectedProfile);
            if (!c) return null;
            return (
              <div className="modal-backdrop">
                <section className="modal" role="dialog" aria-modal="true" aria-label={`${c.name} analytics`}>
                  <div className="modal-header">
                    <h2>{c.name} · Revenue breakdown</h2>
                    <button
                      className="button icon"
                      aria-label="Close profile"
                      onClick={() => setSelectedProfile(null)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="modal-body">
                    <ChartPanel
                      chartId="creator-profile-revenue"
                      title={`${c.name} · Revenue trend`}
                      creatorId={c.id}
                      compact
                    />
                    {['subscription', 'message', 'tip', 'ppv', 'post', 'referral', 'stream'].map(
                      (category) => (
                        <div className="profile-metric" key={category}>
                          <span>{category}</span>
                          <strong>
                            {money(
                              sum(ts.filter((t) => t.creatorId === c.id && t.category === category)),
                              currency,
                            )}
                          </strong>
                        </div>
                      ),
                    )}
                    <p className="muted">
                      Joined {c.addedAt.slice(0, 10)} · {period}
                    </p>
                  </div>
                </section>
              </div>
            );
          })()}
      </div>
    );
  if (page === 'employees' || page === 'employee-performance' || page === 'employee-reports') {
    const ranked = [...s.employees].sort(
      (a, b) => sum(ts.filter((t) => t.employeeId === b.id)) - sum(ts.filter((t) => t.employeeId === a.id)),
    );
    return (
      <div className="page-stack">
        <Stats
          items={[
            { label: 'Team members', value: String(s.employees.length) },
            {
              label: 'Attributed sales',
              value: money(sum(ts.filter((t) => t.employeeId)), currency),
              detail: period,
            },
            {
              label: 'Messages sent',
              value: number(s.employees.reduce((n, e) => n + e.messagesSent, 0)),
              detail: 'Editable employee metric',
            },
            {
              label: 'Top performer',
              value: ranked[0]?.name ?? '—',
              detail: 'Ranked by transaction revenue',
            },
          ]}
        />
        {page === 'employee-performance' && chartEmployee && (
          <section className="page-stack">
            <div className="panel crm-table-tools">
              <label className="field">
                <span>Employee chart</span>
                <select
                  aria-label="Employee chart"
                  className="select"
                  value={chartEmployee.id}
                  onChange={(event) => setSelectedEmployee(event.target.value)}
                >
                  {s.employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </label>
              <span className="muted">
                Sales attributed to this employee within the selected creator and reporting period.
              </span>
            </div>
            <ChartPanel
              chartId="employee-sales"
              title={`${chartEmployee.name} · Sales trend`}
              employeeId={chartEmployee.id}
            />
          </section>
        )}
        {table(
          'employees',
          page === 'employees'
            ? 'Chatters & employees'
            : page === 'employee-reports'
              ? 'Employee revenue report'
              : 'Employee performance',
          toRows(ranked),
          [
            {
              key: 'rank',
              label: 'Rank',
              render: (r) => <span className="ranking">#{ranked.findIndex((e) => e.id === r.id) + 1}</span>,
            },
            ...employeeColumns,
            ...(page === 'employee-reports'
              ? (['subscription', 'message', 'tip', 'ppv', 'post', 'referral', 'stream'] as const).map(
                  (category) => ({
                    key: category,
                    label: category === 'ppv' ? 'PPV' : category.charAt(0).toUpperCase() + category.slice(1),
                    render: (r: EntityRow) =>
                      money(
                        sum(ts.filter((t) => t.employeeId === r.id && t.category === category)),
                        currency,
                      ),
                  }),
                )
              : []),
          ],
          employeeFields,
          'Sales, average sale and ranking follow the selected creator and period. Recorded messages, hours and conversion are manual scenario-wide inputs. Sales / recorded hour divides selected sales by those recorded hours.',
        )}
      </div>
    );
  }
  if (page === 'fans' || page === 'fan-reports' || page === 'segmentation')
    return (
      <div className="page-stack">
        <Stats
          items={[
            { label: 'Total fans', value: number(fans.length) },
            {
              label: 'Paid & renewed',
              value: number(fans.filter((f) => f.status === 'paid' || f.status === 'renewed').length),
            },
            { label: 'Free fans', value: number(fans.filter((f) => f.status === 'free').length) },
            {
              label: 'Revenue per fan',
              value: money(fans.length ? sum(ts) / fans.length : 0, currency),
              detail: period,
            },
          ]}
        />
        {page === 'segmentation' && (
          <div className="panel crm-banner">
            <Users size={20} />
            <div>
              <h3>Fan segmentation</h3>
              <p className="muted">
                Filter the table by status or any tag. Edit tags and notes, then use Smart Lists to save
                audiences for simulated messages.
              </p>
            </div>
          </div>
        )}
        {table(
          'fans',
          page === 'fan-reports' ? 'Fan revenue report' : 'Fans & segments',
          toRows(fans),
          fanColumns,
          fanFields,
          'Fan spend follows the selected creator and period. Subscription status and join dates are current profile records.',
        )}
      </div>
    );
  if (page === 'transactions' || page === 'sales-records' || page === 'message-reports') {
    const rows =
      page === 'message-reports' ? ts.filter((t) => t.category === 'message' || t.category === 'ppv') : ts;
    return (
      <div className="page-stack">
        <Stats
          items={[
            { label: 'Gross sales', value: money(sum(rows), currency), detail: period },
            {
              label: 'Net sales',
              value: money(sum(rows) * 0.8, currency),
              detail: 'After 20% simulated platform fee',
            },
            { label: 'Transactions', value: number(rows.length) },
            {
              label: 'Average order value',
              value: money(rows.length ? sum(rows) / rows.length : 0, currency),
            },
          ]}
        />
        {table(
          'transactions',
          page === 'message-reports'
            ? 'Message & PPV sales'
            : page === 'sales-records'
              ? 'Sales records'
              : 'Transactions',
          toRows(rows),
          transactionColumns,
          transactionFields,
          'Changes recalculate all calculated KPIs and charts immediately.',
          (r) => {
            const fan = s.fans.find((f) => f.id === r.fanId);
            return !fan
              ? 'Select an existing fan.'
              : fan.creatorId !== r.creatorId
                ? 'The selected fan belongs to another creator. Choose the matching creator.'
                : null;
          },
        )}
      </div>
    );
  }
  if (page === 'campaigns')
    return (
      <div className="page-stack">
        <Stats
          items={[
            {
              label: 'Active campaigns',
              value: String(
                s.campaigns.filter(
                  (c) =>
                    c.status === 'active' && (selectedCreator === 'all' || c.creatorId === selectedCreator),
                ).length,
              ),
            },
            {
              label: 'Total budget',
              value: money(
                s.campaigns
                  .filter((c) => selectedCreator === 'all' || c.creatorId === selectedCreator)
                  .reduce((n, c) => n + c.budget, 0),
                currency,
              ),
            },
            {
              label: 'Total clicks',
              value: number(
                s.campaigns
                  .filter((c) => selectedCreator === 'all' || c.creatorId === selectedCreator)
                  .reduce((n, c) => n + c.clicks, 0),
              ),
            },
            {
              label: 'Conversions',
              value: number(
                s.campaigns
                  .filter((c) => selectedCreator === 'all' || c.creatorId === selectedCreator)
                  .reduce((n, c) => n + c.conversions, 0),
              ),
            },
          ]}
        />
        {table(
          'campaigns',
          'Campaigns',
          toRows(s.campaigns.filter((c) => selectedCreator === 'all' || c.creatorId === selectedCreator)),
          [
            { key: 'name', label: 'Campaign' },
            { key: 'creatorId', label: 'Creator', render: (r) => creatorName(r.creatorId) },
            {
              key: 'status',
              label: 'Status',
              render: (r) => <span className="badge">{String(r.status)}</span>,
            },
            { key: 'budget', label: 'Budget', render: (r) => money(Number(r.budget), currency) },
            { key: 'clicks', label: 'Clicks' },
            { key: 'conversions', label: 'Conversions' },
            {
              key: 'rate',
              label: 'Conversion rate',
              render: (r) =>
                `${Number(r.clicks) > 0 ? ((Number(r.conversions) / Number(r.clicks)) * 100).toFixed(2) : '0.00'}%`,
            },
          ],
          [
            text('name', 'Campaign name'),
            options('creatorId', 'Creator', s.creators),
            status('status', 'Status', ['active', 'paused', 'completed']),
            numeric('budget', 'Budget'),
            numeric('clicks', 'Clicks'),
            numeric('conversions', 'Conversions'),
          ],
          'Campaigns are local planning records for the selected creator. Budget, clicks and conversions are manual, scenario-wide totals; the reporting date filter does not apply.',
          (r) => (Number(r.conversions) > Number(r.clicks) ? 'Conversions cannot exceed clicks.' : null),
        )}
      </div>
    );
  if (page === 'tracking-links')
    return table(
      'links',
      'Tracking links',
      toRows(
        s.links.filter(
          (l) =>
            selectedCreator === 'all' ||
            s.campaigns.find((c) => c.id === l.campaignId)?.creatorId === selectedCreator,
        ),
      ),
      [
        { key: 'label', label: 'Link name' },
        {
          key: 'campaignId',
          label: 'Campaign',
          render: (r) => s.campaigns.find((c) => c.id === r.campaignId)?.name ?? 'Unassigned',
        },
        { key: 'url', label: 'Destination', render: (r) => <span className="mono">{String(r.url)}</span> },
        { key: 'clicks', label: 'Simulated clicks' },
        {
          key: 'copy',
          label: 'Copy',
          render: (r) => (
            <button
              className="button secondary small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(String(r.url));
                  alert('Link copied. This is a simulated tracking record.');
                } catch {
                  alert('Clipboard unavailable. You can copy the URL from the table.');
                }
              }}
            >
              <Copy size={14} />
              Copy
            </button>
          ),
        },
      ],
      [
        text('label', 'Label'),
        options('campaignId', 'Campaign', s.campaigns),
        text('url', 'Destination URL'),
        numeric('clicks', 'Simulated clicks'),
      ],
      'Local tracking records only. Click counts are editable and never collected externally.',
      (r) => {
        try {
          const url = new URL(String(r.url));
          return ['https:', 'http:'].includes(url.protocol) ? null : 'Use an HTTP or HTTPS URL.';
        } catch {
          return 'Enter a valid URL.';
        }
      },
    );
  if (page === 'scripts')
    return table(
      'scripts',
      'Message scripts',
      toRows(s.scripts),
      [
        { key: 'title', label: 'Script name' },
        {
          key: 'content',
          label: 'Message content',
          render: (r) => <span className="script-preview">{String(r.content)}</span>,
        },
        {
          key: 'copy',
          label: 'Copy script',
          render: (r) => (
            <button
              className="button secondary small"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(String(r.content));
                  alert('Script copied.');
                } catch {
                  alert('Clipboard unavailable. Select and copy the script text.');
                }
              }}
            >
              <Copy size={14} />
              Copy
            </button>
          ),
        },
      ],
      [text('title', 'Title'), { key: 'content', label: 'Content', type: 'textarea', required: true }],
      'Reusable local message templates. Available in Messages Pro.',
    );
  if (page === 'smart-lists')
    return table(
      'smartLists',
      'Smart lists',
      toRows(s.smartLists),
      [
        { key: 'name', label: 'Audience name' },
        { key: 'tag', label: 'Matching tag', render: (r) => <span className="badge">{String(r.tag)}</span> },
        {
          key: 'matches',
          label: 'Matching fans',
          render: (r) =>
            fans.filter((f) => f.tags.some((t) => t.toLowerCase() === String(r.tag).toLowerCase())).length,
        },
      ],
      [text('name', 'List name'), text('tag', 'Matching fan tag')],
      'Lists match fan tags automatically. Add a matching tag to a fan to include them.',
    );
  return <div className="empty-state">Choose a CRM module from the sidebar.</div>;
}

function Scheduling({
  scenario: s,
  editMode,
  update,
  fields,
  save,
  remove,
}: {
  scenario: Scenario;
  editMode: boolean;
  update: (fn: (draft: Scenario) => void) => void;
  fields: EntityField[];
  save: (row: EntityRow) => void;
  remove: (id: string) => void;
}) {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  function moveWeek(offset: number) {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    setWeekStart(d.toISOString().slice(0, 10));
  }
  return (
    <div className="page-stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Team schedule</h3>
            <p className="muted">
              {editMode
                ? 'Drag shifts between days to reschedule. Use the table below to add and edit time slots.'
                : 'Enable Edit mode to move, add or edit shifts.'}
            </p>
          </div>
          <div className="crm-actions">
            <button className="button icon" aria-label="Previous week" onClick={() => moveWeek(-7)}>
              <ChevronLeft size={16} />
            </button>
            <input
              aria-label="Schedule week start"
              className="input"
              type="date"
              value={weekStart}
              onChange={(e) => {
                if (e.target.value) setWeekStart(e.target.value);
              }}
            />
            <button className="button icon" aria-label="Next week" onClick={() => moveWeek(7)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="schedule-grid">
          {days.map((day) => (
            <div
              className="schedule-day"
              key={day}
              onDragOver={(e) => {
                if (editMode) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!editMode) return;
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                update((d) => {
                  const shift = d.shifts.find((sh) => sh.id === id);
                  if (shift) shift.date = day;
                });
              }}
            >
              <div className="schedule-day-heading">
                <strong>
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short' })}
                </strong>
                <span className="muted">{day.slice(8)}</span>
              </div>
              {s.shifts
                .filter((sh) => sh.date.slice(0, 10) === day)
                .sort((a, b) => a.start.localeCompare(b.start))
                .map((sh) => {
                  const e = s.employees.find((emp) => emp.id === sh.employeeId);
                  return (
                    <div
                      className="shift-card"
                      style={{ borderLeft: `3px solid ${e?.color ?? '#8b5cf6'}` }}
                      draggable={editMode}
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', sh.id)}
                      key={sh.id}
                    >
                      <strong>{e?.name ?? 'Unassigned'}</strong>
                      <span>
                        {sh.start} – {sh.end}
                      </span>
                    </div>
                  );
                })}
              <small className="muted">
                {s.shifts.filter((sh) => sh.date.slice(0, 10) === day).length} shifts
              </small>
            </div>
          ))}
        </div>
      </div>
      <EntityTable
        title="Shifts"
        subtitle="Local schedule, independent of employee hours worked. Edit hours in employee records when needed."
        rows={toRows(s.shifts)}
        columns={[
          {
            key: 'employeeId',
            label: 'Employee',
            render: (r) => s.employees.find((e) => e.id === r.employeeId)?.name ?? 'Unassigned',
          },
          { key: 'date', label: 'Date' },
          { key: 'start', label: 'Start' },
          { key: 'end', label: 'End' },
          {
            key: 'duration',
            label: 'Duration',
            render: (r) => {
              const minutes = (time: unknown) => {
                const [h, m] = String(time).split(':').map(Number);
                return h * 60 + m;
              };
              return `${((minutes(r.end) - minutes(r.start)) / 60).toFixed(1)} h`;
            },
          },
        ]}
        fields={fields}
        editable={editMode}
        onSave={save}
        onDelete={remove}
        validate={(r) => (String(r.end) <= String(r.start) ? 'End time must be after start time.' : null)}
      />
    </div>
  );
}
function MassMessages({
  scenario: s,
  fans,
  editMode,
  update,
}: {
  scenario: Scenario;
  fans: Scenario['fans'];
  editMode: boolean;
  update: (fn: (draft: Scenario) => void) => void;
}) {
  const [audience, setAudience] = useState('all'),
    [text, setText] = useState(''),
    [amount, setAmount] = useState(0),
    [sent, setSent] = useState('');
  const targets = fans.filter((f) => audience === 'all' || f.tags.includes(audience));
  const tags = [...new Set(fans.flatMap((f) => f.tags))];
  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!editMode || !text.trim() || !targets.length || amount < 0 || !Number.isFinite(amount)) return;
    update((d) => {
      const now = new Date().toISOString();
      for (const fan of targets)
        d.messages.push({
          id: uid(),
          fanId: fan.id,
          direction: 'out',
          text: text.trim(),
          date: now,
          ppvAmount: amount,
          image: '',
        });
    });
    setSent(
      `${targets.length} simulated messages added to local conversations. No message was sent externally.`,
    );
    setText('');
  }
  return (
    <div className="crm-two-column">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Compose mass message</h3>
            <p className="muted">Create messages in your simulated conversations.</p>
          </div>
          <Mail size={20} />
        </div>
        <form className="modal-body" onSubmit={send}>
          <label className="field">
            <span>Audience</span>
            <select className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>
              <option value="all">All fans of selected creator</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Insert script</span>
            <select
              className="select"
              aria-label="Insert script"
              defaultValue=""
              onChange={(e) => {
                const script = s.scripts.find((sc) => sc.id === e.target.value);
                if (script) setText(script.content);
                e.target.value = '';
              }}
            >
              <option value="">Choose a saved script…</option>
              {s.scripts.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Message</span>
            <textarea
              className="input"
              rows={7}
              required
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message for your simulated fans…"
            />
          </label>
          <label className="field">
            <span>PPV price (0 = free message)</span>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </label>
          <button className="button primary" disabled={!editMode || targets.length === 0} type="submit">
            <Send size={16} />
            Add {targets.length} local messages
          </button>
          {!editMode && <p className="muted">Enable Edit mode to create messages.</p>}
          {sent && (
            <p role="status" className="success-message">
              {sent}
            </p>
          )}
        </form>
      </section>
      <section className="panel">
        <div className="panel-header">
          <h3>Audience preview</h3>
          <span className="badge">{targets.length} fans</span>
        </div>
        <div className="modal-body">
          <p className="muted">
            Only fictitious local conversations are changed. PPV purchases must be simulated separately in
            Messages Pro.
          </p>
          {targets.slice(0, 12).map((fan) => (
            <div className="audience-preview-row" key={fan.id}>
              <Person name={fan.name} subtitle={fan.status} avatar={fan.avatar} />
              <span className="badge">{fan.tags[0] ?? 'Fan'}</span>
            </div>
          ))}
          {targets.length > 12 && <p className="muted">And {targets.length - 12} more fans…</p>}
        </div>
      </section>
    </div>
  );
}
