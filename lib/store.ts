'use client';
import { create } from 'zustand';
import type { Period, Scenario, UpdateScenario } from './types';
import { seedScenario } from './seed';
import { loadWorkspace, saveWorkspace, type Workspace } from './db';
import { parseScenario } from './schema';
import { periodRange } from './analytics';
import { uid } from './utils';
export interface StudioState {
  scenario: Scenario;
  scenarios: Scenario[];
  activeId: string;
  selectedCreator: string;
  period: Period;
  customRange: { from: string; to: string };
  editMode: boolean;
  ready: boolean;
  past: Scenario[];
  future: Scenario[];
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: 'saved' | 'saving' | 'error';
  saveError: string;
  initialize: () => Promise<void>;
  updateScenario: UpdateScenario;
  setCreator: (id: string) => void;
  setPeriod: (p: Period) => void;
  setRange: (r: { from: string; to: string }) => void;
  toggleEdit: () => void;
  undo: () => void;
  redo: () => void;
  saveNow: () => Promise<void>;
  switchScenario: (id: string) => void;
  duplicateScenario: () => void;
  createScenario: (name: string) => void;
  deleteScenario: (id: string) => void;
  resetScenario: () => void;
  importScenario: (text: string) => void;
}
const clone = <T>(value: T): T => structuredClone(value);
const creatorFor = (scenario: Scenario, id: string) =>
  id === 'all' || scenario.creators.some((c) => c.id === id) ? id : 'all';
