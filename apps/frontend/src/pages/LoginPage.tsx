import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!email || !password) return setError('Email and password are required');
    setLoading(true);
    try { await login(email, password); navigate('/dashboard', { replace: true }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to log in'); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen grid place-items-center px-4 bg-slate-50">
    <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
      <p className="mt-2 text-sm text-slate-500">Sign in to manage your projects.</p>
      {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <label className="mt-6 block text-sm font-medium text-slate-700">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="you@example.com" /></label>
      <label className="mt-4 block text-sm font-medium text-slate-700">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="••••••••••••" /></label>
      <button disabled={loading} className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{loading ? 'Signing in…' : 'Sign in'}</button>
      <p className="mt-5 text-center text-sm text-slate-500">New here? <Link className="font-semibold text-indigo-600" to="/register">Create an account</Link></p>
    </form>
  </main>;
}
