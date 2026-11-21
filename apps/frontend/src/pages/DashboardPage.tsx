import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { boardService, type Board } from '../services/boardService';

export function DashboardPage() {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Board | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function loadBoards() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await boardService.getAll(accessToken);
      setBoards(result.data.boards);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load boards');
    } finally { setLoading(false); }
  }

  useEffect(() => { void loadBoards(); }, [accessToken]);

  function openCreate() {
    setEditing(null);
    setTitle('');
    setDescription('');
    setShowForm(true);
  }

  function openEdit(board: Board) {
    setEditing(board);
    setTitle(board.title);
    setDescription(board.description ?? '');
    setShowForm(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !title.trim()) return;
    setError('');
    try {
      if (editing) {
        const result = await boardService.update(editing.id, { title: title.trim(), description: description.trim() || null }, accessToken);
        setBoards((current) => current.map((board) => board.id === editing.id ? result.data.board : board));
      } else {
        const result = await boardService.create(title.trim(), description.trim() || null, accessToken);
        setBoards((current) => [result.data.board, ...current]);
      }
      setShowForm(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save board');
    }
  }

  async function removeBoard(board: Board) {
    if (!accessToken || !window.confirm(`Delete "${board.title}" and all of its lists and cards?`)) return;
    try {
      await boardService.remove(board.id, accessToken);
      setBoards((current) => current.filter((item) => item.id !== board.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete board');
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return <main className="min-h-screen bg-slate-50">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3"><div className="grid size-9 place-items-center rounded-lg bg-indigo-600 text-lg font-bold text-white">T</div><span className="font-bold text-slate-900">Taskboard</span></div>
        <button onClick={() => void handleLogout()} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Log out</button>
      </div>
    </header>
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm font-semibold text-indigo-600">Dashboard</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Welcome, {user?.name}</h1></div>
        <button onClick={openCreate} className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700">Create board</button>
      </div>
      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {loading ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-slate-200" />)}</div> : boards.length === 0 ? <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><div className="text-4xl">📋</div><h2 className="mt-4 text-lg font-semibold text-slate-900">No boards yet</h2><p className="mt-2 text-sm text-slate-500">Create your first project board to get started.</p><button onClick={openCreate} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white">Create board</button></div> : <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{boards.map((board) => <article key={board.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Link to={`/boards/${board.id}`} className="block"><h2 className="text-lg font-semibold text-slate-900">{board.title}</h2><p className="mt-2 min-h-10 text-sm text-slate-500">{board.description || 'No description'}</p></Link><div className="mt-5 flex gap-2 border-t border-slate-100 pt-4"><button onClick={() => openEdit(board)} className="text-sm font-semibold text-slate-600 hover:text-indigo-600">Edit</button><button onClick={() => void removeBoard(board)} className="text-sm font-semibold text-red-500 hover:text-red-700">Delete</button></div></article>)}</div>}
    </section>
    {showForm && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4"><form onSubmit={submit} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold text-slate-900">{editing ? 'Edit board' : 'Create board'}</h2><label className="mt-5 block text-sm font-medium text-slate-700">Title<input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" required /></label><label className="mt-4 block text-sm font-medium text-slate-700">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2.5" /></label><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{editing ? 'Save changes' : 'Create board'}</button></div></form></div>}
  </main>;
}