const periods: Period[] = [
  'Today',
  'Yesterday',
  'Last 7 days',
  'Last 30 days',
  'This Month',
  'Last Month',
  'Custom Date',
];
/** Each instance owns its save queue and history, making IndexedDB reloads testable. */
export function createStudioStore() {
  const first = seedScenario();
  let initialization: Promise<void> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let saveChain = Promise.resolve();
  let revision = 0;
  const workspace = (): Workspace => {
    const s = store.getState();
    return {
      scenarios: s.scenarios,
      activeId: s.activeId,
      preferences: {
        selectedCreator: s.selectedCreator,
        period: s.period,
        customRange: s.customRange,
        editMode: s.editMode,
      },
    };
  };
  const persist = async () => {
    clearTimeout(timer);
    const data = clone(workspace());
    const version = revision;
    const pending = saveChain.catch(() => {}).then(() => saveWorkspace(data));
    saveChain = pending;
    try {
      await pending;
      if (version === revision) store.setState({ saveStatus: 'saved', saveError: '' });
    } catch (error) {
      if (version === revision)
        store.setState({
          saveStatus: 'error',
          saveError: error instanceof Error ? error.message : 'IndexedDB is unavailable',
        });
      throw error;
    }
  };
  const schedule = () => {
    revision++;
    store.setState({ saveStatus: 'saving', saveError: '' });
    clearTimeout(timer);
    timer = setTimeout(() => {
      void persist().catch(() => {});
    }, 250);
  };
  const freshHistory = { past: [], future: [], canUndo: false, canRedo: false };
  const store = create<StudioState>((set, get) => ({
    scenario: first,
    scenarios: [first],
    activeId: first.id,
    selectedCreator: 'all',
    period: 'Last 30 days',
    customRange: periodRange('Last 30 days'),
    editMode: false,
    ready: false,
    ...freshHistory,
    saveStatus: 'saved',
    saveError: '',
    initialize: () => {
      if (initialization) return initialization;
      initialization = (async () => {
        try {
          const saved = await loadWorkspace();
          if (saved?.scenarios.length) {
            const scenarios = saved.scenarios.map((x) => parseScenario(JSON.stringify(x)));
            if (new Set(scenarios.map((s) => s.id)).size !== scenarios.length)
              throw new Error(
                'Stored scenario IDs are duplicated. Export your data before resetting storage.',
              );
            const scenario = scenarios.find((x) => x.id === saved.activeId) || scenarios[0];
            const preferences = saved.preferences;
            let customRange = periodRange('Last 30 days');
            try {
              if (preferences?.customRange) customRange = periodRange('Custom Date', preferences.customRange);
            } catch {
              /* Recover an invalid old date preference without changing scenario data. */
            }
            set({
              scenario,
              scenarios,
              activeId: scenario.id,
              selectedCreator: creatorFor(scenario, preferences?.selectedCreator ?? 'all'),
              period: periods.includes(preferences?.period as Period) ? preferences!.period : 'Last 30 days',
              customRange,
              editMode: preferences?.editMode === true,
              ready: true,
              ...freshHistory,
            });
          } else {
            await saveWorkspace(workspace());
            set({ ready: true });
          }
        } catch (error) {
          initialization = undefined;
          set({
            ready: true,
            saveStatus: 'error',
            saveError: error instanceof Error ? error.message : 'Local storage could not be opened',
          });
        }
      })();
      return initialization;
    },
    updateScenario: (recipe) => {
      const s = get();
      const draft = clone(s.scenario);
      recipe(draft);
      if (draft.id !== s.scenario.id)
        throw new Error('A scenario ID cannot be edited. Duplicate or import a scenario instead.');
      if (JSON.stringify(draft) === JSON.stringify(s.scenario)) return;
      const past = [...s.past, clone(s.scenario)].slice(-40);
      set({
        scenario: draft,
        scenarios: s.scenarios.map((x) => (x.id === s.scenario.id ? draft : x)),
        selectedCreator: creatorFor(draft, s.selectedCreator),
        past,
        future: [],
        canUndo: true,
        canRedo: false,
      });
      schedule();
    },
    setCreator: (id) => {
      const selectedCreator = creatorFor(get().scenario, id);
      if (selectedCreator === get().selectedCreator) return;
      set({ selectedCreator });
      schedule();
    },
    setPeriod: (period) => {
      if (!periods.includes(period) || period === get().period) return;
      set({ period });
      schedule();
    },
    setRange: (customRange) => {
      periodRange('Custom Date', customRange);
      set({ customRange });
      schedule();
    },
    toggleEdit: () => {
      set((s) => ({ editMode: !s.editMode }));
      schedule();
    },
    undo: () => {
      const s = get();
      if (!s.past.length) return;
      const scenario = clone(s.past[s.past.length - 1]);
      const past = s.past.slice(0, -1);
      set({
        scenario,
        scenarios: s.scenarios.map((x) => (x.id === scenario.id ? scenario : x)),
        selectedCreator: creatorFor(scenario, s.selectedCreator),
        past,
        future: [clone(s.scenario), ...s.future],
        canUndo: past.length > 0,
        canRedo: true,
      });
      schedule();
    },
    redo: () => {
      const s = get();
      if (!s.future.length) return;
      const scenario = clone(s.future[0]);
      const future = s.future.slice(1);
      set({
        scenario,
        scenarios: s.scenarios.map((x) => (x.id === scenario.id ? scenario : x)),
        selectedCreator: creatorFor(scenario, s.selectedCreator),
        past: [...s.past, clone(s.scenario)].slice(-40),
        future,
        canUndo: true,
        canRedo: future.length > 0,
      });
      schedule();
    },
    saveNow: persist,
    switchScenario: (id) => {
      const scenario = get().scenarios.find((x) => x.id === id);
      if (!scenario || id === get().activeId) return;
      set({ scenario, activeId: id, selectedCreator: 'all', ...freshHistory });
      schedule();
    },
    duplicateScenario: () => {
      const scenario = clone(get().scenario);
      scenario.id = uid();
      scenario.name += ' · copy';
      set((s) => ({
        scenario,
        scenarios: [...s.scenarios, scenario],
        activeId: scenario.id,
        ...freshHistory,
      }));
      schedule();
    },
    createScenario: (name) => {
      const scenario = seedScenario(name.trim() || 'New scenario');
      scenario.id = uid();
      set((s) => ({
        scenario,
        scenarios: [...s.scenarios, scenario],
        activeId: scenario.id,
        selectedCreator: 'all',
        ...freshHistory,
      }));
      schedule();
    },
    deleteScenario: (id) => {
      const s = get();
      if (!s.scenarios.some((x) => x.id === id)) return;
      if (s.scenarios.length <= 1) throw new Error('Keep at least one scenario.');
      const scenarios = s.scenarios.filter((x) => x.id !== id);
      const scenario = scenarios.find((x) => x.id === s.activeId) || scenarios[0];
      set({
        scenarios,
        scenario,
        activeId: scenario.id,
        selectedCreator: creatorFor(scenario, s.selectedCreator),
        ...freshHistory,
      });
      schedule();
    },
    resetScenario: () => {
      const s = get();
      const fresh = seedScenario(s.scenario.name);
      fresh.id = s.scenario.id;
      get().updateScenario((d) => Object.assign(d, fresh));
    },
    importScenario: (text) => {
      const scenario = parseScenario(text);
      scenario.id = uid();
      set((s) => ({
        scenario,
        scenarios: [...s.scenarios, scenario],
        activeId: scenario.id,
        selectedCreator: 'all',
        ...freshHistory,
      }));
      schedule();
    },
  }));
  return store;
}
export const useStudio = createStudioStore();
