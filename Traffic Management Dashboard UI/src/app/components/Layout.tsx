import { Outlet, Link, useLocation } from 'react-router';
import { Navigation, MapPin, BarChart3, Route, LogOut, UserRound, Gauge, Shield } from 'lucide-react';
import { motion, useScroll } from 'motion/react';
import { useState, useEffect } from 'react';
import { useAuth, type AuthUser } from '../auth';
import { ChatBubble } from './ChatBubble';

export function Layout() {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const { isAuthenticated, logout, user } = useAuth();
  const { scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
  const accountDisplayName = [user?.firstName?.trim(), user?.lastName?.trim()]
    .filter(Boolean)
    .join(' ') || user?.email || 'Profile';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navigation Bar */}
      <nav className={`relative sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-lg'
          : 'bg-white border-b border-slate-200 shadow-sm'
      }`}>
        {/* Scroll Progress Bar */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 via-blue-500 to-teal-400 origin-left"
          style={{ scaleX: scrollYProgress }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <motion.div
                whileHover={{ rotate: 15, scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-10 h-10 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center"
              >
                <Navigation className="w-6 h-6 text-white" />
              </motion.div>
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
                {(user?.role === 'admin' || user?.role === 'researcher') && (
                  <NavLink to="/analytics" icon={<BarChart3 className="w-4 h-4" />}>
                    Analytics
                  </NavLink>
                )}
                <NavLink to="/speed-meter" icon={<Gauge className="w-4 h-4" />}>
                  Speed Meter
                </NavLink>
                <NavLink to="/profile" icon={<UserRound className="w-4 h-4" />}>
                  Profile
                </NavLink>
                {user?.role === 'admin' && (
                  <NavLink to="/admin" icon={<Shield className="w-4 h-4" />}>
                    Admin
                  </NavLink>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-3">
                  <Link
                    to="/profile"
                    className="inline-flex items-center gap-2 text-slate-700 transition hover:text-teal-600"
                  >
                    <ProfileAvatar user={user} />
                    <span className="hidden max-w-[180px] truncate text-sm font-medium sm:inline">
                      {accountDisplayName}
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-teal-600"
                    aria-label="Log out"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Log out</span>
                  </button>
                </div>
              ) : (
                <>
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
                </>
              )}
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
              {(user?.role === 'admin' || user?.role === 'researcher') && (
                <MobileNavLink to="/analytics" icon={<BarChart3 className="w-5 h-5" />}>
                  Analytics
                </MobileNavLink>
              )}
              <MobileNavLink to="/speed-meter" icon={<Gauge className="w-5 h-5" />}>
                Speed
              </MobileNavLink>
              <MobileNavLink to="/profile" icon={<UserRound className="w-5 h-5" />}>
                Profile
              </MobileNavLink>
              {user?.role === 'admin' && (
                <MobileNavLink to="/admin" icon={<Shield className="w-5 h-5" />}>
                  Admin
                </MobileNavLink>
              )}
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
                <li><Link to="/speed-meter" className="hover:text-teal-400 transition-colors">Speed Meter</Link></li>
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

      {/* Floating Chat Bubble — only on pages without a built-in assistant sidebar */}
      {isAuthenticated && !['/dashboard', '/routes', '/analytics', '/speed-meter', '/profile', '/about'].some(p => location.pathname.startsWith(p)) && <ChatBubble />}
    </div>
  );
}

function NavLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`relative flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
        isActive
          ? 'bg-teal-50 text-teal-600'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{children}</span>
      {isActive && (
        <motion.div
          layoutId="nav-active-indicator"
          className="absolute bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-teal-500 to-blue-500"
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
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

function ProfileAvatar({ user }: { user: AuthUser }) {
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim().toUpperCase() || 'U';

  if (user.profilePictureUrl) {
    return (
      <img
        src={user.profilePictureUrl}
        alt="Profile"
        className="h-9 w-9 rounded-lg object-cover border border-slate-200"
      />
    );
  }

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-blue-600 text-sm font-bold text-white shadow-sm">
      {initials}
    </div>
  );
}
