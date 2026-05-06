import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Navigation, Mail, Lock, User, ArrowRight, Car } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_URL } from '../api';
import { useAuth } from '../auth';

export function SignUpPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const role = 'driver';
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/profile', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    if (form.password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'OAUTH_ACCOUNT_EXISTS') {
          throw new Error(
            data?.error ||
              'This account has been created using Google or GitHub. Please return to login and use the sign-in button for your provider.'
          );
        }

        if (data?.code === 'EMAIL_ALREADY_EXISTS') {
          throw new Error(data?.error || 'An account with this email already exists. Please sign in instead.');
        }

        throw new Error(data?.error || 'Signup failed');
      }
      if (data.requiresEmailVerification) {
        const email = encodeURIComponent(form.email);
        navigate(`/login?checkEmail=1&email=${email}`);
        return;
      }
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row-reverse">
      {/* Right side - Image & Branding */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 relative overflow-hidden md:sticky md:top-0 md:h-screen">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1771834900973-6f056e20280d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMHRlY2glMjBncmlkJTIwYmx1ZXxlbnwxfHx8fDE3NzMyMDIzOTZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Abstract Tech Grid"
            className="w-full h-full object-cover opacity-50 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-blue-900 via-slate-900/80 to-teal-900/50"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full h-full">
          <div className="flex justify-end">
            <Link to="/" className="flex items-center space-x-3">
              <span className="text-2xl font-bold text-white tracking-tight">Navocs</span>
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Navigation className="w-7 h-7 text-white" />
              </div>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md ml-auto text-right"
          >
            <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
              Join the future of route optimization.
            </h1>
            <p className="text-lg text-slate-300 mb-8">
              Whether you're a commuter looking to save on fuel, or a researcher analyzing traffic patterns, Navocs is built for you.
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
                <div className="text-teal-400 font-bold text-2xl mb-1">30%</div>
                <div className="text-slate-300 text-sm">Average cost savings on daily commutes</div>
              </div>
              <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
                <div className="text-blue-400 font-bold text-2xl mb-1">50k+</div>
                <div className="text-slate-300 text-sm">Routes optimized for energy efficiency</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Left side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-24 bg-white relative md:overflow-y-auto md:h-screen">
        <div className="absolute top-6 left-6 md:hidden">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Navocs</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-md pt-8 md:pt-0"
        >
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h2>
            <p className="text-slate-500">Start optimizing your routes today</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-6">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-slate-900"
                    placeholder="Jane"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm(f => ({ ...f, lastName: e.target.value }))}
                  className="block w-full px-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-slate-900"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-slate-900"
                  placeholder="jane.doe@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-slate-900"
                  placeholder="Create a strong password"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-slate-900 ${
                    confirmPassword && confirmPassword !== form.password
                      ? 'border-red-400'
                      : 'border-slate-200'
                  }`}
                  placeholder="Re-enter your password"
                />
              </div>
              <p className={`mt-1 text-sm h-5 ${confirmPassword && confirmPassword !== form.password ? 'text-red-600' : 'text-transparent'}`}>
                {confirmPassword && confirmPassword !== form.password ? 'Passwords do not match' : '\u00A0'}
              </p>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  required
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-slate-600">
                  I agree to the{' '}
                  <a href="#" className="font-medium text-teal-600 hover:text-teal-500">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="font-medium text-teal-600 hover:text-teal-500">Privacy Policy</a>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  Create Account
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-teal-600 hover:text-teal-500 transition-colors">
              Sign in instead
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}