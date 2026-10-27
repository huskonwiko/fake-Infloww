'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  DollarSign,
  FileText,
  ImagePlus,
  LockKeyhole,
  MessageCircle,
  Pencil,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useStudio } from '@/lib/store';
import type { Fan, Message } from '@/lib/types';
import { initials, money, uid } from '@/lib/utils';

const stamp = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? 'Unknown date'
    : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};
const shortDate = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? 'Unknown date'
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const localDateTime = (date: string) => {
  const d = new Date(date);
  return Number.isNaN(d.getTime())
    ? ''
    : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const safeImage = (src: string) => src.startsWith('data:image/') && !src.startsWith('data:image/svg');

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    return () => {
      if (node?.open) node.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal messages-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-header">
        <div>
          <span className="messages-eyebrow">LOCAL STUDIO</span>
          <h2>{title}</h2>
        </div>
        <button className="button icon" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
      <style jsx>{`
        dialog {
          position: fixed;
          margin: auto;
          max-height: 90dvh;
          overflow: auto;
          border: 1px solid var(--border, #34323f);
          border-radius: 14px;
          max-width: min(580px, calc(100vw - 32px));
          width: 100%;
          background: var(--panel, #191a23);
          color: var(--text, #edebf5);
          padding: 0;
          box-shadow: 0 30px 100px #0008;
        }
        dialog::backdrop {
          background: #05060bc4;
          backdrop-filter: blur(5px);
        }
        h2 {
          font-size: 19px;
          margin: 6px 0 0;
        }
        .messages-eyebrow {
          font-size: 10px;
          letter-spacing: 1.8px;
          color: var(--accent, #a5a0ff);
        }
      `}</style>
    </dialog>
  );
}

