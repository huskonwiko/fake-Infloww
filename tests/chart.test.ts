import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChartCSV, serializeChartCSV } from '../components/chart-panel';

test('chart CSV imports dates, series values and quoted legend text', () => {
  const result = parseChartCSV('date,"Revenue, net",Tips\r\n2026-09-01,250,20\r\n2026-09-02,480,30');
  assert.equal(result.series[0].label, 'Revenue, net');
  assert.equal(result.points[1].values[result.series[0].id], 480);
  assert.equal(result.points[0].values[result.series[1].id], 20);
});

test('chart CSV round trip preserves numerical edits and legend colors', () => {
  const config = {
    series: [{ id: 'net', label: 'Net "earnings"', color: '#a694ff' }],
    points: [
      { id: 'p1', date: '2026-09-02', values: { net: 2500.75 } },
      { id: 'p2', date: '2026-09-01', values: { net: 320 } },
    ],
  };
  const restored = parseChartCSV(serializeChartCSV(config), config.series);
  assert.deepEqual(restored.series, config.series);
  assert.equal(restored.points[0].date, '2026-09-01');
  assert.equal(restored.points[1].values.net, 2500.75);
});

test('invalid chart rows are rejected without returning partial data', () => {
  for (const text of [
    'date,revenue\n2026-02-30,100',
    'date,revenue\n2026-09-01,Infinity',
    'date,revenue\n2026-09-01,',
    'date,net,net\n2026-09-01,1,2',
    'date,revenue\n2026-09-01,"100',
  ])
    assert.throws(() => parseChartCSV(text));
});

test('individual chart aggregation respects both employee and creator and leaves source transactions intact', async () => {
  const { seedScenario } = await import('../lib/seed');
  const { scopedChartData } = await import('../components/chart-panel');
  const scenario = seedScenario();
  const base = {
    id: 't1',
    creatorId: 'creator-a',
    employeeId: 'employee-a',
    fanId: 'fan-a',
    date: '2026-09-01T10:00:00Z',
    category: 'message' as const,
    amount: 10,
  };
  scenario.transactions = [
    base,
    { ...base, id: 't2', creatorId: 'creator-b', amount: 20 },
    { ...base, id: 't3', employeeId: 'employee-b', amount: 80 },
  ];
  const range = { from: '2026-09-01', to: '2026-09-01' };
  assert.equal(scopedChartData(scenario, 'all', 'Custom Date', range, 'employee-a')[0].revenue, 30);
  assert.equal(scopedChartData(scenario, 'creator-a', 'Custom Date', range, 'employee-a')[0].revenue, 10);
  assert.equal(scopedChartData(scenario, 'creator-b', 'Custom Date', range, 'employee-b')[0].revenue, 0);
  assert.equal(scopedChartData(scenario, 'all', 'Custom Date', range)[0].revenue, 110);
  assert.equal(scenario.transactions.length, 3);
});
