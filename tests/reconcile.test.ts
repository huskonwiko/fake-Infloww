import test from 'node:test';
import assert from 'node:assert/strict';
import { seedScenario } from '../lib/seed';
import { reconcileRevenue, revenueAmount, revenueSeries } from '../lib/reconcile';
import { parseScenario, exportScenario } from '../lib/schema';
const scope = { from: '2026-07-01', to: '2026-10-31' };
test('linked edits preserve exact cents, creator isolation and unrelated categories', () => {
  const s = seedScenario('Linked', new Date('2026-10-27'));
  const before = structuredClone(s);
  const selected = { ...scope, creatorId: s.creators[0].id };
  reconcileRevenue(s, selected, 'messages', 1234.57);
  assert.equal(revenueAmount(s, selected, 'messages'), 1234.57);
  assert.deepEqual(
    s.transactions.filter((t) => t.creatorId !== selected.creatorId),
    before.transactions.filter((t) => t.creatorId !== selected.creatorId),
  );
  assert.deepEqual(
    s.transactions.filter(
      (t) => t.creatorId === selected.creatorId && !['message', 'ppv'].includes(t.category),
    ),
    before.transactions.filter(
      (t) => t.creatorId === selected.creatorId && !['message', 'ppv'].includes(t.category),
    ),
  );
  assert.equal(
    revenueAmount(s, scope, 'total'),
    s.transactions.reduce((n, t) => n + Math.round(t.amount * 100), 0) / 100,
  );
});
test('editing an empty day creates attributed sales and linked PPV prices stay coherent', () => {
  const s = seedScenario();
  const one = { from: '2020-01-01', to: '2020-01-01', creatorId: s.creators[0].id };
  reconcileRevenue(s, one, 'ppv', 45.67);
  const t = s.transactions.at(-1)!;
  s.messages.push({
    id: 'linked-sale',
    fanId: t.fanId,
    direction: 'out',
    text: 'Fictional sale',
    date: t.date,
    ppvAmount: t.amount,
    image: '',
    saleId: t.id,
  });
  reconcileRevenue(s, one, 'ppv', 89.12);
  assert.equal(s.messages.at(-1)!.ppvAmount, 89.12);
  assert.equal(revenueAmount(s, one, 'ppv'), 89.12);
  assert.doesNotThrow(() => parseScenario(exportScenario(s)));
});
test('net categories and temporal buckets sum to exactly the displayed total', () => {
  const s = seedScenario('Net', new Date('2026-10-27'));
  const net = { ...scope, net: true };
  reconcileRevenue(s, net, 'total', 999.99);
  assert.equal(revenueAmount(s, net, 'total'), 999.99);
  const cents = (n: number) => Math.round(n * 100);
  assert.equal(
    ['subscriptions', 'posts', 'messages', 'tips', 'referrals', 'streams'].reduce(
      (n, k) => n + cents(revenueAmount(s, net, k as 'messages')),
      0,
    ),
    99999,
  );
  assert.equal(
    revenueSeries(s, net, 'day').reduce((n, b) => n + cents(b.total), 0),
    99999,
  );
});
test('negative, invalid and empty creator group edits reject without changing data', () => {
  const s = seedScenario();
  const before = JSON.stringify(s);
  for (const n of [-1, NaN, Infinity]) assert.throws(() => reconcileRevenue(s, scope, 'total', n));
  assert.throws(() => reconcileRevenue(s, { ...scope, creatorIds: [] }, 'total', 50));
  assert.throws(() => reconcileRevenue(s, { ...scope, creatorId: 'missing' }, 'total', 50));
  assert.equal(JSON.stringify(s), before);
});
test('old scenarios and new optional preferences roundtrip without data loss', () => {
  const s = seedScenario();
  const before = s.transactions;
  s.settings.netEarnings = false;
  s.settings.clockedIn = [{ employeeId: s.employees[0].id, startedAt: new Date().toISOString() }];
  s.creators[0].tags = ['VIP'];
  const imported = parseScenario(exportScenario(s));
  assert.deepEqual(imported.transactions, before);
  assert.equal(imported.settings.netEarnings, false);
  assert.deepEqual(imported.creators[0].tags, ['VIP']);
});
