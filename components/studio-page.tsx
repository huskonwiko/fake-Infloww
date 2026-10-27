'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Save,
  RotateCcw,
  Copy,
  Undo2,
  Redo2,
  Download,
  Upload,
  Plus,
  Trash2,
  Code2,
  Table2,
  SlidersHorizontal,
  ChartNoAxesCombined,
  GripVertical,
} from 'lucide-react';
import { useStudio } from '@/lib/store';
import { calculateMetrics } from '@/lib/analytics';
import { parseScenario } from '@/lib/schema';
import { download, uid } from '@/lib/utils';
import type { Scenario } from '@/lib/types';
import { ChartPanel } from '@/components/chart-panel';

type SheetName =
  | 'transactions'
  | 'creators'
  | 'employees'
  | 'fans'
  | 'messages'
  | 'campaigns'
  | 'shifts'
  | 'scripts'
  | 'smartLists'
  | 'links';
type Column = {
  key: string;
  label: string;
  type?: 'number' | 'date' | 'datetime-local' | 'color' | 'text' | 'time';
  choices?: string[];
  reference?: 'creators' | 'employees' | 'fans' | 'campaigns';
  array?: boolean;
  optional?: boolean;
};
const sheets: Record<SheetName, Column[]> = {
  transactions: [
    { key: 'creatorId', label: 'Creator', reference: 'creators' },
    { key: 'fanId', label: 'Fan', reference: 'fans' },
    { key: 'employeeId', label: 'Employee', reference: 'employees' },
    { key: 'date', label: 'Date', type: 'datetime-local' },
    {
      key: 'category',
      label: 'Category',
      choices: ['subscription', 'message', 'tip', 'ppv', 'post', 'referral', 'stream'],
    },
    { key: 'amount', label: 'Amount', type: 'number' },
  ],
  creators: [
    { key: 'name', label: 'Name' },
    { key: 'handle', label: 'Handle' },
    { key: 'avatar', label: 'Avatar image data URL' },
    { key: 'color', label: 'Accent', type: 'color' },
    { key: 'addedAt', label: 'Added', type: 'date' },
  ],
  employees: [
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    { key: 'color', label: 'Accent', type: 'color' },
    { key: 'hoursWorked', label: 'Hours worked', type: 'number' },
    { key: 'messagesSent', label: 'Messages sent', type: 'number' },
    { key: 'conversionRate', label: 'Conversion %', type: 'number' },
  ],
  fans: [
    { key: 'creatorId', label: 'Creator', reference: 'creators' },
    { key: 'name', label: 'Name' },
    { key: 'username', label: 'Username' },
    { key: 'avatar', label: 'Avatar image data URL' },
    { key: 'joinedAt', label: 'Joined', type: 'date' },
    { key: 'status', label: 'Status', choices: ['paid', 'free', 'expired', 'renewed'] },
    { key: 'tags', label: 'Tags (comma separated)', array: true },
    { key: 'notes', label: 'Notes' },
    { key: 'unread', label: 'Unread', type: 'number' },
  ],
  messages: [
    { key: 'fanId', label: 'Fan', reference: 'fans' },
    { key: 'direction', label: 'Direction', choices: ['in', 'out'] },
    { key: 'text', label: 'Text' },
    { key: 'date', label: 'Date', type: 'datetime-local' },
    { key: 'ppvAmount', label: 'PPV amount', type: 'number' },
    { key: 'image', label: 'Image data URL' },
    { key: 'saleId', label: 'Linked transaction', optional: true },
  ],
  campaigns: [
    { key: 'creatorId', label: 'Creator', reference: 'creators' },
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status', choices: ['active', 'paused', 'completed'] },
    { key: 'budget', label: 'Budget', type: 'number' },
    { key: 'clicks', label: 'Clicks', type: 'number' },
    { key: 'conversions', label: 'Conversions', type: 'number' },
  ],
  shifts: [
    { key: 'employeeId', label: 'Employee', reference: 'employees' },
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'start', label: 'Start', type: 'time' },
    { key: 'end', label: 'End', type: 'time' },
  ],
  scripts: [
    { key: 'title', label: 'Title' },
    { key: 'content', label: 'Content' },
  ],
  smartLists: [
    { key: 'name', label: 'Name' },
    { key: 'tag', label: 'Tag' },
  ],
  links: [
    { key: 'campaignId', label: 'Campaign', reference: 'campaigns' },
    { key: 'label', label: 'Label' },
    { key: 'url', label: 'URL' },
    { key: 'clicks', label: 'Clicks', type: 'number' },
  ],
};
const metricLabels: Record<string, string> = {
  total: 'Total earnings',
  gross: 'Gross revenue',
  net: 'Net revenue',
  subscriptions: 'Subscription revenue',
  messages: 'Message revenue',
  tips: 'Tips revenue',
  ppv: 'PPV revenue',
  arpu: 'Average revenue per fan',
  subscribers: 'Total subscribers',
  newSubscribers: 'New subscribers',
  expired: 'Expired subscribers',
  renewed: 'Renewed subscribers',
  renewalRate: 'Renewal rate',
  freeFans: 'Free fans',
  paidFans: 'Paid fans',
  conversionRate: 'Conversion rate',
  averageOrderValue: 'Average order value',
  growth: 'Revenue growth',
  daily: 'Daily revenue',
  weekly: 'Weekly revenue',
  monthly: 'Monthly revenue',
};
const today = () => new Date().toISOString().slice(0, 10);
function records(scenario: Scenario, sheet: SheetName): Record<string, unknown>[] {
  return scenario[sheet] as unknown as Record<string, unknown>[];
}
function defaultRow(s: Scenario, sheet: SheetName): Record<string, unknown> {
  const id = uid(),
    date = today(),
    creatorId = s.creators[0]?.id ?? '',
    fanId = s.fans[0]?.id ?? '',
    employeeId = s.employees[0]?.id ?? '';
  const defaults: Record<SheetName, Record<string, unknown>> = {
    transactions: {
      id,
      creatorId,
      fanId,
      employeeId,
      date: date + 'T12:00:00.000Z',
      category: 'message',
      amount: 0,
    },
    creators: { id, name: 'New creator', handle: 'new.creator', avatar: '', color: '#a78bfa', addedAt: date },
    employees: {
      id,
      name: 'New employee',
      role: 'Chatter',
      color: '#7dd3fc',
      hoursWorked: 0,
      messagesSent: 0,
      conversionRate: 0,
    },
    fans: {
      id,
      creatorId,
      name: 'New fan',
      username: 'new.fan',
      avatar: '',
      joinedAt: date,
      status: 'free',
      tags: [],
      notes: '',
      unread: 0,
    },
    messages: {
      id,
      fanId,
      direction: 'out',
      text: 'New simulated message',
      date: date + 'T12:00:00.000Z',
      ppvAmount: 0,
      image: '',
    },
    campaigns: {
      id,
      creatorId,
      name: 'New campaign',
      status: 'paused',
      budget: 0,
      clicks: 0,
      conversions: 0,
    },
    shifts: { id, employeeId, date, start: '09:00', end: '17:00' },
    scripts: { id, title: 'New script', content: 'Your simulated message template' },
    smartLists: { id, name: 'New list', tag: 'new' },
    links: {
      id,
      campaignId: s.campaigns[0]?.id ?? '',
      label: 'New tracking link',
      url: 'https://example.com/demo',
      clicks: 0,
    },
  };
  return defaults[sheet];
}

