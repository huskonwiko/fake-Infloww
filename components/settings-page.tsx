'use client';

import { useRef, useState } from 'react';
import { Check, Download, Upload, Copy, Plus, Trash2, Moon, Sun, Database, ShieldCheck } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { download } from '@/lib/utils';

export function ImportExportPanel() {
  const { scenario, importScenario } = useStudio();
  const file = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function readFile(selected?: File) {
    if (!selected) return;
    setError('');
    try {
      if (selected.size > 20 * 1024 * 1024) throw new Error('Choose a JSON backup smaller than 20 MB.');
      importScenario(await selected.text());
      setNotice('Backup validated and imported as an independent scenario.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This backup could not be imported.');
    }
  }
  return (
    <div className="panel" style={{ padding: 24 }}>
      <div className="panel-header">
        <div>
          <h3>Keep your studio with you</h3>
          <p className="muted">
            A complete JSON backup includes profiles, transactions, messages, charts and preferences.
          </p>
        </div>
        <Database size={24} />
      </div>
      <div className="form-grid" style={{ marginTop: 24 }}>
        <div className="panel" style={{ padding: 24 }}>
          <Download size={22} />
          <h4>Export scenario</h4>
          <p className="muted">Download {scenario.name}. Your local data stays in this browser.</p>
          <button
            className="button primary"
            onClick={() => {
              download(
                `${scenario.name.replace(/[^a-z0-9-]/gi, '-')}.json`,
                JSON.stringify(scenario, null, 2),
              );
              setNotice('Scenario exported.');
            }}
          >
            <Download size={16} /> Export JSON
          </button>
        </div>
        <div className="panel" style={{ padding: 24 }}>
          <Upload size={22} />
          <h4>Restore a backup</h4>
          <p className="muted">The structure and references are validated before any data is imported.</p>
          <button className="button secondary" onClick={() => file.current?.click()}>
            <Upload size={16} /> Import JSON
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              void readFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {notice && (
        <p role="status" style={{ color: 'var(--green, #5cdaa1)' }}>
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: '#fb7185', overflowWrap: 'anywhere' }}>
          {error}
        </p>
      )}
      <p className="muted" style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <ShieldCheck size={16} /> No cloud sync, accounts or external API. Only fictional demonstration data
        belongs here.
      </p>
    </div>
  );
}

