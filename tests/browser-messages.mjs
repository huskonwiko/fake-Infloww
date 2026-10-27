/** End-to-end local messaging checks. Requires a running server (BASE_URL defaults to :3000).
 * Run: node tests/browser-messages.mjs
 * Uses an isolated browser context; never modifies another browser's scenarios.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
}
const base = process.env.CRM_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
const chromiumPath =
  process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: chromiumPath,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({ viewport: { width: 1580, height: 1050 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const snapshot = () =>
  page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('velvet-crm-studio');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const req = db.transaction('workspace', 'readonly').objectStore('workspace').get('current');
        req.onsuccess = () => {
          const value = req.result?.value;
          resolve(value?.scenarios.find((item) => item.id === value.activeId));
        };
        req.onerror = () => reject(req.error);
      });
    } finally {
      db.close();
    }
  });
async function waitSaved(predicate, message) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const data = await snapshot();
    if (data && predicate(data)) return data;
    await page.waitForTimeout(100);
  }
  throw new Error(message);
}
const cash = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
const round = (value) => Math.round(value * 100) / 100;
try {
  await page.goto(`${base}/#messages`, { waitUntil: 'networkidle' });
  await page.locator('.messages-workspace').waitFor();
  const edit = page.getByRole('button', { name: 'EDIT MODE', exact: true });
  if ((await edit.getAttribute('aria-pressed')) !== 'true') await edit.click();
  assert.equal(await edit.getAttribute('aria-pressed'), 'true', 'Edit mode must be enabled');
  await page.locator('.messages-fan').first().click();
  const name = await page.locator('.messages-profile h3').textContent();
  const before = await snapshot();
  const fan = before.fans.find((item) => item.name === name);
  assert.ok(fan, 'Selected conversation must reference a persisted fan');
  const originalCount = before.transactions.length;
  const originalMessages = before.messages.length;
  const originalSpent = before.transactions
    .filter((item) => item.fanId === fan.id)
    .reduce((sum, item) => sum + item.amount, 0);
  const marker = `Browser smoke PPV ${Date.now()}`;
  await page.getByRole('textbox', { name: 'Message text', exact: true }).fill(marker);
  await page.getByRole('button', { name: 'Add simulated PPV sale', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'PPV amount', exact: true }).fill('42.35');
  await page.getByRole('button', { name: 'Save message', exact: true }).click();
  await page.locator('.messages-thread').getByText(marker, { exact: true }).waitFor();
  const created = await waitSaved(
    (data) => data.messages.some((item) => item.text === marker),
    'Created message was not saved to IndexedDB',
  );
  const message = created.messages.find((item) => item.text === marker);
  assert.equal(created.messages.length, originalMessages + 1);
  assert.equal(created.transactions.length, originalCount + 1);
  assert.equal(message.ppvAmount, 42.35);
  assert.ok(message.saleId, 'PPV message must link a transaction');
  const sale = created.transactions.find((item) => item.id === message.saleId);
  assert.equal(sale?.amount, 42.35);
  assert.equal(sale?.fanId, fan.id);
  assert.equal(sale?.creatorId, fan.creatorId);
  assert.equal(sale?.category, 'ppv');
  assert.equal(
    await page.locator('.messages-spent strong').textContent(),
    cash(round(originalSpent + 42.35), before.settings.currency),
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.messages-thread').getByText(marker, { exact: true }).waitFor();
  assert.ok(
    (await snapshot()).messages.find((item) => item.id === message.id),
    'Message must survive reload',
  );
  const editAfterReload = page.getByRole('button', { name: 'EDIT MODE', exact: true });
  if ((await editAfterReload.getAttribute('aria-pressed')) !== 'true') await editAfterReload.click();
  await page.getByRole('button', { name: `Edit message ${message.id}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit local message', exact: true });
  await dialog.locator('input[name="amount"]').fill('73.45');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  const updated = await waitSaved(
    (data) => data.messages.find((item) => item.id === message.id)?.ppvAmount === 73.45,
    'Message amount edit was not persisted',
  );
  assert.equal(
    updated.transactions.length,
    originalCount + 1,
    'Editing a PPV sale must not duplicate transactions',
  );
  assert.equal(updated.transactions.find((item) => item.id === message.saleId)?.amount, 73.45);
  assert.equal(
    await page.locator('.messages-spent strong').textContent(),
    cash(round(originalSpent + 73.45), before.settings.currency),
  );
  await page.getByRole('button', { name: `Delete message ${message.id}`, exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Delete this message?', exact: true })
    .getByRole('button', { name: 'Delete message', exact: true })
    .click();
  const deleted = await waitSaved(
    (data) => !data.messages.some((item) => item.id === message.id),
    'Message deletion was not persisted',
  );
  assert.equal(deleted.transactions.length, originalCount);
  assert.equal(deleted.messages.length, originalMessages);
  assert.equal(
    deleted.transactions.some((item) => item.id === message.saleId),
    false,
  );
  assert.equal(
    await page.locator('.messages-spent strong').textContent(),
    cash(round(originalSpent), before.settings.currency),
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.messages-workspace').waitFor();
  const restored = await snapshot();
  assert.equal(restored.transactions.length, originalCount);
  assert.equal(restored.messages.length, originalMessages);
  assert.equal(
    restored.messages.some((item) => item.id === message.id),
    false,
  );
  assert.deepEqual(errors, [], 'Browser must not emit application errors');
  await page.screenshot({ path: '/tmp/velvet-messages.png', fullPage: true });
  console.log(
    'PASS: edit mode, local PPV message, linked transaction, fan totals, reload persistence, amount edit and cascading deletion.',
  );
} catch (error) {
  await page.screenshot({ path: '/tmp/velvet-messages-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
