import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedScenario } from '../lib/seed';
import {
  calculateMetricChanges,
  calculateMetrics,
  calculateRevenue,
  chartData,
  filteredTransactions,
  periodRange,
} from '../lib/analytics';
import { parseScenario, exportScenario } from '../lib/schema';

test('fictional demo contains requested complete data set and is deterministic', () => {
  const scenario = seedScenario('Test', new Date('2026-10-27T12:00:00Z'));
  assert.equal(scenario.creators.length, 4);
  assert.equal(scenario.employees.length, 8);
  assert.equal(scenario.fans.length, 250);
  assert.equal(scenario.transactions.length, 1000);
  assert.equal(new Set(scenario.transactions.map((t) => t.date.slice(0, 10))).size, 90);
  assert.ok(
    scenario.transactions.every(
      (t) => scenario.fans.find((f) => f.id === t.fanId)!.joinedAt <= t.date.slice(0, 10),
    ),
  );
  assert.deepEqual(scenario, seedScenario('Test', new Date('2026-10-27T12:00:00Z')));
  assert.doesNotThrow(() => parseScenario(exportScenario(scenario)));
});
test('revenue totals, category sums and platform fee are calculated in cents', () => {
  const scenario = seedScenario();
  const samples = scenario.transactions.slice(0, 4).map((t, i) => ({
    ...t,
    amount: [10.01, 20.02, 30.03, 40.04][i],
    category: ['subscription', 'message', 'tip', 'ppv'][i] as typeof t.category,
  }));
  assert.deepEqual(calculateRevenue(samples), {
    total: 100.1,
    gross: 100.1,
    net: 80.08,
    subscriptions: 10.01,
    messages: 20.02,
    tips: 30.03,
    ppv: 40.04,
    posts: 0,
    referrals: 0,
    streams: 0,
  });
});
test('periods include the selected day, respect leap years and previous month boundaries', () => {
  const now = new Date('2024-03-01T23:45:00Z');
  assert.deepEqual(periodRange('Today', undefined, now), { from: '2024-03-01', to: '2024-03-01' });
  assert.deepEqual(periodRange('Yesterday', undefined, now), { from: '2024-02-29', to: '2024-02-29' });
  assert.deepEqual(periodRange('Last Month', undefined, now), { from: '2024-02-01', to: '2024-02-29' });
  assert.deepEqual(periodRange('Last 7 days', undefined, now), { from: '2024-02-24', to: '2024-03-01' });
  assert.throws(() => periodRange('Custom Date', { from: '2026-10-28', to: '2026-10-01' }));
  assert.throws(() => periodRange('Custom Date', { from: '2026-02-31', to: '2026-03-04' }));
});
test('creator isolation, inclusive final timestamps and chart day filling work', () => {
  const scenario = seedScenario('Test', new Date('2026-10-27T12:00:00Z'));
  const range = { from: '2026-10-01', to: '2026-10-27' };
  const creator = scenario.creators[0].id;
  const selected = filteredTransactions(scenario, creator, 'Custom Date', range);
  assert.ok(selected.length);
  assert.ok(selected.every((t) => t.creatorId === creator));
  assert.equal(
    selected.length,
    scenario.transactions.filter(
      (t) => t.creatorId === creator && t.date.slice(0, 10) >= range.from && t.date.slice(0, 10) <= range.to,
    ).length,
  );
  const points = chartData(scenario, creator, 'Custom Date', range);
  assert.equal(points.length, 27);
  assert.equal(points[26].date, range.to);
  assert.equal(
    Math.round(points.reduce((sum, p) => sum + p.revenue, 0) * 100),
    Math.round(calculateRevenue(selected).total * 100),
  );
  const before = calculateMetrics(scenario, creator, 'Custom Date', range).total;
  selected[0].amount += 100;
  assert.equal(
    calculateMetrics(scenario, creator, 'Custom Date', range).total,
    Math.round((before + 100) * 100) / 100,
  );
});
test('manual chart edits and override markers survive validated JSON export/import', () => {
  const scenario = seedScenario();
  scenario.charts.example = {
    title: 'Custom revenue',
    manual: true,
    type: 'line',
    yMin: 0,
    yMax: 5000,
    series: [{ id: 'revenue', label: 'Revenue', color: '#a78bfa' }],
    points: [
      { id: 'one', date: '2026-09-01', values: { revenue: 250 } },
      { id: 'two', date: '2026-09-02', values: { revenue: 2500 } },
    ],
  };
  scenario.overrides.total = { value: 14500, change: -8.2, color: '#ff8844' };
  const imported = parseScenario(exportScenario(scenario));
  assert.equal(imported.charts.example.points[1].values.revenue, 2500);
  assert.equal(imported.charts.example.manual, true);
  assert.deepEqual(imported.overrides.total, scenario.overrides.total);
});
test('import rejects unsupported versions, invalid dates, unsafe images and broken relationships', () => {
  const invalid = seedScenario();
  invalid.transactions[0].fanId = 'missing';
  assert.throws(() => parseScenario(JSON.stringify(invalid)), /fan/i);
  invalid.transactions[0].fanId = invalid.fans.find(
    (f) => f.creatorId !== invalid.transactions[0].creatorId,
  )!.id;
  assert.throws(() => parseScenario(JSON.stringify(invalid)), /creator/i);
  const duplicate = seedScenario();
  duplicate.fans[1].id = duplicate.fans[0].id;
  assert.throws(() => parseScenario(JSON.stringify(duplicate)), /Duplicate/);
  const wrongDate = seedScenario();
  wrongDate.fans[0].joinedAt = '2026-02-31';
  assert.throws(() => parseScenario(JSON.stringify(wrongDate)), /valid/);
  const unsafe = seedScenario();
  unsafe.creators[0].avatar = 'https://tracking.example/photo.jpg';
  assert.throws(() => parseScenario(JSON.stringify(unsafe)), /local/);
  assert.throws(() => parseScenario('{"version":2}'));
  assert.throws(() => parseScenario('invalid'), /JSON/);
});

