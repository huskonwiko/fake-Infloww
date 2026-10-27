import type { Period, Scenario, Transaction } from './types';
type Range = { from: string; to: string };
const iso = (date: Date) => date.toISOString().slice(0, 10);
const day = 86_400_000;
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Inclusive UTC calendar boundaries; timestamps throughout the ending day are included. */
export function periodRange(period: Period, customRange?: Range, now = new Date()): Range {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'Custom Date' && customRange) {
    const validDate = (value: string) =>
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
      iso(new Date(`${value}T00:00:00Z`)) === value;
    if (!validDate(customRange.from) || !validDate(customRange.to) || customRange.from > customRange.to)
      throw new Error('Choose a valid date range.');
    if ((+new Date(customRange.to) - +new Date(customRange.from)) / day > 3660)
      throw new Error('Date range cannot exceed ten years.');
    return customRange;
  }
  if (period === 'Yesterday') {
    const yesterday = new Date(+today - day);
    return { from: iso(yesterday), to: iso(yesterday) };
  }
  if (period === 'Last 7 days') return { from: iso(new Date(+today - 6 * day)), to: iso(today) };
  if (period === 'Last 30 days') return { from: iso(new Date(+today - 29 * day)), to: iso(today) };
  if (period === 'This Month')
    return { from: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))), to: iso(today) };
  if (period === 'Last Month')
    return {
      from: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))),
      to: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))),
    };
  return { from: iso(today), to: iso(today) };
}
export function filteredTransactions(
  scenario: Scenario,
  creatorId = 'all',
  period: Period = 'Last 30 days',
  customRange?: Range,
): Transaction[] {
  const { from, to } = periodRange(period, customRange);
  return scenario.transactions.filter(
    (t) =>
      (creatorId === 'all' || t.creatorId === creatorId) &&
      t.date.slice(0, 10) >= from &&
      t.date.slice(0, 10) <= to,
  );
}
export function calculateRevenue(transactions: Transaction[]) {
  const sum = (category?: Transaction['category']) =>
    cents(transactions.filter((t) => !category || t.category === category).reduce((a, t) => a + t.amount, 0));
  const gross = sum();
  return {
    total: gross,
    gross,
    net: cents(gross * 0.8),
    subscriptions: sum('subscription'),
    messages: sum('message'),
    tips: sum('tip'),
    ppv: sum('ppv'),
  };
}
export function chartData(
  scenario: Scenario,
  creatorId = 'all',
  period: Period = 'Last 30 days',
  customRange?: Range,
) {
  const { from, to } = periodRange(period, customRange);
  const groups = new Map<string, Transaction[]>();
  for (const transaction of filteredTransactions(scenario, creatorId, period, customRange)) {
    const date = transaction.date.slice(0, 10);
    groups.set(date, [...(groups.get(date) ?? []), transaction]);
  }
  const points: {
    date: string;
    revenue: number;
    subscriptions: number;
    messages: number;
    tips: number;
    ppv: number;
  }[] = [];
  const start = new Date(`${from}T00:00:00Z`),
    end = new Date(`${to}T00:00:00Z`);
  if ((+end - +start) / day > 3660) throw new Error('Date range cannot exceed ten years.');
  for (let d = +start; d <= +end; d += day) {
    const date = iso(new Date(d)),
      revenue = calculateRevenue(groups.get(date) ?? []);
    points.push({
      date,
      revenue: revenue.total,
      subscriptions: revenue.subscriptions,
      messages: revenue.messages,
      tips: revenue.tips,
      ppv: revenue.ppv,
    });
  }
  return points;
}
export function calculateMetrics(
  scenario: Scenario,
  creatorId = 'all',
  period: Period = 'Last 30 days',
  customRange?: Range,
): Record<string, number> {
  const { from, to } = periodRange(period, customRange);
  const selected = filteredTransactions(scenario, creatorId, period, customRange),
    revenue = calculateRevenue(selected);
  const fans = scenario.fans.filter((f) => creatorId === 'all' || f.creatorId === creatorId);
  const paid = fans.filter((f) => f.status === 'paid' || f.status === 'renewed').length;
  const expired = fans.filter((f) => f.status === 'expired').length,
    renewed = fans.filter((f) => f.status === 'renewed').length;
  const elapsed = Math.max(1, Math.round((+new Date(to) - +new Date(from)) / day) + 1);
  const previousFrom = iso(new Date(+new Date(`${from}T00:00:00Z`) - elapsed * day));
  const previousTo = iso(new Date(+new Date(`${from}T00:00:00Z`) - day));
  const previous = calculateRevenue(
    scenario.transactions.filter(
      (t) =>
        (creatorId === 'all' || t.creatorId === creatorId) &&
        t.date.slice(0, 10) >= previousFrom &&
        t.date.slice(0, 10) <= previousTo,
    ),
  ).total;
  const buyers = new Set(selected.map((t) => t.fanId)).size;
  return {
    ...revenue,
    arpu: fans.length ? revenue.total / fans.length : 0,
    subscribers: paid,
    newSubscribers: fans.filter(
      (f) =>
        (f.status === 'paid' || f.status === 'renewed') &&
        f.joinedAt.slice(0, 10) >= from &&
        f.joinedAt.slice(0, 10) <= to,
    ).length,
    expired,
    renewed,
    renewalRate: renewed + expired ? (renewed / (renewed + expired)) * 100 : 0,
    freeFans: fans.filter((f) => f.status === 'free').length,
    paidFans: paid,
    conversionRate: fans.length ? (buyers / fans.length) * 100 : 0,
    averageOrderValue: selected.length ? revenue.total / selected.length : 0,
    growth: previous ? ((revenue.total - previous) / previous) * 100 : 0,
    daily: revenue.total / elapsed,
    weekly: (revenue.total / elapsed) * 7,
    monthly: (revenue.total / elapsed) * 30,
  };
}

/** Current-status fields have no historical event log; never invent their evolution. */
export const snapshotMetricKeys = new Set([
  'subscribers',
  'expired',
  'renewed',
  'renewalRate',
  'freeFans',
  'paidFans',
]);
/**
 * Per-metric percentage change against the immediately preceding equal-length period.
 * NaN means no nonzero comparison baseline; the UI must label that as unavailable.
 * ARPU and conversion use the same current audience snapshot in both periods.
 */
export function calculateMetricChanges(
  scenario: Scenario,
  creatorId = 'all',
  period: Period = 'Last 30 days',
  customRange?: Range,
): Record<string, number> {
  const { from, to } = periodRange(period, customRange);
  const elapsed = Math.max(1, Math.round((+new Date(to) - +new Date(from)) / day) + 1);
  const previousRange = {
    from: iso(new Date(+new Date(`${from}T00:00:00Z`) - elapsed * day)),
    to: iso(new Date(+new Date(`${from}T00:00:00Z`) - day)),
  };
  const current = calculateMetrics(scenario, creatorId, 'Custom Date', { from, to });
  const previous = calculateMetrics(scenario, creatorId, 'Custom Date', previousRange);
  return Object.fromEntries(
    Object.keys(current).map((key) => {
      if (snapshotMetricKeys.has(key)) return [key, 0];
      const baseline = previous[key],
        value = current[key];
      return [
        key,
        baseline === 0 ? (value === 0 ? 0 : Number.NaN) : ((value - baseline) / Math.abs(baseline)) * 100,
      ];
    }),
  );
}
