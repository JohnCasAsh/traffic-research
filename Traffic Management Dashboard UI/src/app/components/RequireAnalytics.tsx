import { Navigate, Outlet } from 'react-router';
import { useAuth } from '../auth';

export function RequireAnalytics() {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white px-8 py-10 shadow-sm text-center">
          <div className="mx-auto mb-4 h-10 w-10 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'researcher')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
