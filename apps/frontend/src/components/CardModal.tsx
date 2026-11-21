import { useState, type FormEvent } from 'react';
import type { Card } from '../services/boardService';

interface Props {
  card?: Card | null;
  listTitle: string;
  onClose: () => void;
  onSave: (input: { title: string; description: string | null; priority: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate: string | null; labels: string[] }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export function CardModal({ card, listTitle, onClose, onSave, onDelete }: Props) {
  const [title, setTitle] = useState(card?.title ?? '');
  const [description, setDescription] = useState(card?.description ?? '');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>(card?.priority ?? 'MEDIUM');
  const [dueDate, setDueDate] = useState(card?.dueDate ? card.dueDate.slice(0, 10) : '');
  const [labels, setLabels] = useState(card?.labels ?? []);
  const [labelInput, setLabelInput] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function addLabel() {
    const value = labelInput.trim();
    if (value && !labels.includes(value) && labels.length < 20) setLabels((current) => [...current, value]);
    setLabelInput('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError('Card title is required');
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), description: description.trim() || null, priority, dueDate: dueDate ? new Date(`${dueDate}T12:00:00.000Z`).toISOString() : null, labels });
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save card'); }
    finally { setSaving(false); }
  }

  async function removeCard() {
    if (!onDelete) return;
    setSaving(true);
    setError('');
    try { await onDelete(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to delete card'); }
    finally { setSaving(false); }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="card-modal-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{listTitle}</p><h2 id="card-modal-title" className="mt-1 text-xl font-bold text-slate-900">{card ? 'Card details' : 'Create card'}</h2></div><button type="button" onClick={onClose} aria-label="Close card dialog" className="text-slate-400 hover:text-slate-700">✕</button></div>
      {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <label className="mt-5 block text-sm font-medium text-slate-700">Title<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" required /></label>
      <label className="mt-4 block text-sm font-medium text-slate-700">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label>
      <div className="mt-4 grid grid-cols-2 gap-4"><label className="text-sm font-medium text-slate-700">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as 'LOW' | 'MEDIUM' | 'HIGH')} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></select></label><label className="text-sm font-medium text-slate-700">Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label></div>
      <div className="mt-4"><span className="text-sm font-medium text-slate-700">Labels</span><div className="mt-2 flex gap-2"><input value={labelInput} onChange={(event) => setLabelInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addLabel(); } }} className="flex-1 rounded-lg border border-slate-300 px-3 py-2" placeholder="Add label" /><button type="button" onClick={addLabel} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Add</button></div><div className="mt-3 flex flex-wrap gap-2">{labels.map((label) => <span key={label} className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{label}<button type="button" onClick={() => setLabels((current) => current.filter((item) => item !== label))} className="ml-2 text-indigo-400">×</button></span>)}</div></div>
      <div className="mt-6 flex items-center justify-between"><div>{card && onDelete && <button type="button" disabled={saving} onClick={() => void removeCard()} className="text-sm font-semibold text-red-500 disabled:opacity-60">Delete card</button>}</div><div className="flex gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save card'}</button></div></div>
    </form>
  </div>;
}