export function MessagesPage() {
  const { scenario, selectedCreator, editMode, updateScenario } = useStudio();
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [draft, setDraft] = useState('');
  const [ppv, setPpv] = useState('');
  const [showPrice, setShowPrice] = useState(false);
  const [attachment, setAttachment] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newConversation, setNewConversation] = useState(false);
  const [newMode, setNewMode] = useState('existing');
  const [newFanId, setNewFanId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCreator, setNewCreator] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingFan, setEditingFan] = useState<Fan | null>(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [mobileConversation, setMobileConversation] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Message | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const fans = useMemo(
    () => scenario.fans.filter((f) => selectedCreator === 'all' || f.creatorId === selectedCreator),
    [scenario.fans, selectedCreator],
  );
  const lastMessage = useMemo(() => {
    const map = new Map<string, Message>();
    for (const m of scenario.messages) {
      const last = map.get(m.fanId);
      if (!last || m.date > last.date) map.set(m.fanId, m);
    }
    return map;
  }, [scenario.messages]);
  const visibleFans = useMemo(
    () =>
      fans
        .filter(
          (f) =>
            (!search ||
              `${f.name} ${f.username} ${f.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase())) &&
            (filter !== 'unread' || f.unread > 0) &&
            (filter !== 'vip' || f.tags.some((t) => t.toLowerCase() === 'vip')),
        )
        .sort((a, b) => (lastMessage.get(b.id)?.date ?? '').localeCompare(lastMessage.get(a.id)?.date ?? '')),
    [fans, search, filter, lastMessage],
  );
  const fan = fans.find((f) => f.id === selectedId) ?? visibleFans[0] ?? fans[0];
  const creator = scenario.creators.find((c) => c.id === fan?.creatorId);
  const messages = useMemo(
    () => scenario.messages.filter((m) => m.fanId === fan?.id).sort((a, b) => a.date.localeCompare(b.date)),
    [scenario.messages, fan?.id],
  );
  const purchases = useMemo(
    () =>
      scenario.transactions.filter((t) => t.fanId === fan?.id).sort((a, b) => b.date.localeCompare(a.date)),
    [scenario.transactions, fan?.id],
  );
  const spent = purchases.reduce((sum, t) => sum + t.amount, 0);
  const unread = fans.reduce((sum, f) => sum + f.unread, 0);
  const currency = scenario.settings.currency;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length, fan?.id]);
  useEffect(() => {
    setDraft('');
    setAttachment('');
    setPpv('');
    setError('');
  }, [fan?.id]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 4500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const selectFan = (id: string) => {
    setSelectedId(id);
    setMobileConversation(true);
    updateScenario((s) => {
      const f = s.fans.find((f) => f.id === id);
      if (f) f.unread = 0;
    });
  };
  const uploadImage = (file: File | undefined, done: (image: string) => void) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Choose a PNG, JPEG, WebP or GIF image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Please choose an image smaller than 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      done(String(reader.result));
      setError('');
    };
    reader.readAsDataURL(file);
  };
  const sendMessage = (event: FormEvent) => {
    event.preventDefault();
    if (!fan) return;
    const amount = showPrice ? Number(ppv || 0) : 0;
    if (!Number.isFinite(amount) || amount < 0) {
      setError('Enter a valid positive PPV amount.');
      return;
    }
    if (!draft.trim() && !attachment && amount === 0) {
      setError('Add a message, image or PPV sale.');
      return;
    }
    const date = new Date().toISOString();
    const saleId = amount > 0 ? uid() : undefined;
    updateScenario((s) => {
      s.messages.push({
        id: uid(),
        fanId: fan.id,
        direction: 'out',
        text: draft.trim(),
        date,
        ppvAmount: amount,
        image: attachment,
        ...(saleId ? { saleId } : {}),
      });
      if (saleId)
        s.transactions.push({
          id: saleId,
          creatorId: fan.creatorId,
          fanId: fan.id,
          employeeId: s.employees[0]?.id ?? '',
          date,
          category: 'ppv',
          amount,
        });
      const f = s.fans.find((f) => f.id === fan.id);
      if (f) f.unread = 0;
    });
    setDraft('');
    setAttachment('');
    setPpv('');
    setShowPrice(false);
    setError('');
    setNotice(
      amount > 0
        ? 'Simulated PPV sale recorded in transactions.'
        : 'Message saved locally. No external message was sent.',
    );
  };
  const saveMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMessage || !fan) return;
    const form = new FormData(event.currentTarget);
    const text = String(form.get('text') ?? '').trim();
    const amount = Number(form.get('amount'));
    const dateValue = String(form.get('date'));
    const direction = form.get('direction') === 'in' ? 'in' : 'out';
    const date = new Date(dateValue);
    if (!Number.isFinite(amount) || amount < 0 || Number.isNaN(date.getTime())) {
      setError('A valid date and non-negative amount are required.');
      return;
    }
    if (!text && !editingMessage.image && amount === 0) {
      setError('The message cannot be empty.');
      return;
    }
    updateScenario((s) => {
      const m = s.messages.find((m) => m.id === editingMessage.id);
      if (!m) return;
      m.text = text;
      m.date = date.toISOString();
      m.direction = direction;
      m.ppvAmount = amount;
      m.image = editingMessage.image;
      if (amount > 0) {
        const saleId = m.saleId ?? uid();
        m.saleId = saleId;
        const transaction = s.transactions.find((t) => t.id === saleId);
        if (transaction) {
          transaction.amount = amount;
          transaction.date = m.date;
          transaction.fanId = m.fanId;
          transaction.creatorId = fan.creatorId;
        } else
          s.transactions.push({
            id: saleId,
            creatorId: fan.creatorId,
            fanId: m.fanId,
            employeeId: s.employees[0]?.id ?? '',
            date: m.date,
            category: 'ppv',
            amount,
          });
      } else if (m.saleId) {
        s.transactions = s.transactions.filter((t) => t.id !== m.saleId);
        delete m.saleId;
      }
    });
    setEditingMessage(null);
    setError('');
    setNotice('Message and linked sale updated.');
  };
  const deleteMessage = () => {
    if (!confirmDelete) return;
    updateScenario((s) => {
      s.messages = s.messages.filter((m) => m.id !== confirmDelete.id);
      if (confirmDelete.saleId) s.transactions = s.transactions.filter((t) => t.id !== confirmDelete.saleId);
    });
    setConfirmDelete(null);
    setNotice('Message and its linked sale removed.');
  };
  const createConversation = (event: FormEvent) => {
    event.preventDefault();
    if (newMode === 'existing') {
      const candidate = fans.find((f) => f.id === newFanId);
      if (!candidate) {
        setError('Select a fan.');
        return;
      }
      selectFan(candidate.id);
    } else {
      const creatorId = selectedCreator !== 'all' ? selectedCreator : newCreator || scenario.creators[0]?.id;
      if (!newName.trim() || !creatorId) {
        setError('A name and creator are required.');
        return;
      }
      const id = uid();
      updateScenario((s) => {
        s.fans.push({
          id,
          creatorId,
          name: newName.trim(),
          username: `@${newName.trim().toLowerCase().replace(/\s+/g, '_')}`,
          avatar: '',
          joinedAt: new Date().toISOString().slice(0, 10),
          status: 'free',
          tags: [],
          notes: '',
          unread: 0,
        });
      });
      setSelectedId(id);
      setMobileConversation(true);
    }
    setNewConversation(false);
    setNewName('');
    setError('');
  };
  const saveFan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingFan) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const username = String(form.get('username') ?? '').trim();
    const joinedAt = String(form.get('joinedAt') ?? '');
    if (!name || !joinedAt) {
      setError('Name and join date are required.');
      return;
    }
    const status = String(form.get('status')) as Fan['status'];
    const notes = String(form.get('notes') ?? '');
    const tags = String(form.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    updateScenario((s) => {
      const f = s.fans.find((f) => f.id === editingFan.id);
      if (f) Object.assign(f, { name, username, joinedAt, status, notes, tags });
    });
    setEditingFan(null);
    setError('');
    setNotice('Fan profile updated.');
  };
  return (
    <>
      <div className="messages-page-heading">
        <div>
          <div className="messages-eyebrow">YOUR CONVERSATIONS, CONNECTED</div>
          <h1>
            Messages Pro <span className="badge">Simulation</span>
          </h1>
          <p className="muted">A personal touch. Every conversation, in one place.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setNewFanId(fans[0]?.id ?? '');
            setNewCreator(scenario.creators[0]?.id ?? '');
            setNewConversation(true);
            setError('');
          }}
        >
          <Plus size={17} /> New conversation
        </button>
      </div>
      {notice && (
        <div className="messages-notice" role="status">
          <ShieldCheck size={16} />
          {notice}
          <button
            aria-label="Dismiss notification"
            className="button icon small"
            onClick={() => setNotice('')}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <section className={`messages-workspace panel ${mobileConversation ? 'show-conversation' : ''}`}>
        <aside className="messages-list" aria-label="Fan conversations">
          <div className="messages-list-header">
            <div>
              <strong>Inbox</strong>
              <span className="messages-count">{unread}</span>
            </div>
            <MessageCircle size={18} className="muted" />
          </div>
          <label className="messages-search">
            <Search size={16} />
            <input
              aria-label="Search conversations"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="messages-filters">
            {[
              ['all', 'All messages'],
              ['unread', 'Unread'],
              ['vip', 'VIP'],
            ].map(([id, label]) => (
              <button key={id} onClick={() => setFilter(id)} className={filter === id ? 'active' : ''}>
                {label}
              </button>
            ))}
          </div>
          <div className="messages-fan-list">
            {visibleFans.length ? (
              visibleFans.map((f) => {
                const last = lastMessage.get(f.id);
                return (
                  <button
                    className={`messages-fan ${f.id === fan?.id ? 'active' : ''}`}
                    key={f.id}
                    onClick={() => selectFan(f.id)}
                  >
                    <span
                      className="messages-avatar"
                      style={{
                        background: scenario.creators.find((c) => c.id === f.creatorId)?.color ?? '#7464ed',
                      }}
                    >
                      {safeImage(f.avatar) ? <img src={f.avatar} alt="" /> : initials(f.name)}
                      <i className={f.status === 'expired' ? 'offline' : ''} />
                    </span>
                    <span className="messages-fan-copy">
                      <span>
                        <strong>{f.name}</strong>
                        <time>{last ? shortDate(last.date) : shortDate(f.joinedAt)}</time>
                      </span>
                      <span>
                        <small>
                          {last?.text || (last?.image ? 'Image attachment' : 'Start a conversation')}
                        </small>
                        {f.unread > 0 && <b className="messages-unread">{f.unread}</b>}
                      </span>
                      <em>{f.tags.slice(0, 2).join(' · ') || f.username}</em>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="empty-state">
                <Search size={24} />
                <p>No matching conversations.</p>
                <button
                  className="button small"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
          <div className="messages-list-footer">
            <ShieldCheck size={14} />
            <span>Local messages · No external delivery</span>
          </div>
        </aside>
        {fan ? (
          <>
            <div className="messages-conversation">
              <header className="messages-conversation-header">
                <button
                  className="button icon messages-back"
                  aria-label="Back to conversations"
                  onClick={() => setMobileConversation(false)}
                >
                  <ArrowLeft size={18} />
                </button>
                <span className="messages-avatar small" style={{ background: creator?.color ?? '#7464ed' }}>
                  {initials(fan.name)}
                </span>
                <div className="messages-contact">
                  <strong>{fan.name}</strong>
                  <span>
                    <i /> {fan.status === 'expired' ? 'Subscription expired' : 'Active fan'} <b>·</b>{' '}
                    {creator?.name ?? 'Independent creator'}
                  </span>
                </div>
                <span className="badge messages-local">
                  <LockKeyhole size={12} /> Local only
                </span>
                {editMode && (
                  <button
                    className="button icon"
                    aria-label="Edit fan profile"
                    onClick={() => {
                      setEditingFan({ ...fan });
                      setError('');
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </header>
              <div className="messages-thread" aria-label={`Conversation with ${fan.name}`}>
                {messages.length ? (
                  messages.map((message, index) => {
                    const day = shortDate(message.date);
                    const divider = index === 0 || shortDate(messages[index - 1].date) !== day;
                    return (
                      <div key={message.id}>
                        {divider && (
                          <div className="messages-day">
                            <span>
                              {new Date(message.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                        <div className={`messages-row ${message.direction === 'out' ? 'sent' : 'received'}`}>
                          {message.direction === 'in' && (
                            <span
                              className="messages-avatar tiny"
                              style={{ background: creator?.color ?? '#7464ed' }}
                            >
                              {initials(fan.name)}
                            </span>
                          )}
                          <div className="messages-bubble-group">
                            <div className="messages-bubble">
                              {message.image && (
                                <div className="messages-attachment">
                                  {safeImage(message.image) ? (
                                    <img src={message.image} alt="Simulated message attachment" />
                                  ) : (
                                    <div className="messages-image-placeholder">
                                      <ImagePlus size={24} />
                                      <span>Demo attachment</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              {message.ppvAmount > 0 && (
                                <div className="messages-ppv">
                                  <LockKeyhole size={17} />
                                  <div>
                                    <strong>Exclusive content</strong>
                                    <span>Simulated PPV sale</span>
                                  </div>
                                  <b>{money(message.ppvAmount, currency)}</b>
                                </div>
                              )}
                              {message.text && <p>{message.text}</p>}
                            </div>
                            <div className="messages-meta">
                              <time dateTime={message.date}>{stamp(message.date)}</time>
                              {message.direction === 'out' && <CheckCheck size={13} />}{' '}
                              {editMode && (
                                <>
                                  <button
                                    aria-label={`Edit message ${message.id}`}
                                    onClick={() => {
                                      setEditingMessage({ ...message });
                                      setError('');
                                    }}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    aria-label={`Delete message ${message.id}`}
                                    onClick={() => setConfirmDelete(message)}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state messages-empty">
                    <MessageCircle size={36} />
                    <h3>A new conversation starts here</h3>
                    <p>Write a local message to {fan.name}.</p>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <form className="messages-composer" onSubmit={sendMessage}>
                {attachment && (
                  <div className="messages-composer-image">
                    <img src={attachment} alt="Pending attachment" />
                    <button
                      type="button"
                      className="button icon small"
                      aria-label="Remove attachment"
                      onClick={() => setAttachment('')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
                {showPrice && (
                  <label className="messages-price">
                    <DollarSign size={15} />
                    <span>Simulated PPV sale</span>
                    <input
                      type="number"
                      aria-label="PPV amount"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={ppv}
                      onChange={(e) => setPpv(e.target.value)}
                    />
                    <button
                      type="button"
                      className="button icon small"
                      aria-label="Remove PPV amount"
                      onClick={() => {
                        setShowPrice(false);
                        setPpv('');
                      }}
                    >
                      <X size={14} />
                    </button>
                  </label>
                )}
                {error && !editingFan && !editingMessage && !newConversation && (
                  <p className="messages-error" role="alert">
                    {error}
                  </p>
                )}
                <textarea
                  aria-label="Message text"
                  placeholder={`Message ${fan.name.split(' ')[0]}…`}
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <div className="messages-composer-tools">
                  <div>
                    <button
                      type="button"
                      className="button icon"
                      aria-label="Attach a local image"
                      title="Attach a local image"
                      onClick={() => imageRef.current?.click()}
                    >
                      <ImagePlus size={18} />
                    </button>
                    <input
                      ref={imageRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      hidden
                      onChange={(e) => {
                        uploadImage(e.target.files?.[0], setAttachment);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      className={`button icon ${showPrice ? 'active' : ''}`}
                      aria-label="Add simulated PPV sale"
                      title="Simulated PPV sale"
                      onClick={() => setShowPrice(!showPrice)}
                    >
                      <DollarSign size={18} />
                    </button>
                    <div className="messages-script-wrap">
                      <button
                        type="button"
                        className="button small"
                        onClick={() => setScriptOpen(!scriptOpen)}
                        aria-expanded={scriptOpen}
                      >
                        <FileText size={15} /> Scripts <ChevronDown size={12} />
                      </button>
                      {scriptOpen && (
                        <div className="messages-script-menu">
                          {scenario.scripts.length ? (
                            scenario.scripts.map((script) => (
                              <button
                                key={script.id}
                                type="button"
                                onClick={() => {
                                  setDraft(script.content);
                                  setScriptOpen(false);
                                }}
                              >
                                <strong>{script.title}</strong>
                                <small>{script.content}</small>
                              </button>
                            ))
                          ) : (
                            <p className="muted">Create a script from the Scripts page.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button type="submit" className="button primary">
                    <span>Save message</span>
                    <Send size={16} />
                  </button>
                </div>
                <div className="messages-compose-caption">
                  <ShieldCheck size={11} /> Simulation only. Nothing is sent to a real account.{' '}
                  <span>⌘ / Ctrl + Enter</span>
                </div>
              </form>
            </div>
            <aside className="messages-profile" aria-label="Fan profile">
              <div className="messages-profile-top">
                <span className="messages-avatar large" style={{ background: creator?.color ?? '#7464ed' }}>
                  {safeImage(fan.avatar) ? <img src={fan.avatar} alt="" /> : initials(fan.name)}
                </span>
                <h3>{fan.name}</h3>
                <p className="muted">{fan.username}</p>
                <span className={`badge ${fan.status === 'expired' ? '' : 'success'}`}>
                  {fan.status.charAt(0).toUpperCase() + fan.status.slice(1)} subscriber
                </span>
              </div>
              <div className="messages-spent">
                <span>Total spent</span>
                <strong>{money(spent, currency)}</strong>
                <small>{purchases.length} local transactions</small>
              </div>
              <div className="messages-profile-section">
                <h4>
                  Fan information{' '}
                  {editMode && (
                    <button
                      className="button icon small"
                      aria-label="Edit fan information"
                      onClick={() => {
                        setEditingFan({ ...fan });
                        setError('');
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </h4>
                <dl>
                  <div>
                    <dt>Creator</dt>
                    <dd>{creator?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Joined</dt>
                    <dd>
                      {shortDate(fan.joinedAt)}, {new Date(fan.joinedAt).getFullYear()}
                    </dd>
                  </div>
                  <div>
                    <dt>Subscription</dt>
                    <dd className={fan.status === 'expired' ? '' : 'messages-positive'}>{fan.status}</dd>
                  </div>
                </dl>
              </div>
              <div className="messages-profile-section">
                <h4>
                  <Tag size={14} /> Tags
                </h4>
                <div className="messages-tags">
                  {fan.tags.length ? (
                    fan.tags.map((tag, i) => (
                      <span className="badge" key={`${tag}-${i}`}>
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="muted">No tags yet</span>
                  )}
                </div>
              </div>
              <div className="messages-profile-section">
                <h4>
                  Personal notes{' '}
                  {editMode && (
                    <button
                      className="button icon small"
                      aria-label="Edit fan notes"
                      onClick={() => {
                        setEditingFan({ ...fan });
                        setError('');
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </h4>
                <p className="messages-notes">{fan.notes || 'Add a note to remember the little details.'}</p>
              </div>
              <div className="messages-profile-section">
                <h4>
                  <Clock3 size={14} /> Purchase history{' '}
                  <span className="messages-count">{purchases.length}</span>
                </h4>
                <div className="messages-purchases">
                  {purchases.length ? (
                    purchases.slice(0, 12).map((transaction) => (
                      <div key={transaction.id}>
                        <span className="messages-purchase-icon">
                          <DollarSign size={14} />
                        </span>
                        <div>
                          <strong>
                            {transaction.category === 'ppv'
                              ? 'PPV purchase'
                              : transaction.category.charAt(0).toUpperCase() + transaction.category.slice(1)}
                          </strong>
                          <small>{shortDate(transaction.date)}</small>
                        </div>
                        <b>{money(transaction.amount, currency)}</b>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No purchases recorded.</p>
                  )}
                  {purchases.length > 12 && (
                    <small className="muted">
                      Showing the 12 latest purchases. All purchases are in Sales Records.
                    </small>
                  )}
                </div>
              </div>
            </aside>
          </>
        ) : (
          <div className="empty-state messages-no-fans">
            <MessageCircle size={40} />
            <h3>Your inbox is ready</h3>
            <p>Create a fictional fan to start a local conversation.</p>
            <button
              className="button primary"
              onClick={() => {
                setNewMode('new');
                setNewConversation(true);
              }}
            >
              Create a fan
            </button>
          </div>
        )}
      </section>
      {newConversation && (
        <Modal
          title="New conversation"
          onClose={() => {
            setNewConversation(false);
            setError('');
          }}
        >
          <form onSubmit={createConversation}>
            <div className="modal-body">
              <div className="tabs">
                <button
                  type="button"
                  className={newMode === 'existing' ? 'active' : ''}
                  onClick={() => setNewMode('existing')}
                >
                  Existing fan
                </button>
                <button
                  type="button"
                  className={newMode === 'new' ? 'active' : ''}
                  onClick={() => setNewMode('new')}
                >
                  Create fictional fan
                </button>
              </div>
              {newMode === 'existing' ? (
                <label className="field">
                  Fan
                  <select
                    className="select"
                    value={newFanId}
                    onChange={(e) => setNewFanId(e.target.value)}
                    required
                  >
                    <option value="">Select a fan</option>
                    {fans.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name} · {f.username}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label className="field">
                    Display name
                    <input
                      className="input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Jordan Miles"
                      required
                      maxLength={100}
                    />
                  </label>
                  {selectedCreator === 'all' && (
                    <label className="field">
                      Creator
                      <select
                        className="select"
                        value={newCreator}
                        onChange={(e) => setNewCreator(e.target.value)}
                        required
                      >
                        {scenario.creators.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="muted">
                    Use invented names only. This fan exists exclusively on this device.
                  </p>
                </>
              )}
              {error && (
                <p className="messages-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="button"
                type="button"
                onClick={() => {
                  setNewConversation(false);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                <MessageCircle size={15} /> Open conversation
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editingMessage && (
        <Modal
          title="Edit local message"
          onClose={() => {
            setEditingMessage(null);
            setError('');
          }}
        >
          <form onSubmit={saveMessage}>
            <div className="modal-body">
              <label className="field">
                Message
                <textarea className="input" name="text" defaultValue={editingMessage.text} rows={4} />
              </label>
              <div className="form-grid">
                <label className="field">
                  Date & time
                  <input
                    className="input"
                    type="datetime-local"
                    name="date"
                    defaultValue={localDateTime(editingMessage.date)}
                    required
                  />
                </label>
                <label className="field">
                  Direction
                  <select className="select" name="direction" defaultValue={editingMessage.direction}>
                    <option value="out">Outgoing</option>
                    <option value="in">Incoming</option>
                  </select>
                </label>
              </div>
              <label className="field">
                Simulated PPV sale amount
                <input
                  className="input"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={editingMessage.ppvAmount}
                />
              </label>
              <p className="muted">
                A positive amount creates or updates the linked transaction. Set it to zero to remove that
                sale.
              </p>
              {editingMessage.image && (
                <div className="messages-edit-attachment">
                  {safeImage(editingMessage.image) && (
                    <img src={editingMessage.image} alt="Message attachment" />
                  )}
                  <button
                    className="button small danger"
                    type="button"
                    onClick={() => setEditingMessage({ ...editingMessage, image: '' })}
                  >
                    <Trash2 size={14} /> Remove image
                  </button>
                </div>
              )}
              <label className="field">
                Replace image (max. 3 MB)
                <input
                  className="input"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) =>
                    uploadImage(e.target.files?.[0], (image) =>
                      setEditingMessage({ ...editingMessage, image }),
                    )
                  }
                />
              </label>
              {error && (
                <p className="messages-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="button"
                type="button"
                onClick={() => {
                  setEditingMessage(null);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                <Check size={15} /> Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editingFan && (
        <Modal
          title="Edit fictional fan"
          onClose={() => {
            setEditingFan(null);
            setError('');
          }}
        >
          <form onSubmit={saveFan}>
            <div className="modal-body">
              <div className="form-grid">
                <label className="field">
                  Name
                  <input
                    className="input"
                    name="name"
                    defaultValue={editingFan.name}
                    required
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  Username
                  <input
                    className="input"
                    name="username"
                    defaultValue={editingFan.username}
                    maxLength={100}
                  />
                </label>
                <label className="field">
                  Join date
                  <input
                    className="input"
                    type="date"
                    name="joinedAt"
                    defaultValue={editingFan.joinedAt.slice(0, 10)}
                    required
                  />
                </label>
                <label className="field">
                  Subscription
                  <select className="select" name="status" defaultValue={editingFan.status}>
                    {['paid', 'free', 'expired', 'renewed'].map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field">
                Tags (comma separated)
                <input
                  className="input"
                  name="tags"
                  defaultValue={editingFan.tags.join(', ')}
                  placeholder="VIP, Loyal fan"
                />
              </label>
              <label className="field">
                Personal notes
                <textarea className="input" name="notes" defaultValue={editingFan.notes} rows={4} />
              </label>
              {error && (
                <p className="messages-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="button"
                type="button"
                onClick={() => {
                  setEditingFan(null);
                  setError('');
                }}
              >
                Cancel
              </button>
              <button className="button primary" type="submit">
                <Check size={15} /> Save profile
              </button>
            </div>
          </form>
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Delete this message?" onClose={() => setConfirmDelete(null)}>
          <div className="modal-body">
            <p>
              This removes the local message{confirmDelete.saleId ? ' and its linked PPV transaction' : ''}.
              You can restore it with Undo in Studio Editor.
            </p>
          </div>
          <div className="modal-footer">
            <button className="button" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button className="button danger" onClick={deleteMessage}>
              <Trash2 size={15} /> Delete message
            </button>
          </div>
        </Modal>
      )}
      <style jsx>{`
        .messages-page-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 25px;
        }
        .messages-page-heading h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 7px 0 6px;
        }
        .messages-page-heading p {
          margin: 0;
        }
        .messages-eyebrow {
          font-size: 10px;
          letter-spacing: 1.8px;
          font-weight: 650;
          color: var(--accent, #a5a0ff);
        }
        .messages-workspace {
          display: grid;
          grid-template-columns: 285px minmax(290px, 1fr) 265px;
          min-height: 700px;
          height: calc(100dvh - 240px);
          overflow: hidden;
          padding: 0 !important;
        }
        .messages-list {
          border-right: 1px solid var(--border, #272934);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .messages-list-header {
          padding: 23px 20px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .messages-list-header strong {
          font-size: 15px;
        }
        .messages-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 19px;
          height: 19px;
          padding: 0 5px;
          font-size: 10px;
          background: var(--surface-hover, #2b293a);
          color: var(--muted, #a3a1b8);
          border-radius: 5px;
          margin-left: 8px;
        }
        .messages-search {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 16px 14px;
          padding: 9px 10px;
          background: var(--bg, #111218);
          border: 1px solid var(--border, #272934);
          border-radius: 7px;
          color: var(--muted, #8b899b);
        }
        .messages-search input {
          min-width: 0;
          width: 100%;
          background: none;
          border: 0;
          outline: none;
          font-size: 11px;
          color: inherit;
        }
        .messages-filters {
          display: flex;
          padding: 0 16px 16px;
          gap: 5px;
        }
        .messages-filters button {
          border: 0;
          border-radius: 5px;
          background: none;
          color: var(--muted, #8b899b);
          font-size: 10px;
          padding: 6px 9px;
          cursor: pointer;
          white-space: nowrap;
        }
        .messages-filters button.active {
          background: rgba(148, 125, 255, 0.13);
          color: #b4a6ff;
        }
        .messages-fan-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
        }
        .messages-fan {
          display: flex;
          gap: 11px;
          width: 100%;
          border: 0;
          border-left: 2px solid transparent;
          border-bottom: 1px solid var(--border, #272934);
          text-align: left;
          padding: 16px 15px;
          background: none;
          color: inherit;
          cursor: pointer;
        }
        .messages-fan:hover {
          background: var(--surface-hover, #20212d);
        }
        .messages-fan.active {
          border-left-color: #9b85f8;
          background: rgba(148, 125, 255, 0.08);
        }
        .messages-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 650;
          color: white;
          position: relative;
          box-shadow: inset 0 0 0 1px #ffffff13;
        }
        .messages-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
        }
        .messages-avatar i {
          position: absolute;
          width: 8px;
          height: 8px;
          border: 2px solid var(--panel, #191a23);
          background: #74d9a5;
          border-radius: 50%;
          right: 0;
          bottom: 0;
        }
        .messages-avatar i.offline {
          background: #6b6978;
        }
        .messages-avatar.small {
          width: 35px;
          height: 35px;
        }
        .messages-avatar.tiny {
          width: 25px;
          height: 25px;
          font-size: 8px;
          align-self: flex-end;
          margin-bottom: 18px;
        }
        .messages-avatar.large {
          width: 65px;
          height: 65px;
          font-size: 20px;
          margin-bottom: 10px;
        }
        .messages-fan-copy {
          min-width: 0;
          flex: 1;
        }
        .messages-fan-copy > span {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: center;
        }
        .messages-fan-copy strong {
          font-size: 11px;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .messages-fan-copy time {
          font-size: 8px;
          color: var(--muted, #8b899b);
          white-space: nowrap;
        }
        .messages-fan-copy small {
          font-size: 10px;
          color: var(--muted, #8b899b);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
          line-height: 2;
        }
        .messages-fan-copy em {
          font-size: 8px;
          font-style: normal;
          color: #a493dd;
          display: block;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .messages-unread {
          background: #9a84f6;
          color: white;
          border-radius: 50%;
          min-width: 16px;
          height: 16px;
          font-size: 8px;
          display: grid;
          place-items: center;
        }
        .messages-list-footer {
          display: flex;
          gap: 7px;
          padding: 13px 15px;
          font-size: 9px;
          color: var(--muted, #8b899b);
          border-top: 1px solid var(--border, #272934);
        }
        .messages-conversation {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
          background: var(--bg, #14151c);
        }
        .messages-conversation-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 19px 22px;
          border-bottom: 1px solid var(--border, #272934);
          min-height: 74px;
          background: var(--panel, #191a23);
        }
        .messages-contact {
          flex: 1;
          min-width: 0;
        }
        .messages-contact strong {
          font-size: 12px;
        }
        .messages-contact > span {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 9px;
          color: var(--muted, #8b899b);
          margin-top: 4px;
        }
        .messages-contact i {
          display: inline-block;
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #7ed5a5;
        }
        .messages-contact b {
          font-weight: 400;
          color: #5c596b;
        }
        .messages-local {
          font-size: 9px;
          white-space: nowrap;
          display: flex;
          gap: 5px;
          align-items: center;
        }
        .messages-back {
          display: none;
        }
        .messages-thread {
          flex: 1;
          overflow-y: auto;
          padding: 12px 22px 22px;
        }
        .messages-day {
          display: flex;
          justify-content: center;
          padding: 16px 0 20px;
        }
        .messages-day span {
          font-size: 9px;
          color: var(--muted, #8b899b);
          background: var(--panel, #191a23);
          border: 1px solid var(--border, #272934);
          border-radius: 20px;
          padding: 5px 10px;
        }
        .messages-row {
          display: flex;
          gap: 7px;
          margin-bottom: 15px;
        }
        .messages-row.sent {
          justify-content: flex-end;
        }
        .messages-bubble-group {
          max-width: 84%;
        }
        .messages-bubble {
          padding: 12px 14px;
          border-radius: 11px 11px 11px 2px;
          background: var(--panel, #242530);
          font-size: 11px;
          line-height: 1.7;
          overflow: hidden;
        }
        .messages-bubble p {
          margin: 0;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .sent .messages-bubble {
          background: linear-gradient(135deg, #7460b8, #6655a0);
          color: #faf7ff;
          border-radius: 11px 11px 2px 11px;
        }
        .messages-meta {
          display: flex;
          align-items: center;
          gap: 5px;
          padding-top: 5px;
          color: var(--muted, #858296);
          font-size: 8px;
        }
        .sent .messages-meta {
          justify-content: flex-end;
        }
        .messages-meta button {
          border: 0;
          background: none;
          color: inherit;
          padding: 2px;
          cursor: pointer;
        }
        .messages-meta button:hover {
          color: #b7a2ff;
        }
        .messages-ppv {
          display: flex;
          align-items: center;
          gap: 9px;
          background: #ffffff12;
          border: 1px solid #ffffff15;
          padding: 10px;
          border-radius: 7px;
          margin-bottom: 8px;
          min-width: 220px;
        }
        .messages-ppv div {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .messages-ppv strong {
          font-size: 10px;
        }
        .messages-ppv span {
          font-size: 8px;
          opacity: 0.7;
        }
        .messages-ppv b {
          font-size: 12px;
          margin-left: auto;
        }
        .messages-attachment img {
          max-height: 230px;
          width: 100%;
          object-fit: contain;
          border-radius: 6px;
          margin-bottom: 8px;
        }
        .messages-image-placeholder {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
          justify-content: center;
          min-height: 120px;
          background: #ffffff08;
          border-radius: 8px;
        }
        .messages-empty {
          height: 100%;
          justify-content: center;
        }
        .messages-composer {
          border-top: 1px solid var(--border, #272934);
          background: var(--panel, #191a23);
          padding: 17px 20px 12px;
        }
        .messages-composer > textarea {
          display: block;
          width: 100%;
          background: none;
          border: 0;
          color: inherit;
          outline: none;
          resize: vertical;
          min-height: 45px;
          max-height: 180px;
          font-size: 11px;
          line-height: 1.7;
        }
        .messages-composer-tools {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .messages-composer-tools > div {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .messages-compose-caption {
          font-size: 8px;
          color: var(--muted, #8b899b);
          display: flex;
          gap: 5px;
          align-items: center;
          margin-top: 12px;
        }
        .messages-compose-caption > span {
          margin-left: auto;
        }
        .messages-composer-image {
          position: relative;
          width: 70px;
          height: 65px;
          margin-bottom: 8px;
        }
        .messages-composer-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 7px;
        }
        .messages-composer-image button {
          position: absolute;
          right: -6px;
          top: -6px;
          background: var(--panel, #191a23);
        }
        .messages-price {
          display: flex;
          align-items: center;
          gap: 5px;
          border: 1px solid var(--border, #272934);
          background: var(--bg, #14151c);
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 10px;
          margin-bottom: 8px;
        }
        .messages-price input {
          width: 90px;
          min-width: 0;
          background: transparent;
          border: 0;
          color: inherit;
          font-size: 11px;
          margin-left: auto;
          outline: none;
        }
        .messages-error {
          font-size: 12px;
          color: #fc9eac;
          padding: 8px 10px;
          background: #e86e8311;
          border-radius: 5px;
        }
        .messages-script-wrap {
          position: relative;
        }
        .messages-script-menu {
          position: absolute;
          bottom: 40px;
          left: 0;
          width: 260px;
          max-height: 250px;
          overflow-y: auto;
          background: var(--panel, #23242e);
          padding: 6px;
          border: 1px solid var(--border, #373542);
          border-radius: 9px;
          box-shadow: 0 8px 25px #0005;
          z-index: 20;
        }
        .messages-script-menu button {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: left;
          width: 100%;
          padding: 10px;
          border: 0;
          border-radius: 5px;
          background: none;
          color: inherit;
          cursor: pointer;
        }
        .messages-script-menu button:hover {
          background: var(--surface-hover, #302c41);
        }
        .messages-script-menu strong {
          font-size: 11px;
        }
        .messages-script-menu small {
          font-size: 10px;
          color: var(--muted, #a7a3b7);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
        }
        .messages-profile {
          border-left: 1px solid var(--border, #272934);
          overflow-y: auto;
          background: var(--panel, #191a23);
        }
        .messages-profile-top {
          text-align: center;
          padding: 28px 20px 20px;
        }
        .messages-profile-top h3 {
          font-size: 15px;
          margin: 4px 0;
        }
        .messages-profile-top p {
          font-size: 10px;
          margin: 4px 0 12px;
        }
        .messages-profile-top .badge {
          font-size: 9px;
        }
        .messages-spent {
          margin: 0 20px 20px;
          background: linear-gradient(125deg, #8f75de12, #8f75de04);
          border: 1px solid #9079d62b;
          border-radius: 9px;
          padding: 15px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .messages-spent > span {
          font-size: 10px;
          color: var(--muted, #a6a1b5);
        }
        .messages-spent strong {
          font-size: 25px;
          letter-spacing: -1px;
          font-weight: 600;
        }
        .messages-spent small {
          font-size: 8px;
          color: #9b85cf;
        }
        .messages-profile-section {
          border-top: 1px solid var(--border, #272934);
          padding: 16px 20px;
        }
        .messages-profile-section h4 {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          margin: 0 0 12px;
          font-weight: 600;
        }
        .messages-profile-section h4 button {
          margin-left: auto;
        }
        .messages-profile-section dl {
          margin: 0;
        }
        .messages-profile-section dl > div {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          margin-top: 12px;
          font-size: 9px;
        }
        .messages-profile-section dt {
          color: var(--muted, #8b899b);
        }
        .messages-profile-section dd {
          margin: 0;
          text-align: right;
        }
        .messages-positive {
          color: #91d0ad;
        }
        .messages-tags {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
          font-size: 10px;
        }
        .messages-tags .badge {
          font-size: 9px;
        }
        .messages-notes {
          font-size: 10px;
          line-height: 1.8;
          color: var(--muted, #a4a0b5);
          white-space: pre-wrap;
          margin: 0;
          overflow-wrap: anywhere;
        }
        .messages-purchases > div {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 13px;
        }
        .messages-purchase-icon {
          display: grid;
          place-items: center;
          width: 27px;
          height: 27px;
          background: #8b73db13;
          border: 1px solid #8b73db21;
          color: #a995e9;
          border-radius: 7px;
        }
        .messages-purchases > div > div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .messages-purchases strong {
          font-size: 9px;
          font-weight: 500;
        }
        .messages-purchases small {
          font-size: 8px;
          color: var(--muted, #8b899b);
        }
        .messages-purchases b {
          font-size: 10px;
          margin-left: auto;
          font-weight: 500;
        }
        .messages-no-fans {
          grid-column: span 2;
          justify-content: center;
        }
        .messages-notice {
          display: flex;
          align-items: center;
          gap: 9px;
          border: 1px solid #7fd6b12a;
          background: #7fd6b10b;
          padding: 9px 13px;
          border-radius: 8px;
          font-size: 11px;
          color: #92d8b5;
          margin-bottom: 12px;
        }
        .messages-notice button {
          margin-left: auto;
        }
        .messages-dialog {
          border: 1px solid var(--border, #34323f);
          border-radius: 14px;
          max-width: min(580px, calc(100vw - 32px));
          width: 100%;
          background: var(--panel, #191a23);
          color: var(--text, #edebf5);
          padding: 0;
          box-shadow: 0 30px 100px #0008;
        }
        .messages-dialog::backdrop {
          background: #05060bc4;
          backdrop-filter: blur(5px);
        }
        .messages-dialog h2 {
          font-size: 19px;
          margin: 6px 0 0;
        }
        .messages-edit-attachment {
          display: flex;
          align-items: center;
          gap: 15px;
          margin: 12px 0;
        }
        .messages-edit-attachment img {
          width: 85px;
          height: 85px;
          object-fit: cover;
          border-radius: 6px;
        }
        @media (min-width: 1700px) {
          .messages-workspace {
            grid-template-columns: 320px minmax(300px, 1fr) 300px;
          }
          .messages-fan {
            padding: 18px;
          }
          .messages-fan-copy strong {
            font-size: 12px;
          }
          .messages-fan-copy small {
            font-size: 11px;
          }
          .messages-bubble {
            font-size: 13px;
          }
        }
        @media (max-width: 1250px) {
          .messages-workspace {
            grid-template-columns: 250px minmax(280px, 1fr);
          }
          .messages-profile {
            display: none;
          }
          .messages-no-fans {
            grid-column: 2;
          }
        }
        @media (max-width: 800px) {
          .messages-page-heading {
            align-items: flex-start;
            flex-direction: column;
          }
          .messages-workspace {
            grid-template-columns: 225px minmax(270px, 1fr);
            min-height: 650px;
            height: 75dvh;
          }
          .messages-conversation-header {
            padding: 15px;
          }
          .messages-thread {
            padding: 12px;
          }
          .messages-local {
            display: none;
          }
          .messages-compose-caption > span {
            display: none;
          }
          .messages-bubble-group {
            max-width: 94%;
          }
          .messages-composer {
            padding: 12px;
          }
          .messages-composer-tools .button.small {
            font-size: 0;
            gap: 3px;
          }
          .messages-composer-tools .button.small :global(svg) {
            width: 15px;
          }
          .messages-page-heading h1 {
            font-size: 25px;
          }
        }
        @media (max-width: 620px) {
          .messages-workspace {
            display: flex;
            min-height: 650px;
          }
          .messages-list {
            width: 100%;
            border: 0;
          }
          .messages-conversation {
            display: none;
            width: 100%;
          }
          .show-conversation .messages-list {
            display: none;
          }
          .show-conversation .messages-conversation {
            display: flex;
          }
          .messages-back {
            display: inline-flex;
          }
          .messages-fan-copy small {
            max-width: 240px;
          }
          .messages-fan-copy strong {
            font-size: 13px;
          }
          .messages-fan-copy time {
            font-size: 10px;
          }
          .messages-fan-copy small {
            font-size: 12px;
          }
          .messages-avatar {
            width: 42px;
            height: 42px;
          }
          .messages-fan-copy em {
            font-size: 10px;
          }
          .messages-no-fans {
            display: flex;
            width: 100%;
          }
          .messages-contact > span {
            font-size: 9px;
          }
          .messages-page-heading > button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </>
  );
}
