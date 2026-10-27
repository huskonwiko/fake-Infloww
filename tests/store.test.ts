import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStudioStore } from '../lib/store';
import { db, loadWorkspace } from '../lib/db';
import { exportScenario } from '../lib/schema';
async function freshStore() {
  await db.open();
  await db.workspace.clear();
  const store = createStudioStore();
  await store.getState().initialize();
  return store;
}

test('edits, undo and redo save automatically to IndexedDB', async () => {
  const store = await freshStore();
  const before = store.getState().scenario.transactions[0].amount;
  store.getState().updateScenario((s) => {
    s.transactions[0].amount = 999.99;
  });
  assert.equal(store.getState().saveStatus, 'saving');
  assert.equal(store.getState().canUndo, true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal((await loadWorkspace())?.scenarios[0].transactions[0].amount, 999.99);
  store.getState().undo();
  assert.equal(store.getState().scenario.transactions[0].amount, before);
  assert.equal(store.getState().canRedo, true);
  store.getState().redo();
  assert.equal(store.getState().scenario.transactions[0].amount, 999.99);
  await store.getState().saveNow();
  assert.equal(store.getState().saveStatus, 'saved');
});
test('duplicate, create, switch and import maintain independent scenario identities', async () => {
  const store = await freshStore();
  const originalId = store.getState().activeId;
  store.getState().duplicateScenario();
  const copyId = store.getState().activeId;
  assert.notEqual(copyId, originalId);
  store.getState().updateScenario((s) => {
    s.creators[0].name = 'A fictional edited creator';
  });
  store.getState().switchScenario(originalId);
  assert.notEqual(store.getState().scenario.creators[0].name, 'A fictional edited creator');
  assert.equal(store.getState().canUndo, false);
  const exported = exportScenario(store.getState().scenario);
  store.getState().importScenario(exported);
  assert.notEqual(store.getState().activeId, originalId);
  assert.notEqual(store.getState().activeId, copyId);
  store.getState().createScenario('A new scenario');
  assert.equal(store.getState().scenario.name, 'A new scenario');
  assert.equal(new Set(store.getState().scenarios.map((s) => s.id)).size, 4);
  await store.getState().saveNow();
  const restored = createStudioStore();
  await restored.getState().initialize();
  assert.equal(restored.getState().scenarios.length, 4);
  assert.equal(restored.getState().scenario.name, 'A new scenario');
});
test('invalid imports and attempted ID mutation leave the workspace unchanged', async () => {
  const store = await freshStore(),
    before = JSON.stringify(store.getState().scenario),
    activeId = store.getState().activeId;
  assert.throws(() => store.getState().importScenario('{"version":2}'));
  assert.throws(() =>
    store.getState().updateScenario((s) => {
      s.id = 'broken';
    }),
  );
  assert.equal(store.getState().activeId, activeId);
  assert.equal(store.getState().scenarios.length, 1);
  assert.equal(JSON.stringify(store.getState().scenario), before);
  assert.equal(store.getState().canUndo, false);
  await store.getState().saveNow();
});
test('display preferences survive reload and deleted creator selections recover safely', async () => {
  const store = await freshStore();
  const creatorId = store.getState().scenario.creators[0].id;
  store.getState().setCreator(creatorId);
  store.getState().setPeriod('Custom Date');
  store.getState().setRange({ from: '2026-09-01', to: '2026-09-30' });
  store.getState().toggleEdit();
  await store.getState().saveNow();
  const reloaded = createStudioStore();
  await reloaded.getState().initialize();
  assert.equal(reloaded.getState().selectedCreator, creatorId);
  assert.equal(reloaded.getState().editMode, true);
  assert.equal(reloaded.getState().period, 'Custom Date');
  assert.equal(reloaded.getState().customRange.from, '2026-09-01');
  reloaded.getState().updateScenario((s) => {
    s.creators = s.creators.filter((c) => c.id !== creatorId);
    s.fans = s.fans.filter((f) => f.creatorId !== creatorId);
    const fans = new Set(s.fans.map((f) => f.id));
    s.messages = s.messages.filter((m) => fans.has(m.fanId));
    s.transactions = s.transactions.filter((t) => t.creatorId !== creatorId);
    s.campaigns = s.campaigns.filter((c) => c.creatorId !== creatorId);
    const campaigns = new Set(s.campaigns.map((c) => c.id));
    s.links = s.links.filter((l) => campaigns.has(l.campaignId));
  });
  assert.equal(reloaded.getState().selectedCreator, 'all');
  await reloaded.getState().saveNow();
});
test('explicit save rejects storage failures and later saves recover without losing edits', async () => {
  const store = await freshStore();
  const originalPut = db.workspace.put.bind(db.workspace);
  db.workspace.put = (() =>
    Promise.reject(new Error('Simulated storage quota failure'))) as unknown as typeof db.workspace.put;
  store.getState().updateScenario((s) => {
    s.name = 'Unsaved edits retained';
  });
  await assert.rejects(() => store.getState().saveNow(), /quota/);
  assert.equal(store.getState().saveStatus, 'error');
  assert.equal(store.getState().scenario.name, 'Unsaved edits retained');
  db.workspace.put = originalPut;
  await store.getState().saveNow();
  assert.equal(store.getState().saveStatus, 'saved');
  assert.equal((await loadWorkspace())?.scenarios[0].name, 'Unsaved edits retained');
});
