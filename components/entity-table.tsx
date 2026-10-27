'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { download } from '@/lib/utils';
export type EntityRow = { id: string; [key: string]: unknown };
export interface EntityField {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'time' | 'color' | 'textarea' | 'select' | 'tags' | 'image';
  required?: boolean;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  defaultValue?: unknown;
}
export interface EntityColumn {
  key: string;
  label: string;
  render?: (row: EntityRow) => React.ReactNode;
  sortValue?: (row: EntityRow) => string | number;
}
export function EntityTable({
  title,
  subtitle,
  rows,
  columns,
  fields,
  editable,
  onSave,
  onDelete,
  validate,
  extra,
}: {
  title: string;
  subtitle?: string;
  rows: EntityRow[];
  columns: EntityColumn[];
  fields: EntityField[];
  editable: boolean;
  onSave: (row: EntityRow) => void;
  onDelete: (id: string) => void;
  validate?: (row: EntityRow) => string | null;
  extra?: React.ReactNode;
}) {
  const modalRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState(''),
    [sort, setSort] = useState({ key: '', direction: 1 }),
    [page, setPage] = useState(0),
    [draft, setDraft] = useState<EntityRow | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (!draft) return;
    const previous = document.activeElement as HTMLElement;
    modalRef.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDraft(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)',
        ) ?? [],
      );
      if (!nodes.length) return;
      if (e.shiftKey && document.activeElement === nodes[0]) {
        e.preventDefault();
        nodes[nodes.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
        e.preventDefault();
        nodes[0].focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [draft?.id]);
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const result = rows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(q)),
    );
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      result.sort((a, b) => {
        const av = col?.sortValue?.(a) ?? a[sort.key] ?? '',
          bv = col?.sortValue?.(b) ?? b[sort.key] ?? '';
        return (
          (typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av).localeCompare(String(bv))) * sort.direction
        );
      });
    }
    return result;
  }, [rows, query, sort, columns]);
  const pages = Math.max(1, Math.ceil(filtered.length / 15)),
    safePage = Math.min(page, pages - 1);
  function open(row?: EntityRow) {
    setError('');
    setDraft(
      row
        ? structuredClone(row)
        : {
            id: crypto.randomUUID(),
            ...Object.fromEntries(
              fields.map((f) => [
                f.key,
                f.defaultValue ??
                  (f.type === 'number'
                    ? 0
                    : f.type === 'tags'
                      ? []
                      : f.type === 'select'
                        ? (f.options?.[0]?.value ?? '')
                        : f.type === 'date'
                          ? new Date().toISOString().slice(0, 10)
                          : f.type === 'color'
                            ? '#8b5cf6'
                            : ''),
              ]),
            ),
          },
    );
  }
  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const normalized = { ...draft };
    for (const f of fields) {
      const value = normalized[f.key];
      if (f.required && (value === undefined || value === null || String(value).trim() === '')) {
        setError(`${f.label} is required.`);
        return;
      }
      if (f.type === 'number') {
        const n = Number(value);
        if (!Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) {
          setError(`${f.label} must be between ${f.min ?? '−∞'} and ${f.max ?? '∞'}.`);
          return;
        }
        normalized[f.key] = n;
      }
    }
    const issue = validate?.(normalized);
    if (issue) {
      setError(issue);
      return;
    }
    try {
      onSave(normalized);
      setDraft(null);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'This record could not be saved.');
    }
  }
  function exportCsv() {
    const keys = fields.map((f) => f.key);
    const escape = (s: unknown) =>
      `"${String(Array.isArray(s) ? s.join(', ') : (s ?? '')).replaceAll('"', '""')}"`;
    download(
      `${title.toLowerCase().replaceAll(' ', '-')}.csv`,
      [keys.join(','), ...filtered.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n'),
      'text/csv',
    );
  }
  return (
    <>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <div className="crm-toolbar">
            <button className="button secondary small" onClick={exportCsv}>
              <Download size={15} /> Export CSV
            </button>
            {editable && (
              <button className="button primary small" onClick={() => open()}>
                <Plus size={15} /> Add record
              </button>
            )}
            {extra}
          </div>
        </div>
        <div className="crm-table-tools">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label={`Search ${title}`}
              placeholder={`Search ${title.toLowerCase()}…`}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
          <span className="muted">
            {filtered.length} records {!editable && ' · Enable Edit mode to make changes'}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>
                    <button
                      className="table-sort"
                      onClick={() =>
                        setSort((s) => ({ key: c.key, direction: s.key === c.key ? -s.direction : 1 }))
                      }
                    >
                      {c.label}
                      {sort.key === c.key ? (
                        sort.direction === 1 ? (
                          <ArrowUp size={12} />
                        ) : (
                          <ArrowDown size={12} />
                        )
                      ) : null}
                    </button>
                  </th>
                ))}
                {editable && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(safePage * 15, (safePage + 1) * 15).map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      tabIndex={0}
                      onClick={(e) => {
                        if (!(e.target as HTMLElement).closest('button,a,input,textarea,select')) open(row);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) open(row);
                      }}
                      title="Click to edit record"
                    >
                      {c.render ? c.render(row) : String(row[c.key] ?? '—')}
                    </td>
                  ))}
                  {editable && (
                    <td>
                      <div className="crm-actions">
                        <button
                          className="button icon small"
                          aria-label={`Edit ${String(row.name ?? row.title ?? row.id)}`}
                          onClick={() => open(row)}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          className="button icon small danger"
                          aria-label={`Delete ${String(row.name ?? row.title ?? row.id)}`}
                          onClick={() => {
                            if (
                              confirm(
                                'Delete this record? Related local records may also be removed to preserve data consistency.',
                              )
                            ) {
                              try {
                                onDelete(row.id);
                              } catch (issue) {
                                alert(
                                  issue instanceof Error ? issue.message : 'The record could not be deleted.',
                                );
                              }
                            }
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty-state">
              No records match. {editable ? 'Add a record to get started.' : 'Try another period or search.'}
            </div>
          )}
        </div>
        <div className="crm-pagination">
          <span className="muted">
            {filtered.length
              ? `${safePage * 15 + 1}–${Math.min((safePage + 1) * 15, filtered.length)} of ${filtered.length}`
              : '0 records'}
          </span>
          <div className="crm-actions">
            <button
              className="button icon small"
              disabled={safePage === 0}
              aria-label="Previous page"
              onClick={() => setPage(safePage - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Page {safePage + 1} of {pages}
            </span>
            <button
              className="button icon small"
              disabled={safePage >= pages - 1}
              aria-label="Next page"
              onClick={() => setPage(safePage + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      {draft && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDraft(null);
          }}
        >
          <section
            ref={modalRef}
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entity-editor-title"
          >
            <div className="modal-header">
              <h2 id="entity-editor-title">
                {rows.some((r) => r.id === draft.id) ? 'Edit' : 'Add'} {title.replace(/s$/, '').toLowerCase()}
              </h2>
              <button className="button icon" aria-label="Close editor" onClick={() => setDraft(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="form-grid">
                  {fields.map((f) => (
                    <label className={`field ${f.type === 'textarea' ? 'full-width' : ''}`} key={f.key}>
                      <span>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </span>
                      {f.type === 'image' ? (
                        <div className="image-field">
                          <input
                            className="input"
                            aria-label={f.label}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 4_000_000) {
                                setError('Choose a local image smaller than 4 MB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () =>
                                setDraft((current) =>
                                  current ? { ...current, [f.key]: String(reader.result) } : current,
                                );
                              reader.readAsDataURL(file);
                            }}
                          />
                          {draft[f.key] ? (
                            <div className="crm-actions">
                              <img src={String(draft[f.key])} alt="Profile preview" width={48} height={48} />
                              <button
                                className="button secondary small"
                                type="button"
                                onClick={() => setDraft({ ...draft, [f.key]: '' })}
                              >
                                Remove image
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : f.type === 'select' ? (
                        <select
                          className="select"
                          aria-label={f.label}
                          value={String(draft[f.key] ?? '')}
                          onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        >
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea
                          className="input"
                          aria-label={f.label}
                          rows={4}
                          value={String(draft[f.key] ?? '')}
                          onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                        />
                      ) : (
                        <input
                          className="input"
                          aria-label={f.label}
                          type={f.type === 'tags' ? 'text' : (f.type ?? 'text')}
                          required={f.required}
                          min={f.min}
                          max={f.max}
                          step={f.type === 'number' ? 'any' : undefined}
                          value={
                            f.type === 'tags'
                              ? Array.isArray(draft[f.key])
                                ? (draft[f.key] as string[]).join(', ')
                                : String(draft[f.key] ?? '')
                              : String(draft[f.key] ?? '')
                          }
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              [f.key]:
                                f.type === 'tags'
                                  ? e.target.value
                                      .split(',')
                                      .map((x) => x.trim())
                                      .filter(Boolean)
                                  : e.target.value,
                            })
                          }
                        />
                      )}
                    </label>
                  ))}
                </div>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="button secondary" onClick={() => setDraft(null)}>
                  Cancel
                </button>
                <button className="button primary" type="submit">
                  Save changes
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
