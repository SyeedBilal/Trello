import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Name must be at least 2 characters');
    if (password.length < 12) return setError('Password must be at least 12 characters');
    setLoading(true);
    try { await register(name.trim(), email, password); navigate('/dashboard', { replace: true }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to create account'); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen grid place-items-center px-4 bg-slate-50">
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
      <p className="mt-2 text-sm text-slate-500">Start organizing work in one place.</p>
      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <label className="mt-6 block text-sm font-medium text-slate-700">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="John Smith" /></label>
      <label className="mt-4 block text-sm font-medium text-slate-700">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="you@example.com" /></label>
      <label className="mt-4 block text-sm font-medium text-slate-700">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="12+ characters" /></label>
      <p className="mt-2 text-xs text-slate-500">Use upper/lowercase letters, a number, and a symbol.</p>
      <button disabled={loading} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{loading ? 'Creating account…' : 'Create account'}</button>
      <p className="mt-5 text-center text-sm text-slate-500">Already have an account? <Link className="font-semibold text-indigo-600" to="/login">Sign in</Link></p>
    </form>
  </main>;
}
