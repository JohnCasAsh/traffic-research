import { Outlet, Link, useLocation } from 'react-router';
import { Navigation, MapPin, BarChart3, Route } from 'lucide-react';

export function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="font-bold text-slate-900">SmartRoute</div>
                <div className="text-xs text-slate-500">Energy & Cost Optimizer</div>
              </div>
            </Link>

            {!isLanding && (
              <div className="hidden md:flex items-center space-x-1">
                <NavLink to="/dashboard" icon={<MapPin className="w-4 h-4" />}>
                  Dashboard
                </NavLink>
                <NavLink to="/routes" icon={<Route className="w-4 h-4" />}>
                  Routes
                </NavLink>
                <NavLink to="/analytics" icon={<BarChart3 className="w-4 h-4" />}>
                  Analytics
                </NavLink>
              </div>
            )}

            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="hidden sm:block text-slate-600 hover:text-teal-600 font-medium transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-6 py-2 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-lg hover:shadow-lg hover:scale-105 transition-all font-medium text-sm"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {!isLanding && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="flex justify-around py-2">
              <MobileNavLink to="/dashboard" icon={<MapPin className="w-5 h-5" />}>
                Dashboard
              </MobileNavLink>
              <MobileNavLink to="/routes" icon={<Route className="w-5 h-5" />}>
                Routes
              </MobileNavLink>
              <MobileNavLink to="/analytics" icon={<BarChart3 className="w-5 h-5" />}>
                Analytics
              </MobileNavLink>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-white">SmartRoute</span>
              </div>
              <p className="text-sm text-slate-400 max-w-md">
                Advanced traffic management system for energy-efficient and cost-effective route optimization.
                Making sustainable transportation decisions easier.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/dashboard" className="hover:text-teal-400 transition-colors">Dashboard</Link></li>
                <li><Link to="/routes" className="hover:text-teal-400 transition-colors">Route Comparison</Link></li>
                <li><Link to="/analytics" className="hover:text-teal-400 transition-colors">Analytics</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Research</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-teal-400 transition-colors">Methodology</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Publications</a></li>
                <li><a href="#" className="hover:text-teal-400 transition-colors">Case Studies</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 mt-8 pt-6 text-center text-sm text-slate-500">
            © 2026 SmartRoute. Traffic Management System Research Prototype.
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-teal-50 text-teal-600'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{children}</span>
    </Link>
  );
}

function MobileNavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex flex-col items-center space-y-1 px-3 py-1 rounded-lg transition-colors ${
        isActive ? 'text-teal-600' : 'text-slate-500'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{children}</span>
    </Link>
  );
}