test('new subscribers exclude free and expired profiles while snapshots remain explicit', () => {
  const scenario = seedScenario();
  const reference = scenario.fans[0];
  scenario.fans = ['paid', 'renewed', 'free', 'expired'].map((status, index) => ({
    ...reference,
    id: `test-fan-${index}`,
    status: status as typeof reference.status,
    joinedAt: '2026-09-14',
  }));
  scenario.transactions = [];
  const metrics = calculateMetrics(scenario, 'all', 'Custom Date', { from: '2026-09-01', to: '2026-09-30' });
  assert.equal(metrics.newSubscribers, 2);
  assert.equal(metrics.subscribers, 2);
  const changes = calculateMetricChanges(scenario, 'all', 'Custom Date', {
    from: '2026-09-01',
    to: '2026-09-30',
  });
  assert.equal(changes.subscribers, 0);
  assert.equal(changes.expired, 0);
  assert.equal(changes.renewalRate, 0);
});
test('each revenue category compares its own preceding equal-length period', () => {
  const scenario = seedScenario();
  const template = scenario.transactions[0];
  const fan = scenario.fans.find((f) => f.id === template.fanId)!;
  scenario.fans = [fan];
  const prior = [100, 100, 100, 0],
    current = [200, 50, 100, 0];
  const categories = ['subscription', 'message', 'tip', 'ppv'] as const;
  scenario.transactions = categories.flatMap((category, index) => [
    { ...template, id: `previous-${index}`, date: '2026-08-28T12:00:00Z', category, amount: prior[index] },
    { ...template, id: `current-${index}`, date: '2026-09-02T12:00:00Z', category, amount: current[index] },
  ]);
  const changes = calculateMetricChanges(scenario, template.creatorId, 'Custom Date', {
    from: '2026-09-01',
    to: '2026-09-07',
  });
  assert.equal(changes.subscriptions, 100);
  assert.equal(changes.messages, -50);
  assert.equal(changes.tips, 0);
  assert.equal(changes.ppv, 0);
  assert.ok(Math.abs(changes.total - (50 / 300) * 100) < 0.000001);
  assert.equal(changes.averageOrderValue, changes.total);
  assert.equal(changes.arpu, changes.total);
  assert.equal(changes.conversionRate, 0);
  scenario.transactions.find((t) => t.id === 'current-3')!.amount = 50;
  assert.ok(
    Number.isNaN(
      calculateMetricChanges(scenario, 'all', 'Custom Date', { from: '2026-09-01', to: '2026-09-07' }).ppv,
    ),
  );
});
test('seed revenue categories are distributed independently of transaction day', () => {
  const scenario = seedScenario('Test', new Date('2026-10-27T12:00:00Z'));
  const todaysCategories = new Set(
    scenario.transactions.filter((t) => t.date.startsWith('2026-10-27')).map((t) => t.category),
  );
  assert.ok(todaysCategories.size > 1);
  assert.equal(new Set(scenario.transactions.map((t) => t.category)).size, 4);
});