export function StudioPage() {
  const store = useStudio();
  const {
    scenario,
    selectedCreator,
    period,
    customRange,
    updateScenario,
    undo,
    redo,
    canUndo,
    canRedo,
    saveStatus,
    saveError,
    saveNow,
    duplicateScenario,
    resetScenario,
    importScenario,
  } = store;
  const [tab, setTab] = useState('statistics');
  const [sheet, setSheet] = useState<SheetName>('transactions');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [json, setJson] = useState('');
  const importRef = useRef<HTMLInputElement>(null);
  const metrics = calculateMetrics(scenario, selectedCreator, period, customRange);
  useEffect(() => {
    setPage(0);
  }, [sheet, query]);
  const setFailure = (e: unknown) => {
    setError(e instanceof Error ? e.message : 'The data could not be saved.');
    setNotice('');
  };
  function mutate(recipe: (draft: Scenario) => void) {
    try {
      const candidate = structuredClone(scenario);
      recipe(candidate);
      parseScenario(JSON.stringify(candidate));
      updateScenario(recipe);
      setError('');
      setNotice('Change saved to the scenario.');
      return true;
    } catch (e) {
      setFailure(e);
      return false;
    }
  }
  function cell(id: string, column: Column, value: string) {
    return mutate((d) => {
      const row = records(d, sheet).find((x) => x.id === id);
      if (!row) return;
      let v: unknown = value;
      if (column.type === 'number') {
        if (!value.trim()) throw new Error(`${column.label} requires a number.`);
        v = Number(value);
        if (!Number.isFinite(v)) throw new Error('Enter a finite number.');
      }
      if (column.type === 'datetime-local') {
        const dt = new Date(value + 'Z');
        if (Number.isNaN(dt.getTime())) throw new Error('Enter a valid date.');
        v = dt.toISOString();
      }
      if (column.array)
        v = value
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
      if (column.optional && !value.trim()) delete row[column.key];
      else row[column.key] = v;
      if (sheet === 'transactions') {
        if (column.key === 'creatorId') {
          const fan = d.fans.find((f) => f.creatorId === row.creatorId);
          if (!fan) throw new Error('Add a fan for this creator before assigning a transaction.');
          row.fanId = fan.id;
        }
        if (column.key === 'fanId') {
          const fan = d.fans.find((f) => f.id === row.fanId);
          if (fan) row.creatorId = fan.creatorId;
        }
        const linked = d.messages.find((m) => m.saleId === row.id);
        if (linked) {
          linked.fanId = String(row.fanId);
          linked.ppvAmount = Number(row.amount);
          linked.date = String(row.date);
          if (row.category !== 'ppv') throw new Error('A linked message sale must remain a PPV transaction.');
        }
      }
      if (sheet === 'fans' && column.key === 'creatorId')
        d.transactions
          .filter((t) => t.fanId === row.id)
          .forEach((t) => {
            t.creatorId = String(row.creatorId);
          });
      if (sheet === 'messages' && Number(row.ppvAmount) > 0 && !row.saleId) {
        const fan = d.fans.find((f) => f.id === row.fanId);
        if (!fan) throw new Error('Choose a valid fan.');
        const saleId = uid();
        row.saleId = saleId;
        d.transactions.push({
          id: saleId,
          creatorId: fan.creatorId,
          fanId: fan.id,
          employeeId: d.employees[0].id,
          date: String(row.date),
          category: 'ppv',
          amount: Number(row.ppvAmount),
        });
      }

      if (sheet === 'messages' && row.saleId) {
        const tx = d.transactions.find((t) => t.id === row.saleId);
        if (tx) {
          tx.amount = Number(row.ppvAmount);
          tx.date = String(row.date);
          const fan = d.fans.find((f) => f.id === row.fanId);
          if (fan) {
            tx.fanId = fan.id;
            tx.creatorId = fan.creatorId;
          }
        }
      }
    });
  }
  function remove(id: string) {
    if (
      !confirm(
        'Delete this row? Referenced profiles cannot be removed until their dependent records are reassigned or removed.',
      )
    )
      return;
    mutate((d) => {
      if (sheet === 'messages') {
        const msg = d.messages.find((m) => m.id === id);
        if (msg?.saleId) d.transactions = d.transactions.filter((t) => t.id !== msg.saleId);
      }
      if (sheet === 'transactions')
        d.messages
          .filter((m) => m.saleId === id)
          .forEach((m) => {
            delete m.saleId;
            m.ppvAmount = 0;
          });
      const list = records(d, sheet),
        i = list.findIndex((x) => x.id === id);
      if (i >= 0) list.splice(i, 1);
    });
  }
  const rows = records(scenario, sheet).filter(
    (row) => !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()),
  );
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, Math.ceil(rows.length / 15) - 1)));
  }, [rows.length]);
  const visible = rows.slice(page * 15, (page + 1) * 15);
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('Choose a backup smaller than 20 MB.');
      importScenario(await file.text());
      setNotice('Scenario imported.');
      setError('');
    } catch (e) {
      setFailure(e);
    }
  }
  return (
    <>
      <div className="panel" style={{ padding: '18px 22px', marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span className="badge" style={{ marginBottom: 8 }}>
              YOUR CONTROL ROOM
            </span>
            <h3 style={{ margin: 0 }}>Shape every detail.</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              Changes are applied immediately and saved locally. Calculated and custom values stay distinct.
            </p>
          </div>
          <span className="badge" role="status">
            {saveStatus === 'saved'
              ? 'All changes saved'
              : saveStatus === 'saving'
                ? 'Saving changes…'
                : 'Storage error'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
          <button
            className="button primary"
            onClick={() => {
              void saveNow()
                .then(() => setNotice('Workspace saved to IndexedDB.'))
                .catch(setFailure);
            }}
          >
            <Save size={15} /> Save
          </button>
          <button
            className="button secondary"
            onClick={() => {
              if (
                confirm('Reset this scenario to fresh demonstration data? Other scenarios are preserved.')
              ) {
                resetScenario();
                setNotice('Scenario reset.');
              }
            }}
          >
            <RotateCcw size={15} /> Reset
          </button>
          <button
            className="button secondary"
            onClick={() => {
              duplicateScenario();
              setNotice('Independent copy created.');
            }}
          >
            <Copy size={15} /> Duplicate
          </button>
          <button
            className="button secondary icon"
            aria-label="Undo change"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="button secondary icon"
            aria-label="Redo change"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>
          <button className="button secondary" onClick={() => importRef.current?.click()}>
            <Upload size={15} /> Import
          </button>
          <input
            type="file"
            hidden
            accept="application/json,.json"
            ref={importRef}
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button
            className="button secondary"
            onClick={() => {
              download(
                `${scenario.name.replace(/[^a-z0-9-]/gi, '-')}.json`,
                JSON.stringify(scenario, null, 2),
              );
              setNotice('Complete scenario exported.');
            }}
          >
            <Download size={15} /> Export
          </button>
        </div>
        {notice && (
          <p role="status" className="muted" style={{ marginBottom: 0 }}>
            {notice}
          </p>
        )}
        {(error || saveError) && (
          <p role="alert" style={{ color: '#fb7185', overflowWrap: 'anywhere' }}>
            {error || saveError}
          </p>
        )}
      </div>
      <div className="tabs" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'statistics', name: 'Statistics', Icon: SlidersHorizontal },
          { id: 'sheets', name: 'Data sheets', Icon: Table2 },
          { id: 'charts', name: 'Chart studio', Icon: ChartNoAxesCombined },
          { id: 'layout', name: 'Widget layout', Icon: GripVertical },
          { id: 'json', name: 'Scenario source', Icon: Code2 },
        ].map(({ id, name, Icon }) => (
          <button
            className={`button ${tab === id ? 'primary' : 'secondary'}`}
            key={id}
            onClick={() => {
              setTab(id);
              if (id === 'json') setJson(JSON.stringify(scenario, null, 2));
            }}
          >
            <Icon size={15} />
            {name}
          </button>
        ))}
      </div>
      {tab === 'statistics' && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Editable statistics</h3>
              <p className="muted">
                Scope:{' '}
                {selectedCreator === 'all'
                  ? 'All creators'
                  : scenario.creators.find((c) => c.id === selectedCreator)?.name}{' '}
                · {period}. Switch a metric to custom to override its calculation.
              </p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Calculated</th>
                  <th>Mode</th>
                  <th>Custom value</th>
                  <th>Change %</th>
                  <th>Indicator color</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metricLabels).map(([key, label]) => {
                  const scope = `${selectedCreator}:${period}${period === 'Custom Date' ? `:${customRange.from}:${customRange.to}` : ''}:${key}`;
                  const override = scenario.overrides[scope];
                  const base = Number(metrics[key] ?? 0);
                  return (
                    <tr key={scope}>
                      <td>
                        <strong>{label}</strong>
                      </td>
                      <td>{base.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>
                      <td>
                        <select
                          className="select"
                          aria-label={`${label} mode`}
                          value={override ? 'custom' : 'calculated'}
                          onChange={(e) =>
                            updateScenario((d) => {
                              if (e.target.value === 'custom')
                                d.overrides[scope] = { value: base, change: 0, color: '#a78bfa' };
                              else delete d.overrides[scope];
                            })
                          }
                        >
                          <option value="calculated">Calculated</option>
                          <option value="custom">Custom</option>
                        </select>
                      </td>
                      <td>
                        <input
                          className="input"
                          aria-label={`${label} custom value`}
                          type="number"
                          step="any"
                          min={key === 'growth' ? undefined : 0}
                          disabled={!override}
                          value={override?.value ?? ''}
                          onChange={(e) => {
                            if (
                              e.target.value !== '' &&
                              Number.isFinite(Number(e.target.value)) &&
                              (key === 'growth' || Number(e.target.value) >= 0)
                            )
                              updateScenario((d) => {
                                d.overrides[scope].value = Number(e.target.value);
                              });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          className="input"
                          style={{ width: 100 }}
                          aria-label={`${label} change percentage`}
                          type="number"
                          step="any"
                          disabled={!override}
                          value={override?.change ?? ''}
                          onChange={(e) => {
                            if (e.target.value !== '' && Number.isFinite(Number(e.target.value)))
                              updateScenario((d) => {
                                d.overrides[scope].change = Number(e.target.value);
                              });
                          }}
                        />
                      </td>
                      <td>
                        <input
                          type="color"
                          aria-label={`${label} indicator color`}
                          disabled={!override}
                          value={override?.color ?? '#8f8fa5'}
                          onChange={(e) =>
                            updateScenario((d) => {
                              d.overrides[scope].color = e.target.value;
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'sheets' && (
        <div className="panel">
          <div className="panel-header" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h3>Data sheets</h3>
              <p className="muted">
                Edit a cell and leave it to save. Invalid changes are rejected; IDs keep references intact.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select
                className="select"
                aria-label="Data sheet"
                value={sheet}
                onChange={(e) => setSheet(e.target.value as SheetName)}
              >
                {Object.keys(sheets).map((name) => (
                  <option key={name} value={name}>
                    {name.replace(/([A-Z])/g, ' $1')}
                  </option>
                ))}
              </select>
              <input
                className="input"
                style={{ width: 200 }}
                aria-label="Search data sheet"
                placeholder="Search all rows…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                className="button primary"
                onClick={() =>
                  mutate((d) => {
                    records(d, sheet).unshift(defaultRow(d, sheet));
                  })
                }
              >
                <Plus size={15} /> Add row
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row</th>
                  {sheets[sheet].map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={String(row.id)}>
                    <td className="muted">{page * 15 + index + 1}</td>
                    {sheets[sheet].map((column) => {
                      const raw = row[column.key];
                      let value = Array.isArray(raw) ? raw.join(', ') : String(raw ?? '');
                      if (column.type === 'datetime-local') value = value.slice(0, 16);
                      if (column.type === 'date') value = value.slice(0, 10);
                      const label = `${column.label} row ${page * 15 + index + 1}`;
                      return (
                        <td key={column.key} style={{ minWidth: column.type === 'color' ? 90 : 160 }}>
                          {column.reference ? (
                            <select
                              className="select"
                              aria-label={label}
                              key={value}
                              defaultValue={value}
                              onChange={(e) => {
                                if (!cell(String(row.id), column, e.target.value))
                                  e.currentTarget.value = value;
                              }}
                            >
                              {scenario[column.reference].map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          ) : column.choices ? (
                            <select
                              className="select"
                              aria-label={label}
                              key={value}
                              defaultValue={value}
                              onChange={(e) => {
                                if (!cell(String(row.id), column, e.target.value))
                                  e.currentTarget.value = value;
                              }}
                            >
                              {column.choices.map((choice) => (
                                <option key={choice}>{choice}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="input"
                              key={String(row.id) + column.key + value}
                              aria-label={label}
                              type={column.type ?? 'text'}
                              defaultValue={value}
                              step={column.type === 'number' ? 'any' : undefined}
                              onBlur={(e) => {
                                if (e.target.value !== value && !cell(String(row.id), column, e.target.value))
                                  e.currentTarget.value = value;
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') {
                                  e.currentTarget.value = value;
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <button
                        className="button danger icon"
                        aria-label={`Delete row ${page * 15 + index + 1}`}
                        onClick={() => remove(String(row.id))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <p className="empty-state">No matching rows. Add a row to start.</p>}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 18,
              gap: 8,
            }}
          >
            <span className="muted">
              {rows.length.toLocaleString()} rows · Page {page + 1} of{' '}
              {Math.max(1, Math.ceil(rows.length / 15))}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="button secondary small"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <button
                className="button secondary small"
                disabled={(page + 1) * 15 >= rows.length}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
      {tab === 'charts' && (
        <>
          <div className="panel" style={{ padding: 20, marginBottom: 20 }}>
            <h3>Shape your story</h3>
            <p className="muted">
              Enable Edit mode in the top bar, then open a chart editor. Each creator and period has
              independent chart settings. Manual series are visibly identified.
            </p>
          </div>
          <ChartPanel chartId="revenue" title="Revenue overview" />
          <div style={{ height: 20 }} />
          <ChartPanel chartId="performance" title="Performance comparison" />
        </>
      )}
      {tab === 'layout' && (
        <div className="panel" style={{ padding: 24 }}>
          <h3>Dashboard widget order</h3>
          <p className="muted">Drag widgets on the Overview dashboard, or arrange their saved order here.</p>
          {scenario.widgetOrder.map((id, index) => (
            <div
              key={id}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '12px 0',
                borderBottom: '1px solid var(--border,#292b36)',
              }}
            >
              <GripVertical size={16} />
              <span style={{ flex: 1 }}>{metricLabels[id] ?? id}</span>
              <button
                className="button secondary small"
                disabled={index === 0}
                onClick={() =>
                  updateScenario((d) => {
                    [d.widgetOrder[index - 1], d.widgetOrder[index]] = [
                      d.widgetOrder[index],
                      d.widgetOrder[index - 1],
                    ];
                  })
                }
              >
                Move up
              </button>
              <button
                className="button secondary small"
                disabled={index === scenario.widgetOrder.length - 1}
                onClick={() =>
                  updateScenario((d) => {
                    [d.widgetOrder[index + 1], d.widgetOrder[index]] = [
                      d.widgetOrder[index],
                      d.widgetOrder[index + 1],
                    ];
                  })
                }
              >
                Move down
              </button>
            </div>
          ))}
          {!scenario.widgetOrder.length && (
            <p className="muted">Widget order is initialized when the dashboard is first opened.</p>
          )}
        </div>
      )}
      {tab === 'json' && (
        <div className="panel" style={{ padding: 24 }}>
          <h3>Complete scenario source</h3>
          <p className="muted">
            An advanced editor for every stored field. Applying validates the full structure and loads it as a
            scenario. Export a backup before bulk changes.
          </p>
          <textarea
            className="input"
            aria-label="Scenario JSON source"
            spellCheck={false}
            style={{
              fontFamily: 'monospace',
              minHeight: 460,
              width: '100%',
              fontSize: 12,
              lineHeight: 1.6,
              resize: 'vertical',
            }}
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              className="button primary"
              onClick={() => {
                try {
                  parseScenario(json);
                  importScenario(json);
                  setNotice('Validated scenario loaded.');
                  setError('');
                } catch (e) {
                  setFailure(e);
                }
              }}
            >
              Validate & load
            </button>
            <button className="button secondary" onClick={() => setJson(JSON.stringify(scenario, null, 2))}>
              Reload current data
            </button>
          </div>
        </div>
      )}
    </>
  );
}
