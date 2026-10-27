import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const b = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const p = await b.newPage({ viewport: { width: 1600, height: 1050 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const base = process.env.CRM_BASE_URL || 'http://127.0.0.1:3000';
const num = (t) => Number(t.replace(/[^\d.-]/g, ''));
const total = () => p.locator('.ref-earnings-summary [data-testid=linked-value-total]').innerText().then(num);
try {
  await p.goto(base);
  await p.getByRole('heading', { name: 'Creator earnings overview', exact: true }).waitFor();
  await p.getByLabel('Earnings basis').selectOption('gross');
  const initial = await total();
  const message = p.locator('.ref-earnings-summary [data-testid=linked-value-messages]');
  const old = num(await message.innerText());
  await message.click();
  let dialog = p.getByRole('dialog');
  await dialog.getByLabel('Amount', { exact: true }).fill('5432.17');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(Math.round((await total()) * 100), Math.round((initial - old + 5432.17) * 100));
  await p.waitForTimeout(500);
  await p.reload();
  await p.getByRole('heading', { name: 'Creator earnings overview', exact: true }).waitFor();
  assert.equal(
    num(await p.locator('.ref-earnings-summary [data-testid=linked-value-messages]').innerText()),
    5432.17,
  );
  await p.screenshot({ path: '/tmp/velvet-dashboard-v2.png', fullPage: true });
  await p.evaluate(() => (location.hash = 'creator-reports'));
  await p.getByRole('heading', { name: 'Creator reports', exact: true }).waitFor();
  const summary = p.locator('.ref-report-summary');
  assert.equal(num(await summary.getByTestId('linked-value-messages').innerText()), 5432.17);
  const graph = p.locator('[data-chart-title="Earnings trends"]');
  const before = num(await summary.getByTestId('linked-value-total').innerText());
  await graph.locator('rect[role=button]').first().click();
  dialog = p.getByRole('dialog');
  const prior = Number(await dialog.getByLabel('Amount', { exact: true }).inputValue());
  await dialog.getByLabel('Amount', { exact: true }).fill('1234.56');
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  assert.equal(
    Math.round(num(await summary.getByTestId('linked-value-total').innerText()) * 100),
    Math.round((before - prior + 1234.56) * 100),
  );
  await p.screenshot({ path: '/tmp/velvet-reports-v2.png', fullPage: true });
  await p.getByRole('switch', { name: 'Show net earnings' }).click();
  const net = num(await summary.getByTestId('linked-value-total').innerText());
  const amounts = await summary.locator('.ref-report-category [data-testid^=linked-value-]').allInnerTexts();
  assert.equal(
    amounts.reduce((n, x) => n + Math.round(num(x) * 100), 0),
    Math.round(net * 100),
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(250);
  assert.equal(await p.evaluate(() => document.body.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: one-click edits, source-linked KPI/chart changes, category sums, reports, reload persistence, net/gross, mobile, zero page errors',
  );
} finally {
  await b.close();
}
