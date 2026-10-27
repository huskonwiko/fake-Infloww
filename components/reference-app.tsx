'use client';
import { useEffect, useState } from 'react';
import { useStudio } from '@/lib/store';
import { ReferenceShell } from './reference-shell';
import { ReferenceDashboard, CreatorReports } from './reference-pages';
import { CrmPage } from './crm-pages';
import { Dashboard } from './dashboard';
import { MessagesPage } from './messages-page';
import { StudioPage } from './studio-page';
import { SettingsPage } from './settings-page';
import type { Period } from '@/lib/types';
const titles: Record<string, string> = {
  overview: 'Dashboard',
  'creator-reports': 'Creator reports',
  revenue: 'Revenue analytics',
  performance: 'Performance',
  statistics: 'Statistics',
  creators: 'All creators',
  'creator-profiles': 'Creator profiles',
  'creator-analytics': 'Creator analytics',
  messages: 'Messages Pro',
  'mass-messages': 'Mass messages',
  scripts: 'Scripts',
  'smart-lists': 'Smart lists',
  'employee-reports': 'Employee reports',
  'fan-reports': 'Fan reports',
  'message-reports': 'Message dashboard',
  'sales-records': 'Sales records',
  transactions: 'Transactions',
  fans: 'Fans',
  employees: 'Employees',
  'employee-performance': 'Employee performance',
  scheduling: 'Scheduling',
  campaigns: 'Campaigns',
  'tracking-links': 'Tracking links',
  segmentation: 'Fan segmentation',
  general: 'General',
  appearance: 'Appearance',
  studio: 'Studio Editor',
  'import-export': 'Import / Export',
  scenarios: 'Demo scenarios',
};
export function ReferenceApp() {
  const s = useStudio();
  const [page, setPage] = useState('overview');
  useEffect(() => {
    void s.initialize();
    const read = () => {
      const id = window.location.hash.slice(1);
      setPage(titles[id] ? id : 'overview');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = s.scenario.settings.theme;
  }, [s.scenario.settings.theme]);
  const navigate = (id: string) => {
    window.location.hash = id;
    setPage(id);
    window.scrollTo({ top: 0 });
  };
  if (!s.ready)
    return (
      <div className="loading-screen">
        <h2>Opening your studio…</h2>
      </div>
    );
  const primary = page === 'overview' || page === 'creator-reports';
  return (
    <ReferenceShell page={page} onNavigate={navigate}>
      {primary ? (
        page === 'overview' ? (
          <ReferenceDashboard onNavigate={navigate} />
        ) : (
          <CreatorReports onNavigate={navigate} />
        )
      ) : (
        <>
          <div className="ref-legacy-title">
            <h1>{titles[page]}</h1>
            <select aria-label="Open module" value={page} onChange={(e) => navigate(e.target.value)}>
              {Object.entries(titles).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="workspace-toolbar">
            <label>
              Creator{' '}
              <select
                aria-label="Select creator"
                value={s.selectedCreator}
                onChange={(e) => s.setCreator(e.target.value)}
              >
                <option value="all">All creators</option>
                {s.scenario.creators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period{' '}
              <select
                aria-label="Reporting period"
                value={s.period}
                onChange={(e) => s.setPeriod(e.target.value as Period)}
              >
                {[
                  'Today',
                  'Yesterday',
                  'This Week',
                  'Last 7 days',
                  'Last 30 days',
                  'This Month',
                  'Last Month',
                  'Custom Date',
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <button
              className="button secondary"
              aria-label="EDIT MODE"
              aria-pressed={s.editMode}
              onClick={s.toggleEdit}
            >
              EDIT MODE {s.editMode ? 'ON' : 'OFF'}
            </button>
            <div className="heading-actions">
              <button
                className="button secondary"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(
                    new Blob([JSON.stringify(s.scenario, null, 2)], { type: 'application/json' }),
                  );
                  a.download = 'velvet-scenario.json';
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                }}
              >
                Export
              </button>
            </div>
            <span className={`save-state ${s.saveStatus}`} role="status">
              {s.saveStatus === 'saved' ? 'All changes saved' : s.saveStatus}
            </span>
            <button className="button secondary" onClick={() => navigate('studio')}>
              Studio Editor
            </button>
          </div>
          {['revenue', 'performance', 'statistics'].includes(page) ? (
            <Dashboard page={page} onNavigate={navigate} />
          ) : page === 'messages' ? (
            <MessagesPage />
          ) : page === 'studio' ? (
            <StudioPage />
          ) : ['general', 'appearance', 'import-export', 'scenarios'].includes(page) ? (
            <SettingsPage page={page} />
          ) : (
            <CrmPage page={page} />
          )}
        </>
      )}
    </ReferenceShell>
  );
}
