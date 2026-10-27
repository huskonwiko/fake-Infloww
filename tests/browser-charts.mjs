import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  const locations = [
    process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,
    ...(process.env.NODE_PATH || '').split(':'),
  ].filter(Boolean);
  for (const location of locations) {
    try {
      playwright = createRequire(`${location}/__resolve__.cjs`)('playwright');
      break;
    } catch {
      /* Try the next supported global module directory. */
    }
  }
  if (!playwright)
    throw new Error(
      'Playwright is required. Install it locally or expose the runtime package through NODE_PATH.',
    );
}
const browser = await playwright.chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const base = process.env.CRM_BASE_URL || 'http://127.0.0.1:3000';
async function saved() {
  await page.getByText('All changes saved', { exact: true }).waitFor();
}
async function exportScenario() {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile(await download.path(), 'utf8'));
}
async function editMode() {
  const button = page.getByRole('button', { name: 'EDIT MODE', exact: true });
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
}
async function openChart() {
  await page.getByRole('button', { name: 'Edit Revenue overview', exact: true }).click();
  const dialog = page.locator('dialog[open]');
  await dialog.getByRole('heading', { name: 'Chart studio' }).waitFor();
  return dialog;
}
const scope = 'revenue-overview:all:Last 30 days';
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  await editMode();

  // A manual KPI must persist independently of its computed transaction total.
  await page.getByRole('button', { name: 'Edit Total earnings', exact: true }).click();
  await page.getByLabel('Value source').selectOption('manual');
  await page.getByLabel('KPI value').fill('73456.78');
  await page.getByRole('button', { name: 'Apply changes', exact: true }).click();
  await saved();
  assert.match(
    await page.getByRole('button', { name: 'Edit Total earnings', exact: true }).innerText(),
    /73,456\.78/,
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  await editMode();
  assert.match(
    await page.getByRole('button', { name: 'Edit Total earnings', exact: true }).innerText(),
    /73,456\.78/,
  );
  const kpiScenario = await exportScenario();
  assert.equal(kpiScenario.overrides['all:Last 30 days:total'].value, 73456.78);
  console.log('PASS: KPI custom value survives IndexedDB reload and JSON export.');

  // Point changes must switch to custom mode and survive undo/redo and export.
  let dialog = await openChart();
  await dialog.locator('.recharts-area-curve').first().waitFor();
  const oldCurve = await dialog.locator('.recharts-area-curve').first().getAttribute('d');
  const firstPoint = dialog.locator('tbody tr').first();
  const date = await firstPoint.locator('input[type=date]').inputValue();
  const firstValue = firstPoint.locator('input[type=number]').first();
  const oldValue = Number(await firstValue.inputValue());
  await firstValue.fill('9876.54');
  await page.waitForFunction(
    (old) => document.querySelector('dialog[open] .recharts-area-curve')?.getAttribute('d') !== old,
    oldCurve,
  );
  assert.notEqual(await dialog.locator('.recharts-area-curve').first().getAttribute('d'), oldCurve);
  assert.equal(await dialog.getByLabel('Data mode').inputValue(), 'custom');
  assert.equal(
    await dialog.locator('tbody tr').first().locator('input[type=number]').first().inputValue(),
    '9876.54',
  );
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await saved();
  let scenario = await exportScenario();
  assert.equal(scenario.charts[scope].manual, true);
  assert.equal(scenario.charts[scope].points.find((p) => p.date === date).values.revenue, 9876.54);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  dialog = await openChart();
  assert.equal(
    Number(await dialog.locator('tbody tr').first().locator('input[type=number]').first().inputValue()),
    oldValue,
  );
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  dialog = await openChart();
  assert.equal(
    await dialog.locator('tbody tr').first().locator('input[type=number]').first().inputValue(),
    '9876.54',
  );
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  console.log('PASS: chart point change updates custom data, JSON, undo and redo.');

  // Importing a CSV changes points and curves while keeping creator/date scopes isolated.
  dialog = await openChart();
  await dialog.getByLabel('Import chart CSV').setInputFiles({
    name: 'editable-curve.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('date,Total earnings,Message revenue\r\n2026-09-01,250,40\r\n2026-09-02,2500,80'),
  });
  await page.waitForFunction(
    () => document.querySelector('dialog[open] tbody')?.querySelectorAll('tr').length === 2,
  );
  assert.equal(
    await dialog.locator('tbody tr').nth(1).locator('input[type=number]').first().inputValue(),
    '2500',
  );
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await saved();
  scenario = await exportScenario();
  assert.equal(scenario.charts[scope].points.length, 2);
  assert.equal(scenario.charts[scope].points[1].values.revenue, 2500);
  assert.equal(scenario.charts[scope].points[0].date, '2026-09-01');
  await page.getByLabel('Reporting period').selectOption('Last 7 days');
  dialog = await openChart();
  assert.equal(await dialog.getByLabel('Data mode').inputValue(), 'calculated');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Reporting period').selectOption('Last 30 days');
  const creatorId = await page.getByLabel('Select creator').locator('option').nth(1).getAttribute('value');
  await page.getByLabel('Select creator').selectOption(creatorId);
  dialog = await openChart();
  assert.equal(await dialog.getByLabel('Data mode').inputValue(), 'calculated');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByLabel('Select creator').selectOption('all');
  dialog = await openChart();
  assert.equal(await dialog.getByLabel('Data mode').inputValue(), 'custom');
  assert.equal(await dialog.locator('tbody tr').count(), 2);
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await saved();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Overview', exact: true }).waitFor();
  await editMode();
  dialog = await openChart();
  assert.equal(await dialog.locator('tbody tr').count(), 2);
  assert.equal(
    await dialog.locator('tbody tr').nth(1).locator('input[type=number]').first().inputValue(),
    '2500',
  );
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  console.log('PASS: CSV import persists and chart edits are isolated by period and creator.');
  assert.deepEqual(errors, [], `Browser errors: ${errors.join('; ')}`);
  console.log('PASS: no uncaught browser errors.');
} finally {
  await context.close();
  await browser.close();
}
