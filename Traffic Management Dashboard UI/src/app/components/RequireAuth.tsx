import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth';

export function RequireAuth() {
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center px-6">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <h1 className="text-lg font-semibold text-slate-900">Loading your account</h1>
          <p className="mt-2 text-sm text-slate-500">Checking your session before opening this page.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirect = `${location.pathname}${location.search}`;
    const search = new URLSearchParams({ redirect }).toString();
    return <Navigate to={`/login?${search}`} replace />;
  }

  return <Outlet />;
}