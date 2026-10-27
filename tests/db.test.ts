import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db, loadWorkspace, saveWorkspace } from '../lib/db';
import { seedScenario } from '../lib/seed';

test('IndexedDB restores independent scenarios and edits after database reopen', async () => {
  await db.workspace.clear();
  const first = seedScenario('First');
  const second = seedScenario('Second');
  second.id = 'scenario-second';
  first.creators[0].name = 'Edited fictional name';
  second.transactions[0].amount = 999.25;
  await saveWorkspace({ scenarios: [first, second], activeId: second.id });
  db.close();
  await db.open();
  const restored = await loadWorkspace();
  assert.equal(restored?.activeId, second.id);
  assert.equal(restored?.scenarios.length, 2);
  assert.equal(restored?.scenarios[0].creators[0].name, 'Edited fictional name');
  assert.equal(restored?.scenarios[1].transactions[0].amount, 999.25);
  assert.notEqual(restored?.scenarios[0].transactions[0].amount, 999.25);
  await db.workspace.clear();
  db.close();
});
