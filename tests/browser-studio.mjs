/** End-to-end Studio/Settings checks against a running build. Run: node tests/browser-studio.mjs */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(
    process.env.PLAYWRIGHT_MODULE_PATH ||
      '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  ));
}
const executablePath =
  process.env.CHROMIUM_PATH ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const base = process.env.CRM_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  headless: true,
  ...(executablePath ? { executablePath } : {}),
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
async function open(route, heading) {
  await page.goto(`${base}/#${route}`);
  await page.getByRole('heading', { level: 1, name: heading, exact: true }).waitFor();
}
async function saved() {
  await page.locator('.save-state.saved').waitFor();
}
async function exported() {
  const waiting = page.waitForEvent('download');
  await page.locator('.heading-actions').getByRole('button', { name: 'Export', exact: true }).click();
  const result = await waiting;
  const data = JSON.parse(await readFile(await result.path(), 'utf8'));
  assert.equal(data.version, 1);
  assert.ok(Array.isArray(data.transactions));
  return data;
}
try {
  await open('general', 'General');
  const initial = await exported();
  assert.equal(initial.creators.length, 4);
  assert.equal(initial.employees.length, 8);
  assert.equal(initial.fans.length, 250);
  assert.equal(initial.transactions.length, 1000);
  await page.getByLabel('Studio name', { exact: true }).fill('Browser QA Studio');
  await page.getByLabel('Studio name', { exact: true }).press('Tab');
  await page.getByLabel('Scenario name', { exact: true }).fill('Browser QA scenario');
  await page.getByLabel('Scenario name', { exact: true }).press('Tab');
  await page.getByLabel('Display currency', { exact: false }).selectOption('EUR');
  await saved();
  await page.reload();
  await page.getByRole('heading', { name: 'General', level: 1, exact: true }).waitFor();
  assert.equal(await page.getByLabel('Studio name', { exact: true }).inputValue(), 'Browser QA Studio');
  assert.equal(await page.getByLabel('Scenario name', { exact: true }).inputValue(), 'Browser QA scenario');
  assert.equal(await page.getByLabel('Display currency', { exact: false }).inputValue(), 'EUR');
  // Empty names are visibly rejected and never overwrite valid storage.
  await page.getByLabel('Studio name', { exact: true }).fill('');
  await page.getByLabel('Studio name', { exact: true }).press('Tab');
  assert.equal(await page.getByLabel('Studio name', { exact: true }).inputValue(), 'Browser QA Studio');
  await open('appearance', 'Appearance');
  await page.getByRole('button', { name: 'Light studio', exact: false }).click();
  await saved();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await page.reload();
  await page.getByRole('heading', { name: 'Appearance', level: 1, exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
  await open('studio', 'Studio Editor');
  await page.getByRole('button', { name: 'Data sheets', exact: true }).click();
  await page.getByLabel('Data sheet', { exact: true }).selectOption('employees');
  await page.getByLabel('Hours worked row 1', { exact: true }).fill('123.5');
  await page.getByLabel('Hours worked row 1', { exact: true }).press('Tab');
  await page.getByLabel('Messages sent row 1', { exact: true }).fill('777');
  await page.getByLabel('Messages sent row 1', { exact: true }).press('Tab');
  await saved();
  let result = await exported();
  assert.equal(result.employees[0].hoursWorked, 123.5);
  assert.equal(result.employees[0].messagesSent, 777);
  await page.getByRole('button', { name: 'Undo change', exact: true }).click();
  result = await exported();
  assert.equal(result.employees[0].messagesSent, initial.employees[0].messagesSent);
  await page.getByRole('button', { name: 'Redo change', exact: true }).click();
  result = await exported();
  assert.equal(result.employees[0].messagesSent, 777);
  // Invalid edits are rejected without changing the underlying record.
  await page.getByLabel('Hours worked row 1', { exact: true }).fill('-3');
  await page.getByLabel('Hours worked row 1', { exact: true }).press('Tab');
  await page.getByRole('alert').filter({ hasText: 'Invalid scenario' }).waitFor();
  assert.equal(await page.getByLabel('Hours worked row 1', { exact: true }).inputValue(), '123.5');
  await saved();
  await page.reload();
  await page.getByRole('heading', { name: 'Studio Editor', level: 1, exact: true }).waitFor();
  await page.getByRole('button', { name: 'Data sheets', exact: true }).click();
  await page.getByLabel('Data sheet', { exact: true }).selectOption('employees');
  assert.equal(await page.getByLabel('Hours worked row 1', { exact: true }).inputValue(), '123.5');
  assert.equal(await page.getByLabel('Messages sent row 1', { exact: true }).inputValue(), '777');
  const beforeImport = await exported();
  await open('import-export', 'Import / Export');
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1,"name":"broken"}'),
  });
  await page.getByRole('alert').filter({ hasText: 'Invalid scenario' }).waitFor();
  assert.deepEqual(await exported(), beforeImport, 'Invalid import must not alter the scenario.');
  // Duplicate and switch must isolate edits and persist active scenario independently.
  await open('scenarios', 'Demo scenarios');
  await page.getByRole('button', { name: 'Duplicate current', exact: true }).click();
  await saved();
  const duplicate = await exported();
  assert.notEqual(duplicate.id, beforeImport.id);
  assert.equal(duplicate.transactions.length, beforeImport.transactions.length);
  await open('general', 'General');
  await page.getByLabel('Studio name', { exact: true }).fill('Isolated copy studio');
  await page.getByLabel('Studio name', { exact: true }).press('Tab');
  await saved();
  await open('scenarios', 'Demo scenarios');
  const originalCard = page
    .locator('.form-grid > .panel')
    .filter({ has: page.getByRole('heading', { name: 'Browser QA scenario', exact: true }) });
  await originalCard.getByRole('button', { name: 'Load scenario', exact: true }).click();
  await saved();
  result = await exported();
  assert.equal(result.id, beforeImport.id);
  assert.equal(result.settings.agencyName, 'Browser QA Studio');
  await page.reload();
  await page.getByRole('heading', { name: 'Demo scenarios', level: 1, exact: true }).waitFor();
  result = await exported();
  assert.equal(result.id, beforeImport.id);
  const copyCard = page
    .locator('.form-grid > .panel')
    .filter({ has: page.getByRole('heading', { name: 'Browser QA scenario · copy', exact: true }) });
  await copyCard.getByRole('button', { name: 'Load scenario', exact: true }).click();
  await saved();
  result = await exported();
  assert.equal(result.id, duplicate.id);
  assert.equal(result.settings.agencyName, 'Isolated copy studio');
  // Valid restore creates a new independent ID and preserves data/preferences.
  await open('import-export', 'Import / Export');
  await page.locator('input[type=file]').setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(beforeImport)),
  });
  await page.getByRole('status').filter({ hasText: 'Backup validated and imported' }).waitFor();
  await saved();
  result = await exported();
  assert.notEqual(result.id, beforeImport.id);
  assert.deepEqual(result.transactions, beforeImport.transactions);
  assert.deepEqual(result.employees, beforeImport.employees);
  assert.deepEqual(result.settings, beforeImport.settings);
  assert.deepEqual(errors, [], 'No unhandled browser errors are permitted.');
  console.log(
    'PASS: Studio spreadsheet edits, undo/redo, invalid-cell rejection, reload persistence, invalid/valid import, full JSON export, independent scenarios, light theme and currency. Zero page errors.',
  );
} finally {
  await browser.close();
}
