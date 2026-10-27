'use client';
import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  MessageCircle,
  TrendingUp,
  Users,
  UserRound,
  Settings,
  HelpCircle,
  ChevronDown,
  Bell,
  Clock3,
  Trophy,
  Link,
  Menu,
  SlidersHorizontal,
  Undo2,
  Redo2,
  Download,
  Check,
  PanelLeft,
  Sparkles,
  X,
} from 'lucide-react';
import { useStudio } from '@/lib/store';
import { initials, download } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
export function ReferenceShell({
  page,
  onNavigate,
  children,
}: {
  page: string;
  onNavigate: (p: string) => void;
  children: ReactNode;
}) {
  const s = useStudio();
  const [mobile, setMobile] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['Analytics']);
  const [clock, setClock] = useState(false);
  const [help, setHelp] = useState(false);
  const [emp, setEmp] = useState(s.scenario.employees[0]?.id ?? '');
  const nav = (p: string) => {
    onNavigate(p);
    setMobile(false);
  };
  const rows = [
    { label: 'Dashboard', id: 'overview', icon: LayoutDashboard },
    {
      label: 'Creator manager',
      id: 'creators',
      icon: Link,
      children: [
        ['creators', 'All creators'],
        ['creator-profiles', 'Creator profiles'],
      ],
    },
    {
      label: 'Analytics',
      id: 'creator-reports',
      icon: BarChart3,
      children: [
        ['creator-reports', 'Creator reports'],
        ['employee-reports', 'Employee reports'],
        ['fan-reports', 'Fan reports'],
        ['message-reports', 'Message dashboard'],
      ],
    },
    { label: 'Messages Pro', id: 'messages', icon: MessageCircle },
    {
      label: 'Growth',
      id: 'campaigns',
      icon: TrendingUp,
      children: [
        ['campaigns', 'Campaigns'],
        ['tracking-links', 'Tracking links'],
        ['segmentation', 'Fan segmentation'],
      ],
    },
    { label: 'Share for Share', id: 'tracking-links', icon: Link },
    {
      label: 'Creators',
      id: 'creator-profiles',
      icon: UserRound,
      children: [
        ['creator-profiles', 'Creator profiles'],
        ['creator-analytics', 'Creator analytics'],
      ],
    },
    {
      label: 'Employees',
      id: 'employees',
      icon: Users,
      children: [
        ['employees', 'Chatters'],
        ['employee-performance', 'Performance'],
        ['scheduling', 'Scheduling'],
      ],
    },
  ];
  return (
    <div className={`reference-app ${s.scenario.settings.sfw ? 'ref-sfw' : ''}`} data-page={page}>
      <header className="reference-topbar">
        <button aria-label="Toggle sidebar" className="ref-sidebar-toggle" onClick={() => setMobile(!mobile)}>
          <PanelLeft size={19} />
        </button>
        <span className="ref-brand">velvet</span>
        <div className="ref-top-actions">
          <details>
            <summary>
              <i className="ref-online-dot" />
              Operational
            </summary>
            <div className="ref-top-popover">
              <b>Local simulator</b>
              <p>
                {s.saveStatus === 'saved'
                  ? 'All changes saved'
                  : s.saveStatus === 'saving'
                    ? 'Saving…'
                    : s.saveError}
              </p>
              <p>Demo data only. No external accounts.</p>
            </div>
          </details>
          <span className="ref-utc">◉ UTC+00:00</span>
          <button onClick={() => nav('tracking-links')}>
            <Link size={19} />
            Referrals
          </button>
          <button onClick={() => nav('employee-performance')}>
            <Trophy size={19} />
            Leaderboard
          </button>
          <button
            className="ref-sfw-switch"
            aria-label="SFW"
            aria-pressed={!!s.scenario.settings.sfw}
            onClick={() =>
              s.updateScenario((d) => {
                d.settings.sfw = !d.settings.sfw;
              })
            }
          >
            SFW <i className={s.scenario.settings.sfw ? 'on' : ''} />
          </button>
          <button aria-label="Notifications" onClick={() => nav('messages')}>
            <Bell size={20} />
            <b className="ref-pink-badge">{s.scenario.fans.reduce((n, f) => n + f.unread, 0)}</b>
          </button>
          <button onClick={() => setClock(true)}>
            <Clock3 size={19} />
            Clock in
          </button>
          <details className="ref-workspace-actions">
            <summary aria-label="Workspace actions">
              <SlidersHorizontal size={18} />
            </summary>
            <div className="ref-top-popover">
              <b>Workspace actions</b>
              <p role="status">{s.saveStatus === 'saved' ? 'All changes saved' : s.saveStatus}</p>
              <button aria-label="Undo" disabled={!s.canUndo} onClick={s.undo}>
                <Undo2 size={16} />
                Undo
              </button>
              <button aria-label="Redo" disabled={!s.canRedo} onClick={s.redo}>
                <Redo2 size={16} />
                Redo
              </button>
              <button onClick={() => download('velvet-scenario.json', JSON.stringify(s.scenario, null, 2))}>
                <Download size={16} />
                Export scenario
              </button>
              <button onClick={() => nav('studio')}>
                <SlidersHorizontal size={16} />
                Studio Editor
              </button>
              <button aria-pressed={s.editMode} onClick={s.toggleEdit}>
                EDIT MODE {s.editMode ? 'ON' : 'OFF'}
              </button>
            </div>
          </details>
          <button className="ref-user-avatar" aria-label="Workspace settings" onClick={() => nav('general')}>
            {initials(s.scenario.settings.agencyName)}
          </button>
        </div>
      </header>
      {mobile && (
        <button className="ref-nav-overlay" onClick={() => setMobile(false)} aria-label="Close navigation" />
      )}
      <aside className={`reference-sidebar ${mobile ? 'open' : ''}`}>
        <button className="ref-workspace-select" onClick={() => nav('scenarios')}>
          <Sparkles size={23} />
          <strong>Velvet Studio</strong>
          <i />
          <ChevronDown size={18} />
        </button>
        <nav>
          {rows.map((r, index) => (
            <div className={`ref-nav-row ${index === 6 ? 'ref-nav-separated' : ''}`} key={r.label}>
              <button
                className={page === r.id || r.children?.some((c) => c[0] === page) ? 'active' : ''}
                onClick={() =>
                  r.children
                    ? setExpanded((v) =>
                        v.includes(r.label) ? v.filter((x) => x !== r.label) : [...v, r.label],
                      )
                    : nav(r.id)
                }
              >
                <r.icon size={21} />
                <span>{r.label}</span>
                {r.label === 'Messages Pro' && (
                  <b className="ref-pink-badge">{s.scenario.fans.filter((f) => f.unread > 0).length}</b>
                )}
                {r.children && <ChevronDown size={17} />}
              </button>
              {r.children && (expanded.includes(r.label) || r.children.some((c) => c[0] === page)) && (
                <div className="ref-nav-children">
                  {r.children.map(([id, label]) => (
                    <button key={id} className={page === id ? 'active' : ''} onClick={() => nav(id)}>
                      <UserRound size={17} />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="reference-sidebar-bottom">
          <button onClick={() => nav('general')}>
            <Settings size={20} />
            Settings
          </button>
          <button onClick={() => nav('studio')}>
            <SlidersHorizontal size={20} />
            Studio Editor
          </button>
          <button onClick={() => setHelp(true)}>
            <HelpCircle size={20} />
            Help center
          </button>
          <small>Velvet 2.0 · Demo data · Saved locally</small>
        </div>
      </aside>
      <div className="reference-content page-content">
        {s.saveStatus === 'error' && (
          <div className="error-banner">Save failed: {s.saveError}. Export your scenario before closing.</div>
        )}
        {children}
      </div>
      <Dialog open={clock} onOpenChange={setClock}>
        <DialogContent>
          <div className="modal-header">
            <DialogTitle>Local clock-in</DialogTitle>
            <DialogDescription>Simulate an employee shift in this workspace.</DialogDescription>
          </div>
          <div className="modal-body">
            <label className="field">
              Employee
              <select value={emp} onChange={(e) => setEmp(e.target.value)}>
                {s.scenario.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            {(s.scenario.settings.clockedIn ?? []).map((e) => (
              <p key={e.employeeId}>
                {s.scenario.employees.find((x) => x.id === e.employeeId)?.name} · Clocked in
              </p>
            ))}
          </div>
          <div className="modal-footer">
            <Button
              onClick={() => {
                s.updateScenario((d) => {
                  const sessions = d.settings.clockedIn ?? [];
                  d.settings.clockedIn = sessions.some((x) => x.employeeId === emp)
                    ? sessions.filter((x) => x.employeeId !== emp)
                    : [...sessions, { employeeId: emp, startedAt: new Date().toISOString() }];
                });
                setClock(false);
              }}
            >
              {s.scenario.settings.clockedIn?.some((x) => x.employeeId === emp) ? 'Clock out' : 'Clock in'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <div className="modal-header">
            <DialogTitle>Your local studio</DialogTitle>
            <DialogDescription>Everything is fictional and stored in this browser.</DialogDescription>
          </div>
          <div className="modal-body">
            <p>
              Click an amount, bar or graph point to edit it. Linked edits recalculate source transactions and
              all reports. Export a JSON backup from Workspace actions before clearing browser storage.
            </p>
            <Button
              onClick={() => {
                setHelp(false);
                nav('import-export');
              }}
            >
              Import / Export
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
