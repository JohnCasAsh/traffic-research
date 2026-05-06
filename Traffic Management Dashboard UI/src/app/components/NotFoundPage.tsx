import { Link } from 'react-router';
import { Navigation, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 w-16 h-16 bg-gradient-to-br from-teal-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
          <Navigation className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-7xl font-bold text-slate-900 mb-2">404</h1>
        <p className="text-xl font-semibold text-slate-700 mb-2">Page not found</p>
        <p className="text-slate-500 text-sm mb-8">
          The route you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
