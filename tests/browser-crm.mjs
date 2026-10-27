import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const origin = process.env.CRM_BASE_URL || process.env.CRM_TEST_URL || 'http://127.0.0.1:3000';
function num(text) {
  return Number(text.replace(/[^\d.-]/g, ''));
}
async function route(id) {
  if (page.url() === 'about:blank') await page.goto(`${origin}/#${id}`);
  else
    await page.evaluate((id) => {
      window.location.hash = id;
    }, id);
  await page.locator('.page-content').waitFor();
  await page.waitForTimeout(200);
}
async function persisted() {
  await page.locator('.save-state.saved').waitFor();
}
async function earnings() {
  await route('overview');
  return num(await page.locator('.ref-earnings-summary [data-testid=linked-value-total]').innerText());
}
try {
  await route('overview');
  await page.getByLabel('Earnings basis').selectOption('gross');
  await page.getByLabel('Workspace actions').click();
  await page.getByRole('button', { name: /EDIT MODE/ }).click();
  await page.getByLabel('Workspace actions').click();
  const baseline = await earnings();
  await route('transactions');
  await page.getByRole('button', { name: 'Add record', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Add transaction/ });
  await dialog.waitFor();
  await dialog.getByLabel('Date', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await dialog.getByLabel('Amount', { exact: true }).fill('1234.56');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await persisted();
  const afterAdd = await earnings();
  assert.equal(
    Math.round((afterAdd - baseline) * 100),
    123456,
    'Transaction must update calculated earnings',
  );
  await route('transactions');
  await page.getByRole('button', { name: 'Amount', exact: true }).click();
  await page.getByRole('button', { name: 'Amount', exact: true }).click();
  const transactionRow = page.locator('.data-table tbody tr').filter({ hasText: '$1,234.56' });
  assert.equal(await transactionRow.count(), 1, 'Sort must show newly added transaction');
  await transactionRow.getByRole('button', { name: /Edit / }).click();
  const editor = page.getByRole('dialog', { name: /Edit transaction/ });
  await editor.getByLabel('Amount', { exact: true }).fill('2345.67');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  await persisted();
  const afterEdit = await earnings();
  assert.equal(Math.round((afterEdit - baseline) * 100), 234567, 'Edited transaction must update earnings');
  await route('transactions');
  await page.getByRole('button', { name: 'Amount', exact: true }).click();
  await page.getByRole('button', { name: 'Amount', exact: true }).click();
  const editedRow = page.locator('.data-table tbody tr').filter({ hasText: '$2,345.67' });
  page.once('dialog', (d) => d.accept());
  await editedRow.getByRole('button', { name: /Delete / }).click();
  await persisted();
  assert.equal(await earnings(), baseline, 'Deleting transaction must restore earnings');
  await route('creators');
  await page.getByRole('textbox', { name: 'Search Creators', exact: false }).fill('does-not-exist');
  await page.getByText('No records match.', { exact: false }).waitFor();
  assert.equal(await page.locator('.data-table tbody tr').count(), 0, 'Search should filter rows');
  await page.getByRole('textbox', { name: 'Search Creators', exact: false }).fill('');
  assert.equal(await page.locator('.data-table tbody tr').count(), 4, 'Clearing search should restore rows');
  await route('scheduling');
  await page.getByRole('button', { name: 'Add record', exact: true }).click();
  const shift = page.getByRole('dialog', { name: /Add shift/ });
  await shift.getByLabel('Date', { exact: true }).fill(new Date().toISOString().slice(0, 10));
  await shift.getByLabel('Start', { exact: true }).fill('08:15');
  await shift.getByLabel('End', { exact: true }).fill('11:45');
  await shift.getByRole('button', { name: 'Save changes', exact: true }).click();
  await shift.waitFor({ state: 'hidden' });
  await persisted();
  const card = page.locator('.shift-card').filter({ hasText: '08:15 – 11:45' });
  await card.waitFor();
  const before = await card.locator('..').locator('.schedule-day-heading').innerText();
  const days = page.locator('.schedule-day');
  const currentIndex = await card.evaluate((el) =>
    Array.from(el.parentElement.parentElement.children).indexOf(el.parentElement),
  );
  const targetIndex = currentIndex === 6 ? 5 : currentIndex + 1;
  await card.dragTo(days.nth(targetIndex));
  await persisted();
  const after = await card.locator('..').locator('.schedule-day-heading').innerText();
  assert.notEqual(after, before, 'Dragging a shift must change its date');
  await page.reload();
  await page.locator('.page-content').waitFor();
  assert.equal(
    await page.locator('.shift-card').filter({ hasText: '08:15 – 11:45' }).count(),
    1,
    'Shift must persist after reload',
  );
  const exportPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const exported = JSON.parse(readFileSync(await (await exportPromise).path(), 'utf8'));
  const lastDay = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const periodTransactions = exported.transactions.filter(
    (transaction) => transaction.date.slice(0, 10) >= firstDay && transaction.date.slice(0, 10) <= lastDay,
  );
  const expected = (employeeId, creatorId) =>
    Math.round(
      periodTransactions
        .filter(
          (transaction) =>
            (!employeeId || transaction.employeeId === employeeId) &&
            (!creatorId || transaction.creatorId === creatorId),
        )
        .reduce((total, transaction) => total + transaction.amount, 0) * 100,
    );
  async function chartTotal(scope = page.locator('.chart-panel')) {
    return Math.round(
      num(await scope.getByText('in selected period', { exact: true }).locator('..').innerText()) * 100,
    );
  }
  await route('creator-analytics');
  await page.getByRole('heading', { name: 'Creator revenue trend', exact: true }).waitFor();
  assert.ok(await page.locator('.chart-panel svg').count(), 'Creator analytics renders a real chart');
  assert.equal(
    await chartTotal(),
    expected(),
    'Creator analytics chart must equal exported period transactions',
  );
  await route('employee-performance');
  const employeeSelector = page.getByLabel('Employee chart', { exact: true });
  await employeeSelector.selectOption('employee-2');
  await page.getByRole('heading', { name: 'Jamie Parker · Sales trend', exact: true }).waitFor();
  assert.equal(
    await chartTotal(),
    expected('employee-2'),
    'Employee chart must equal exported employee transactions',
  );
  await page.getByRole('combobox', { name: 'Select creator', exact: true }).selectOption('creator-1');
  assert.equal(
    await chartTotal(),
    expected('employee-2', 'creator-1'),
    'Employee chart must intersect employee and creator scopes',
  );
  await employeeSelector.selectOption('employee-3');
  await page.getByRole('heading', { name: 'Sam Bennett · Sales trend', exact: true }).waitFor();
  assert.equal(
    await chartTotal(),
    expected('employee-3', 'creator-1'),
    'Switching employee must isolate their transactions',
  );
  assert.ok(
    await page.locator('.chart-panel svg').count(),
    'Employee chart renders with combined employee/creator scope',
  );
  await route('creator-profiles');
  await page.getByRole('button', { name: 'View breakdown', exact: false }).click();
  const profile = page.getByRole('dialog', { name: 'Sofia Morgan analytics', exact: true });
  await profile.getByRole('heading', { name: 'Sofia Morgan · Revenue trend', exact: true }).waitFor();
  assert.ok(
    await profile.locator('.chart-panel svg').count(),
    'Creator profile contains an interactive chart',
  );
  assert.equal(
    await chartTotal(profile.locator('.chart-panel')),
    expected(undefined, 'creator-1'),
    'Creator profile chart must equal own exported transactions',
  );
  await profile.getByRole('button', { name: 'Close profile', exact: true }).click();
  assert.deepEqual(errors, [], 'No browser runtime errors');
  console.log(
    JSON.stringify(
      {
        passed: [
          'transaction add recalculates earnings',
          'transaction edit recalculates earnings',
          'transaction delete restores earnings',
          'table sort',
          'table search',
          'schedule CRUD',
          'schedule drag and persistence',
          'individual employee chart',
          'creator analytics and profile charts',
        ],
        baseline,
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  await browser.close();
}
