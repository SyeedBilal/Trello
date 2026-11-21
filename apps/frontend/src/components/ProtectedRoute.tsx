import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-600">Restoring session…</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-slate-600">Restoring session…</div>;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}
