import Dexie, { type Table } from 'dexie';
import type { Period, Scenario } from './types';
export interface Workspace {
  scenarios: Scenario[];
  activeId: string;
  preferences?: {
    selectedCreator: string;
    period: Period;
    customRange: { from: string; to: string };
    editMode: boolean;
  };
}
interface WorkspaceRow {
  id: string;
  value: Workspace;
}
class StudioDatabase extends Dexie {
  workspace!: Table<WorkspaceRow, string>;
  constructor() {
    super('velvet-crm-studio');
    this.version(1).stores({ workspace: 'id' });
  }
}
export const db = new StudioDatabase();
export async function loadWorkspace(): Promise<Workspace | undefined> {
  return (await db.workspace.get('current'))?.value;
}
export async function saveWorkspace(workspace: Workspace): Promise<void> {
  await db.workspace.put({ id: 'current', value: structuredClone(workspace) });
}