export function SettingsPage({ page }: { page: string }) {
  const {
    scenario,
    scenarios,
    activeId,
    updateScenario,
    switchScenario,
    createScenario,
    duplicateScenario,
    deleteScenario,
  } = useStudio();
  const [name, setName] = useState('');
  const [notice, setNotice] = useState('');
  if (page === 'import-export') return <ImportExportPanel />;
  if (page === 'scenarios')
    return (
      <>
        <div className="panel" style={{ padding: 24, marginBottom: 20 }}>
          <h3>Independent workspaces, endless possibilities</h3>
          <p className="muted">
            Each scenario has its own creators, statistics, conversations, chart edits and appearance.
          </p>
          <form
            style={{ display: 'flex', gap: 12, marginTop: 20 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) {
                createScenario(name.trim());
                setName('');
                setNotice('New scenario created and loaded.');
              }
            }}
          >
            <input
              className="input"
              aria-label="New scenario name"
              placeholder="e.g. September growth scenario"
              value={name}
              required
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="button primary" type="submit">
              <Plus size={16} /> Create scenario
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                duplicateScenario();
                setNotice('Current scenario duplicated.');
              }}
            >
              <Copy size={16} /> Duplicate current
            </button>
          </form>
          {notice && (
            <p role="status" className="muted">
              {notice}
            </p>
          )}
        </div>
        <div className="form-grid">
          {scenarios.map((item) => (
            <div className="panel" style={{ padding: 24 }} key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <Database size={22} />
                {item.id === activeId && (
                  <span className="badge">
                    <Check size={12} /> Active
                  </span>
                )}
              </div>
              <h3>{item.name}</h3>
              <p className="muted">
                {item.creators.length} creators · {item.fans.length} fans ·{' '}
                {item.transactions.length.toLocaleString()} transactions
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                <button
                  className="button secondary"
                  disabled={item.id === activeId}
                  onClick={() => switchScenario(item.id)}
                >
                  Load scenario
                </button>
                <button
                  className="button danger icon"
                  aria-label={`Delete ${item.name}`}
                  disabled={scenarios.length < 2}
                  onClick={() => {
                    if (confirm(`Delete “${item.name}” and all of its local data? This cannot be undone.`))
                      deleteScenario(item.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </>
    );
  if (page === 'appearance')
    return (
      <div className="panel" style={{ padding: 28 }}>
        <h3>Make it feel like your studio</h3>
        <p className="muted">Appearance preferences are saved independently for each scenario.</p>
        <h4>Interface theme</h4>
        <div style={{ display: 'flex', gap: 16 }}>
          {(['dark', 'light'] as const).map((theme) => (
            <button
              key={theme}
              className={`button ${scenario.settings.theme === theme ? 'primary' : 'secondary'}`}
              style={{ minWidth: 150, padding: 20 }}
              onClick={() =>
                updateScenario((d) => {
                  d.settings.theme = theme;
                })
              }
            >
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}{' '}
              {theme === 'dark' ? 'Dark studio' : 'Light studio'}{' '}
              {scenario.settings.theme === theme && <Check size={16} />}
            </button>
          ))}
        </div>
        <h4 style={{ marginTop: 32 }}>Creator accent colors</h4>
        <div className="form-grid">
          {scenario.creators.map((creator) => (
            <label className="field" key={creator.id}>
              {creator.name}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  aria-label={`Accent color for ${creator.name}`}
                  type="color"
                  value={creator.color}
                  onChange={(e) =>
                    updateScenario((d) => {
                      const c = d.creators.find((x) => x.id === creator.id);
                      if (c) c.color = e.target.value;
                    })
                  }
                />
                <span className="muted">{creator.color}</span>
              </div>
            </label>
          ))}
        </div>
        <p className="muted">Revenue series colors can be changed directly in each chart editor.</p>
      </div>
    );
  return (
    <div className="panel" style={{ padding: 28, maxWidth: 900 }}>
      <h3>Workspace details</h3>
      <p className="muted">Give this fictional studio its own identity. Changes are saved automatically.</p>
      <div className="form-grid" style={{ marginTop: 24 }}>
        <label className="field">
          Studio name
          <input
            className="input"
            aria-label="Studio name"
            key={scenario.id + scenario.settings.agencyName}
            defaultValue={scenario.settings.agencyName}
            maxLength={100}
            required
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value) {
                updateScenario((d) => {
                  d.settings.agencyName = value;
                });
                setNotice('Workspace details saved.');
              } else {
                e.currentTarget.value = scenario.settings.agencyName;
                setNotice('Studio name cannot be empty.');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <label className="field">
          Scenario name
          <input
            className="input"
            aria-label="Scenario name"
            key={scenario.id + scenario.name}
            defaultValue={scenario.name}
            maxLength={100}
            required
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value) {
                updateScenario((d) => {
                  d.name = value;
                });
                setNotice('Workspace details saved.');
              } else {
                e.currentTarget.value = scenario.name;
                setNotice('Scenario name cannot be empty.');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
        <label className="field">
          Display currency
          <select
            className="select"
            value={scenario.settings.currency}
            onChange={(e) =>
              updateScenario((d) => {
                d.settings.currency = e.target.value;
              })
            }
          >
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
          </select>
          <span className="muted">Changes the display unit. No currency conversion is applied.</span>
        </label>
      </div>
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border, #292b36)' }}>
        <h4>Local by design</h4>
        <p className="muted">
          All data is stored with IndexedDB in this browser. Clearing browser storage removes the local
          workspace. Export a JSON backup to preserve your work.
        </p>
        <span className="badge">
          <ShieldCheck size={12} /> Simulation only · No connected accounts
        </span>
        {notice && (
          <p role="status" className="muted">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
