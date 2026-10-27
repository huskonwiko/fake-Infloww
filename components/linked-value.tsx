'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Info } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { money } from '@/lib/utils';
import { reconcileRevenue, revenueAmount, type RevenueMetric, type RevenueScope } from '@/lib/reconcile';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

export function previousRevenueScope(scope: RevenueScope): RevenueScope {
  const start = new Date(`${scope.from.slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${scope.to.slice(0, 10)}T00:00:00Z`).getTime();
  const days = Math.round((end - start) / 86400000) + 1;
  return {
    ...scope,
    from: new Date(start - days * 86400000).toISOString().slice(0, 10),
    to: new Date(start - 86400000).toISOString().slice(0, 10),
  };
}
export function LinkedValue({
  metric,
  scope,
  label,
  className = '',
  small = false,
}: {
  metric: RevenueMetric;
  scope: RevenueScope;
  label: string;
  className?: string;
  small?: boolean;
}) {
  const { scenario, updateScenario } = useStudio();
  const value = revenueAmount(scenario, scope, metric);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const disabled = scope.creatorIds?.length === 0;
  return (
    <>
      <button
        type="button"
        className={`ref-editable-value ${small ? 'is-small' : ''} ${className}`}
        data-testid={`linked-value-${metric}`}
        aria-label={`Edit ${label}`}
        disabled={disabled}
        title={`Click to edit ${label}`}
        onClick={() => {
          setDraft(value.toFixed(2));
          setError('');
          setOpen(true);
        }}
      >
        {money(value, scenario.settings.currency)}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const amount = Number(draft);
                if (draft.trim() === '' || !Number.isFinite(amount) || amount < 0)
                  throw new Error('Enter an amount of zero or more.');
                updateScenario((d) => reconcileRevenue(d, scope, metric, amount));
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not update the amount.');
              }
            }}
          >
            <div className="modal-header">
              <DialogTitle>Edit {label}</DialogTitle>
              <DialogDescription>
                {scope.from.slice(0, 10)} — {scope.to.slice(0, 10)} · {scope.net ? 'Net' : 'Gross'} earnings
              </DialogDescription>
            </div>
            <div className="modal-body">
              <label className="field">
                Amount ({scenario.settings.currency})
                <input
                  autoFocus
                  aria-label="Amount"
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <p className="ref-edit-explanation">
                <Info size={16} /> This changes the matching simulated transactions. Charts, totals, fan
                spending and reports update together. Existing proportions are preserved.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function LinkedChange({
  metric,
  scope,
  label,
}: {
  metric: RevenueMetric;
  scope: RevenueScope;
  label: string;
}) {
  const { scenario, updateScenario } = useStudio();
  const current = revenueAmount(scenario, scope, metric),
    previous = revenueAmount(scenario, previousRevenueScope(scope), metric);
  const change = previous ? ((current - previous) / previous) * 100 : current === 0 ? 0 : null;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  return (
    <>
      <button
        className={`ref-evolution ${change !== null && change < 0 ? 'negative' : change !== null && change > 0 ? 'positive' : ''}`}
        aria-label={`Edit ${label} evolution`}
        onClick={() => {
          setDraft(change?.toFixed(2) ?? '0');
          setError('');
          setOpen(true);
        }}
        title="Click to change evolution by adjusting this period's transactions"
      >
        {change !== null && change < 0 ? (
          <ArrowDownLeft size={19} />
        ) : change !== null && change > 0 ? (
          <ArrowUpRight size={19} />
        ) : null}
        {change === null ? '—' : `${Math.abs(change).toFixed(2)}%`}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const n = Number(draft);
                if (!Number.isFinite(n) || draft.trim() === '' || n < -100)
                  throw new Error('Enter a percentage of −100 or more.');
                if (previous === 0)
                  throw new Error(
                    'Add revenue to the previous period first so a percentage can be calculated.',
                  );
                updateScenario((d) => reconcileRevenue(d, scope, metric, previous * (1 + n / 100)));
                setOpen(false);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not apply evolution.');
              }
            }}
          >
            <div className="modal-header">
              <DialogTitle>Edit {label} evolution</DialogTitle>
              <DialogDescription>Compared with the previous equal-length period.</DialogDescription>
            </div>
            <div className="modal-body">
              <label className="field">
                Evolution (%)
                <input
                  aria-label="Evolution (%)"
                  type="number"
                  step="0.01"
                  min="-100"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
              </label>
              <p className="ref-edit-explanation">
                The current period’s sales will be adjusted to match this evolution. The comparison period
                stays unchanged.
              </p>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
