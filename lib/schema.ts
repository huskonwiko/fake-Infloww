import { z } from 'zod';
import type { Scenario } from './types';
const id = z.string().min(1).max(150);
const text = z.string().max(10000);
const name = z.string().trim().min(1).max(200);
const number = z.number().finite().nonnegative();
const count = number.int();
const date = z
  .string()
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
    'Use a valid YYYY-MM-DD date.',
  );
const timestamp = z
  .string()
  .refine(
    (value) =>
      /^(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      date.safeParse(value.slice(0, 10)).success,
    'Use a valid date or timestamp.',
  );
const image = z
  .string()
  .max(8_000_000)
  .refine(
    (value) => value === '' || /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/.test(value),
    'Images must be local PNG, JPEG, WebP or GIF data.',
  );
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');
const creator = z.object({ id, name, handle: name, avatar: image, color, addedAt: date });
const employee = z.object({
  id,
  name,
  role: name,
  color,
  hoursWorked: number,
  messagesSent: count,
  conversionRate: number.max(100),
});
const fan = z.object({
  id,
  creatorId: id,
  name,
  username: name,
  avatar: image,
  joinedAt: date,
  status: z.enum(['paid', 'free', 'expired', 'renewed']),
  tags: z.array(name).max(100),
  notes: text,
  unread: count,
});
const transaction = z.object({
  id,
  creatorId: id,
  fanId: id,
  employeeId: id,
  date: timestamp,
  category: z.enum(['subscription', 'message', 'tip', 'ppv']),
  amount: number,
});
const message = z.object({
  id,
  fanId: id,
  direction: z.enum(['in', 'out']),
  text,
  date: timestamp,
  ppvAmount: number,
  image,
  saleId: id.optional(),
});
const campaign = z.object({
  id,
  creatorId: id,
  name,
  status: z.enum(['active', 'paused', 'completed']),
  budget: number,
  clicks: count,
  conversions: count,
});
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const shift = z
  .object({ id, employeeId: id, date, start: clock, end: clock })
  .refine((s) => s.start < s.end, 'Shift end must follow its start.');
const chart = z
  .object({
    title: name,
    type: z.enum(['area', 'line', 'bar']),
    series: z
      .array(z.object({ id, label: name, color }))
      .min(1)
      .max(20),
    points: z.array(z.object({ id, date, values: z.record(z.string(), number) })).max(10000),
    manual: z.boolean(),
    yMin: number.nullable(),
    yMax: number.nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.yMin !== null && value.yMax !== null && value.yMin >= value.yMax)
      ctx.addIssue({ code: 'custom', message: 'Maximum axis value must exceed minimum.' });
    const seriesIds = new Set(value.series.map((s) => s.id));
    if (seriesIds.size !== value.series.length)
      ctx.addIssue({ code: 'custom', message: 'Chart series IDs must be unique.' });
    if (new Set(value.points.map((p) => p.id)).size !== value.points.length)
      ctx.addIssue({ code: 'custom', message: 'Chart point IDs must be unique.' });
    for (const point of value.points) {
      if (Object.keys(point.values).some((key) => !seriesIds.has(key)))
        ctx.addIssue({ code: 'custom', message: 'Chart values reference an unknown series.' });
      if (value.series.some((series) => typeof point.values[series.id] !== 'number'))
        ctx.addIssue({ code: 'custom', message: 'Each chart point needs a value for every series.' });
    }
  });
export const scenarioSchema = z
  .object({
    version: z.literal(1),
    id,
    name,
    creators: z.array(creator).min(1).max(1000),
    employees: z.array(employee).min(1).max(10000),
    fans: z.array(fan).max(100000),
    transactions: z.array(transaction).max(1000000),
    messages: z.array(message).max(100000),
    campaigns: z.array(campaign).max(10000),
    shifts: z.array(shift).max(100000),
    scripts: z.array(z.object({ id, title: name, content: text })).max(10000),
    smartLists: z.array(z.object({ id, name, tag: name })).max(10000),
    links: z
      .array(
        z.object({
          id,
          campaignId: id,
          label: name,
          url: z
            .string()
            .url()
            .refine((value) => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS URL.'),
          clicks: count,
        }),
      )
      .max(10000),
    charts: z.record(z.string(), chart),
    overrides: z.record(
      z.string(),
      z.object({ value: z.number().finite(), change: z.number().finite(), color }),
    ),
    widgetOrder: z.array(id).max(100),
    settings: z.object({
      agencyName: name,
      currency: z.enum(['USD', 'EUR', 'GBP', 'CAD', 'AUD']),
      theme: z.enum(['dark', 'light']),
    }),
  })
  .superRefine((scenario, ctx) => {
    for (const key of [
      'creators',
      'employees',
      'fans',
      'transactions',
      'messages',
      'campaigns',
      'shifts',
      'scripts',
      'smartLists',
      'links',
    ] as const) {
      const ids = scenario[key].map((item) => item.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: 'custom', path: [key], message: `Duplicate IDs in ${key}.` });
    }
    const creators = new Set(scenario.creators.map((c) => c.id)),
      employees = new Set(scenario.employees.map((e) => e.id)),
      fans = new Map(scenario.fans.map((f) => [f.id, f])),
      transactions = new Map(scenario.transactions.map((t) => [t.id, t])),
      campaigns = new Set(scenario.campaigns.map((c) => c.id));
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    scenario.fans.forEach((fan, i) => {
      if (!creators.has(fan.creatorId)) issue(['fans', i, 'creatorId'], 'Fan references an unknown creator.');
    });
    scenario.transactions.forEach((transaction, i) => {
      if (!creators.has(transaction.creatorId))
        issue(['transactions', i, 'creatorId'], 'Transaction references an unknown creator.');
      if (!employees.has(transaction.employeeId))
        issue(['transactions', i, 'employeeId'], 'Transaction references an unknown employee.');
      const fan = fans.get(transaction.fanId);
      if (!fan || fan.creatorId !== transaction.creatorId)
        issue(['transactions', i, 'fanId'], 'Transaction fan must belong to its creator.');
    });
    scenario.messages.forEach((message, i) => {
      if (!fans.has(message.fanId)) issue(['messages', i, 'fanId'], 'Message references an unknown fan.');
      if (message.saleId) {
        const sale = transactions.get(message.saleId);
        if (
          !sale ||
          sale.fanId !== message.fanId ||
          sale.category !== 'ppv' ||
          sale.amount !== message.ppvAmount
        )
          issue(['messages', i, 'saleId'], 'Message sale must reference a matching PPV transaction.');
      }
    });
    scenario.campaigns.forEach((campaign, i) => {
      if (!creators.has(campaign.creatorId))
        issue(['campaigns', i, 'creatorId'], 'Campaign references an unknown creator.');
    });
    scenario.shifts.forEach((shift, i) => {
      if (!employees.has(shift.employeeId))
        issue(['shifts', i, 'employeeId'], 'Shift references an unknown employee.');
    });
    scenario.links.forEach((link, i) => {
      if (!campaigns.has(link.campaignId))
        issue(['links', i, 'campaignId'], 'Tracking link references an unknown campaign.');
    });
    if (new Set(scenario.widgetOrder).size !== scenario.widgetOrder.length)
      issue(['widgetOrder'], 'Widget IDs must be unique.');
  });
export function parseScenario(source: string): Scenario {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  const result = scenarioSchema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new Error(`Invalid scenario at ${first.path.join('.') || 'root'}: ${first.message}`);
  }
  return result.data;
}
export function exportScenario(scenario: Scenario): string {
  return JSON.stringify(scenarioSchema.parse(scenario), null, 2);
}
