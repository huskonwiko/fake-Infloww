'use client';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  UserRound,
  ChartNoAxesCombined,
  MessageSquare,
  Send,
  ScrollText,
  ListFilter,
  FileChartColumn,
  Receipt,
  MessagesSquare,
  Headphones,
  CalendarDays,
  Megaphone,
  Link,
  Tags,
  Settings2,
  Palette,
  SlidersHorizontal,
  ArrowUpFromLine,
  Copy,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ArrowDownToLine,
  Pencil,
  Check,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  ShieldCheck,
  Command,
  Database,
  CircleHelp,
  X,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useStudio } from '@/lib/store';
import type { Period } from '@/lib/types';
import { money, number, initials, download } from '@/lib/utils';
import { periodRange } from '@/lib/analytics';
import { Dashboard } from './dashboard';
import { CrmPage } from './crm-pages';
import { MessagesPage } from './messages-page';
import { StudioPage } from './studio-page';
import { SettingsPage } from './settings-page';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
const groups = [
  {
    label: 'WORKSPACE',
    items: [
      ['overview', 'Overview', LayoutDashboard],
      ['revenue', 'Revenue analytics', BarChart3],
      ['performance', 'Performance', TrendingUp],
      ['statistics', 'Statistics', PieChart],
    ],
  },
  {
    label: 'CREATORS',
    items: [
      ['creators', 'All creators', Users],
      ['creator-profiles', 'Creator profiles', UserRound],
      ['creator-analytics', 'Creator analytics', ChartNoAxesCombined],
    ],
  },
  {
    label: 'MESSAGES',
    items: [
      ['messages', 'Messages Pro', MessageSquare],
      ['mass-messages', 'Mass messages', Send],
      ['scripts', 'Scripts', ScrollText],
      ['smart-lists', 'Smart lists', ListFilter],
    ],
  },
  {
    label: 'REPORTS',
    items: [
      ['creator-reports', 'Creator reports', FileChartColumn],
      ['employee-reports', 'Employee reports', FileChartColumn],
      ['fan-reports', 'Fan reports', Users],
      ['sales-records', 'Sales records', Receipt],
      ['message-reports', 'Message reports', MessagesSquare],
    ],
  },
  {
    label: 'TEAM',
    items: [
      ['employees', 'Chatters', Headphones],
      ['employee-performance', 'Employee performance', TrendingUp],
      ['scheduling', 'Scheduling', CalendarDays],
    ],
  },
  {
    label: 'GROWTH',
    items: [
      ['campaigns', 'Campaigns', Megaphone],
      ['tracking-links', 'Tracking links', Link],
      ['segmentation', 'Fan segmentation', Tags],
    ],
  },
  {
    label: 'SETTINGS',
    items: [
      ['general', 'General', Settings2],
      ['appearance', 'Appearance', Palette],
      ['studio', 'Data editor', SlidersHorizontal],
      ['import-export', 'Import / Export', ArrowUpFromLine],
      ['scenarios', 'Demo scenarios', Copy],
    ],
  },
] as const;
const pageLabels: Record<string, string> = Object.fromEntries(
  groups.flatMap((g) => g.items.map(([id, label]) => [id, label])),
);
pageLabels.studio = 'Studio Editor';
pageLabels.fans = 'Fan directory';
pageLabels.transactions = 'Transactions';
const subtitles: Record<string, string> = {
  overview: "A clear picture of your agency's performance.",
  revenue: 'Understand every revenue stream, down to the last sale.',
  performance: 'Turn your local data into a better view of performance.',
  statistics: 'Track your audience, subscriptions and retention.',
  studio: 'Your data. Your story. Every detail under your control.',
  messages: 'Meaningful conversations, entirely simulated.',
  creators: 'A home for your fictional creator roster.',
  scheduling: 'Plan your team’s time in a local, flexible calendar.',
  scenarios: 'Explore possibilities in independent local workspaces.',
};
const periods: Period[] = [
  'Today',
  'Yesterday',
  'Last 7 days',
  'Last 30 days',
  'This Month',
  'Last Month',
  'Custom Date',
];
export function StudioApp() {
  const s = useStudio();
  const [page, setPage] = useState('overview');
  const [collapsed, setCollapsed] = useState<string[]>(['REPORTS', 'TEAM', 'GROWTH', 'SETTINGS']);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [help, setHelp] = useState(false);
  const [dateError, setDateError] = useState('');
  useEffect(() => {
    void s.initialize();
    const read = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (pageLabels[hash]) setPage(hash);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = s.scenario.settings.theme;
  }, [s.scenario.settings.theme]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const isInput = (e.target as HTMLElement).closest('input,textarea,select,[contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !isInput && s.editMode) {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [s.editMode, s.undo, s.redo]);
  const updateRange = (r: { from: string; to: string }) => {
    try {
      s.setRange(r);
      setDateError('');
    } catch (error) {
      setDateError(error instanceof Error ? error.message : 'Choose a valid date range.');
    }
  };
  const navigate = (id: string) => {
    setPage(id);
    window.location.hash = id;
    setMobile(false);
    setSearch(false);
    window.scrollTo({ top: 0 });
  };
  const group = groups.find((g) => g.items.some((item) => item[0] === page));
  const selected = s.scenario.creators.find((c) => c.id === s.selectedCreator);
  const range = periodRange(s.period, s.customRange);
  if (!s.ready)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <span>v</span>
        </div>
        <h2>Opening your studio</h2>
        <p>Preparing your local workspace…</p>
        <span className="loading-spinner" />
      </div>
    );
  return (
    <div className={`app-shell ${mobile ? 'sidebar-open' : ''}`}>
      {mobile && (
        <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobile(false)} />
      )}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <a href="#overview" onClick={() => navigate('overview')}>
            <span className="brand-mark">
              <span>v</span>
            </span>
            <strong>
              velvet<span>CRM STUDIO</span>
            </strong>
          </a>
          <button
            className="button icon mobile-only"
            aria-label="Close sidebar"
            onClick={() => setMobile(false)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="workspace-picker">
          <span className="workspace-avatar">{initials(s.scenario.settings.agencyName)}</span>
          <div>
            <b>{s.scenario.settings.agencyName}</b>
            <small>Independent workspace</small>
          </div>
          <button
            className="button icon ghost"
            onClick={() => navigate('scenarios')}
            aria-label="Manage workspaces"
          >
            <ChevronsUpDown size={14} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {groups.map((g) => (
            <div className="nav-group" key={g.label}>
              <button
                className="nav-group-title"
                aria-expanded={!collapsed.includes(g.label)}
                onClick={() =>
                  setCollapsed((v) =>
                    v.includes(g.label) ? v.filter((x) => x !== g.label) : [...v, g.label],
                  )
                }
              >
                {g.label}
                <ChevronDown size={12} className={collapsed.includes(g.label) ? 'closed' : ''} />
              </button>
              {!collapsed.includes(g.label) &&
                g.items.map(([id, label, Icon]) => (
                  <button
                    className={`nav-item ${page === id ? 'active' : ''}`}
                    aria-current={page === id ? 'page' : undefined}
                    key={id}
                    onClick={() => navigate(id)}
                  >
                    <Icon size={17} strokeWidth={1.7} />
                    <span>{label}</span>
                    {id === 'messages' && (
                      <span className="nav-count">{s.scenario.fans.reduce((a, f) => a + f.unread, 0)}</span>
                    )}
                    {page === id && <i />}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={`studio-nav ${page === 'studio' ? 'active' : ''}`}
            onClick={() => navigate('studio')}
          >
            <SlidersHorizontal size={17} />
            <span>Studio Editor</span>
            <span className="studio-pill">EDIT</span>
          </button>
          <div className="local-status">
            <i />
            <span>Demo data · stored locally</span>
            <ShieldCheck size={13} />
          </div>
          <button className="sidebar-account" onClick={() => navigate('general')}>
            <span className="account-avatar">{initials(s.scenario.settings.agencyName)}</span>
            <span>
              <b>Studio workspace</b>
              <small>{s.scenario.name}</small>
            </span>
            <Settings2 size={15} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="button icon ghost mobile-only"
              onClick={() => setMobile(true)}
              aria-label="Open navigation"
            >
              <PanelLeft size={18} />
            </button>
            <span>
              {group?.label === 'WORKSPACE' ? 'Dashboard' : group?.label.toLowerCase() || 'Workspace'}
            </span>
            <ChevronRight size={13} />
            <b>{pageLabels[page]}</b>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearch(true)} aria-label="Search workspace">
              <Search size={15} />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <button className="button icon ghost" aria-label="Workspace guide" onClick={() => setHelp(true)}>
              <CircleHelp size={18} />
            </button>
            <span className="top-avatar">{initials(s.scenario.settings.agencyName)}</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                YOUR WORKSPACE, AT A GLANCE <span className="demo-label">DEMO</span>
              </div>
              <h1>
                {pageLabels[page]}
                {page === 'overview' && <span className="heading-dot" />}
              </h1>
              <p>{subtitles[page] || 'Explore, manage and customize your fictional workspace.'}</p>
            </div>
            <div className="heading-actions">
              <button
                className={`edit-mode ${s.editMode ? 'enabled' : ''}`}
                onClick={s.toggleEdit}
                aria-pressed={s.editMode}
              >
                <Pencil size={14} />
                <span>EDIT MODE</span>
                <span className="toggle-track">
                  <i />
                </span>
              </button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  download(
                    `${s.scenario.name.replaceAll(/[^a-z0-9]/gi, '-')}.json`,
                    JSON.stringify(s.scenario, null, 2),
                  )
                }
              >
                <ArrowDownToLine size={15} /> Export
              </Button>
            </div>
          </div>
          <div className="workspace-toolbar">
            <div className="creator-filter">
              <span
                className="avatar small"
                style={selected ? { background: selected.color + '28', color: selected.color } : undefined}
              >
                {selected ? initials(selected.name) : <Users size={16} />}
              </span>
              <select
                aria-label="Select creator"
                value={s.selectedCreator}
                onChange={(e) => s.setCreator(e.target.value)}
              >
                <option value="all">All creators</option>
                {s.scenario.creators.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <span className="toolbar-separator" />
            <div className="date-filter">
              <CalendarDays size={15} />
              <select
                aria-label="Reporting period"
                value={s.period}
                onChange={(e) => s.setPeriod(e.target.value as Period)}
              >
                {periods.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            {s.period === 'Custom Date' ? (
              <div className="custom-date-range">
                <input
                  aria-label="Start date"
                  type="date"
                  max={s.customRange.to}
                  value={s.customRange.from}
                  onChange={(e) => e.target.value && updateRange({ ...s.customRange, from: e.target.value })}
                />
                <span>—</span>
                <input
                  aria-label="End date"
                  type="date"
                  min={s.customRange.from}
                  value={s.customRange.to}
                  onChange={(e) => e.target.value && updateRange({ ...s.customRange, to: e.target.value })}
                />
              </div>
            ) : (
              <span className="range-label">
                {new Date(range.from + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                —{' '}
                {new Date(range.to + 'T12:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
            <div className="toolbar-right">
              {s.editMode && (
                <>
                  <button
                    className="button icon ghost"
                    disabled={!s.canUndo}
                    onClick={s.undo}
                    aria-label="Undo"
                  >
                    <Undo2 size={15} />
                  </button>
                  <button
                    className="button icon ghost"
                    disabled={!s.canRedo}
                    onClick={s.redo}
                    aria-label="Redo"
                  >
                    <Redo2 size={15} />
                  </button>
                </>
              )}
              <span className={`save-state ${s.saveStatus}`} aria-live="polite">
                {s.saveStatus === 'saved' ? <Check size={13} /> : <Database size={13} />}{' '}
                {s.saveStatus === 'saved'
                  ? 'All changes saved'
                  : s.saveStatus === 'saving'
                    ? 'Saving locally…'
                    : 'Save failed'}
              </span>
              <button className="toolbar-studio" onClick={() => navigate('studio')}>
                <SlidersHorizontal size={14} />
                <span>Customize</span>
              </button>
            </div>
          </div>
          {dateError && (
            <div className="form-error" role="alert">
              {dateError}
            </div>
          )}
          {s.saveStatus === 'error' && (
            <div className="error-banner" role="alert">
              <strong>Local storage is unavailable.</strong> {s.saveError}. Keep a JSON export before closing.{' '}
              <button className="button small secondary" onClick={() => void s.saveNow().catch(() => {})}>
                Retry save
              </button>
            </div>
          )}
          {s.editMode && (
            <div className="edit-banner">
              <Pencil size={13} />
              <span>
                Editing is on. Click a KPI or chart to customize it. Drag the handles to reorder your widgets.
              </span>
              <button onClick={s.toggleEdit}>
                Done editing <Check size={12} />
              </button>
            </div>
          )}
          <div className="page-content">
            {['overview', 'revenue', 'performance', 'statistics'].includes(page) ? (
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
          </div>
          <footer className="app-footer">
            <span>
              <ShieldCheck size={12} /> Independent simulator · Fictional data only · No external accounts
            </span>
            <span>
              velvet studio <i /> Local-first by design
            </span>
          </footer>
        </main>
      </div>
      <Dialog open={search} onOpenChange={setSearch}>
        <DialogContent>
          <div className="modal-header">
            <DialogTitle>Search your workspace</DialogTitle>
            <DialogDescription>Find a page or fictional creator.</DialogDescription>
          </div>
          <div className="modal-body">
            <label className="search-field">
              <Search size={17} />
              <input
                autoFocus
                placeholder="Search pages, creators…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search pages and creators"
              />
            </label>
            <div className="search-results">
              {Object.entries(pageLabels)
                .filter(([, label]) => label.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 9)
                .map(([id, label]) => (
                  <button key={id} onClick={() => navigate(id)}>
                    <LayoutDashboard size={16} />
                    {label}
                    <ArrowUpFromLine size={13} />
                  </button>
                ))}
              {s.scenario.creators
                .filter((c) => (c.name + c.handle).toLowerCase().includes(query.toLowerCase()))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      s.setCreator(c.id);
                      navigate('creator-profiles');
                    }}
                  >
                    <UserRound size={16} />
                    {c.name}
                    <small>{c.handle.startsWith('@') ? c.handle : `@${c.handle}`}</small>
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <div className="modal-header">
            <DialogTitle>Welcome to your Studio</DialogTitle>
            <DialogDescription>A fully local workspace for fictional creator businesses.</DialogDescription>
          </div>
          <div className="modal-body help-content">
            <p>
              <b>1. Explore your data.</b> Use the creator and date filters to see linked sales, reports and
              charts.
            </p>
            <p>
              <b>2. Make it yours.</b> Enable EDIT MODE to customize metrics, edit graphs, update profiles and
              manage records.
            </p>
            <p>
              <b>3. Keep your work.</b> Changes save in this browser’s IndexedDB. Export JSON for a portable
              backup; clearing browser storage removes local data.
            </p>
            <p>
              <b>4. Try a new scenario.</b> Create or duplicate a scenario in Settings. Each has independent
              data and preferences.
            </p>
            <div className="crm-banner">
              <ShieldCheck size={18} /> Every message and sale is simulated. There are no connections to
              external platforms.
            </div>
          </div>
          <div className="modal-footer">
            <Button
              onClick={() => {
                setHelp(false);
                navigate('studio');
              }}
            >
              Open Studio Editor <Sparkles size={15} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
