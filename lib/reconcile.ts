import type { Scenario, Category, Transaction } from './types';
export type RevenueMetric =
  'total' | 'subscriptions' | 'posts' | 'messages' | 'messageOnly' | 'tips' | 'referrals' | 'streams' | 'ppv';
export interface RevenueScope {
  creatorId?: string;
  creatorIds?: string[];
  employeeId?: string;
  from: string;
  to: string;
  net?: boolean;
}
const categories: Record<RevenueMetric, Category[]> = {
  total: ['subscription', 'post', 'message', 'ppv', 'tip', 'referral', 'stream'],
  subscriptions: ['subscription'],
  posts: ['post'],
  messages: ['message', 'ppv'],
  messageOnly: ['message'],
  tips: ['tip'],
  referrals: ['referral'],
  streams: ['stream'],
  ppv: ['ppv'],
};
const keys: RevenueMetric[] = ['subscriptions', 'posts', 'messages', 'tips', 'referrals', 'streams'];
const cent = (n: number) => Math.round((n + Number.EPSILON) * 100);
function matches(t: Transaction, s: RevenueScope) {
  const date = t.date.length === 10 ? t.date + 'T12:00:00.000Z' : t.date;
  const from = s.from.length === 10 ? s.from + 'T00:00:00.000Z' : s.from;
  const to = s.to.length === 10 ? s.to + 'T23:59:59.999Z' : s.to;
  return (
    (!s.creatorId || s.creatorId === 'all' || s.creatorId === t.creatorId) &&
    (!s.creatorIds || s.creatorIds.includes(t.creatorId)) &&
    (!s.employeeId || s.employeeId === 'all' || s.employeeId === t.employeeId) &&
    date >= from &&
    date <= to
  );
}
function grossCents(s: Scenario, scope: RevenueScope, m: RevenueMetric) {
  return s.transactions
    .filter((t) => matches(t, scope) && categories[m].includes(t.category))
    .reduce((n, t) => n + cent(t.amount), 0);
}
function allocate(total: number, weights: number[]) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  const raw = weights.map((n) => (sum ? (total * n) / sum : total / weights.length));
  const out = raw.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((n, i) => ({ i, r: n - out[i] })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let i = 0; i < left; i++) out[order[i % order.length].i]++;
  return out;
}
export function revenueAmount(s: Scenario, scope: RevenueScope, m: RevenueMetric): number {
  const total = grossCents(s, scope, 'total');
  if (!scope.net) return grossCents(s, scope, m) / 100;
  if (m === 'total') return Math.round(total * 0.8) / 100;
  const weights = keys.map((k) => grossCents(s, scope, k));
  const parts = allocate(Math.round(total * 0.8), weights);
  if (m === 'messageOnly' || m === 'ppv') {
    const sub = allocate(parts[2], [grossCents(s, scope, 'messageOnly'), grossCents(s, scope, 'ppv')]);
    return sub[m === 'ppv' ? 1 : 0] / 100;
  }
  return parts[keys.indexOf(m)] / 100;
}
export function reconcileRevenue(d: Scenario, scope: RevenueScope, m: RevenueMetric, target: number) {
  if (!Number.isFinite(target) || target < 0) throw new Error('Enter a finite amount of zero or more.');
  if (
    !Number.isFinite(Date.parse(scope.from)) ||
    !Number.isFinite(Date.parse(scope.to)) ||
    scope.from > scope.to
  )
    throw new Error('Choose a valid date range.');
  if (scope.creatorIds?.length === 0) throw new Error('No creators match the selected tags.');
  if (scope.creatorId && scope.creatorId !== 'all' && !d.creators.some((c) => c.id === scope.creatorId))
    throw new Error('Unknown creator.');
  if (scope.employeeId && scope.employeeId !== 'all' && !d.employees.some((c) => c.id === scope.employeeId))
    throw new Error('Unknown employee.');
  const rows = d.transactions.filter((t) => matches(t, scope) && categories[m].includes(t.category));
  const goal = cent(target / (scope.net ? 0.8 : 1));
  if (rows.length) {
    const amounts = allocate(
      goal,
      rows.map((t) => cent(t.amount)),
    );
    rows.forEach((t, i) => {
      t.amount = amounts[i] / 100;
      for (const msg of d.messages) if (msg.saleId === t.id) msg.ppvAmount = t.amount;
    });
  } else if (goal) {
    const creatorId =
      scope.creatorId && scope.creatorId !== 'all'
        ? scope.creatorId
        : (scope.creatorIds?.[0] ?? d.creators[0]?.id);
    const employeeId = scope.employeeId && scope.employeeId !== 'all' ? scope.employeeId : d.employees[0]?.id;
    if (!creatorId || !employeeId) throw new Error('Create a creator and an employee first.');
    let fan = d.fans.find((f) => f.creatorId === creatorId);
    if (!fan) {
      fan = {
        id: crypto.randomUUID(),
        creatorId,
        name: 'Studio fan',
        username: '@studio_fan',
        avatar: '',
        joinedAt: scope.from.slice(0, 10),
        status: 'paid',
        tags: [],
        notes: 'Fictional adjustment',
        unread: 0,
      };
      d.fans.push(fan);
    }
    d.transactions.push({
      id: crypto.randomUUID(),
      creatorId,
      employeeId,
      fanId: fan.id,
      date: scope.from.length === 10 ? scope.from + 'T12:00:00.000Z' : scope.from,
      category: m === 'total' ? 'message' : categories[m][0],
      amount: goal / 100,
    });
  }
  // Financial overrides represented separate numbers in older versions. Linked edits retire them.
  for (const key of Object.keys(d.overrides))
    if (/:(total|gross|net|subscriptions|messages|tips|ppv|arpu|daily|weekly|monthly|growth)$/.test(key))
      delete d.overrides[key];
}
export function revenueSeries(s: Scenario, scope: RevenueScope, grain: 'hour' | 'day' | 'week' | 'month') {
  const from = new Date(scope.from.length === 10 ? scope.from + 'T00:00:00.000Z' : scope.from),
    to = new Date(scope.to.length === 10 ? scope.to + 'T23:59:59.999Z' : scope.to);
  const buckets: {
    date: string;
    from: string;
    to: string;
    total: number;
    subscriptions: number;
    posts: number;
    messages: number;
    tips: number;
    referrals: number;
    streams: number;
  }[] = [];
  if ((+to - +from) / 86400000 > 3660) throw new Error('Choose a period shorter than ten years.');
  for (let cursor = +from; cursor <= +to;) {
    const start = new Date(cursor);
    let end: number;
    if (grain === 'hour') end = cursor + 3600000 - 1;
    else if (grain === 'week') end = cursor + 7 * 86400000 - 1;
    else if (grain === 'month') end = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1;
    else end = cursor + 86400000 - 1;
    end = Math.min(end, +to);
    const b = { ...scope, from: new Date(cursor).toISOString(), to: new Date(end).toISOString() };
    const values = Object.fromEntries(keys.map((k) => [k, revenueAmount(s, b, k)]));
    buckets.push({
      date: grain === 'hour' ? b.from : b.from.slice(0, 10),
      from: b.from,
      to: b.to,
      total: revenueAmount(s, b, 'total'),
      ...values,
    } as (typeof buckets)[number]);
    cursor = end + 1;
    if (buckets.length > 10000) break;
  }
  // Apportion net rounding across time buckets so chart total agrees with the summary.
  if (scope.net) {
    const amounts = allocate(
      cent(revenueAmount(s, scope, 'total')),
      buckets.map((b) => grossCents(s, { ...scope, from: b.from, to: b.to }, 'total')),
    );
    buckets.forEach((b, i) => {
      b.total = amounts[i] / 100;
      const parts = allocate(
        amounts[i],
        keys.map((k) => grossCents(s, { ...scope, from: b.from, to: b.to }, k)),
      );
      keys.forEach((k, j) => {
        (b as unknown as Record<string, unknown>)[k] = parts[j] / 100;
      });
    });
  }
  return buckets;
}
