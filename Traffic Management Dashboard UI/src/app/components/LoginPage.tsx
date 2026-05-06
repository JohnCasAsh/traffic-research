import { Link, useNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import { Navigation, Mail, Lock, ArrowRight, Github, Chrome } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_URL } from '../api';
import { useAuth } from '../auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oauth = searchParams.get('oauth');
  const oauthProvider = searchParams.get('provider');
  const oauthReason = searchParams.get('reason');
  const oauthUserId = searchParams.get('userId');
  const oauthFirstName = searchParams.get('firstName');
  const oauthLastName = searchParams.get('lastName');
  const oauthRole = searchParams.get('role');
  const oauthToken = searchParams.get('token');
  const verified = searchParams.get('verified');
  const checkEmail = searchParams.get('checkEmail');
  const suspended = searchParams.get('suspended');
  const emailHint = searchParams.get('email');
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const verifyReason = searchParams.get('reason');
  const { isAuthenticated, login } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<'github' | 'google' | null>(null);
  const [error, setError] = useState('');
  const [resendMessage, setResendMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [form, setForm] = useState({ email: emailHint || '', password: '' });

  useEffect(() => {
    if (oauth === 'success' && oauthToken && oauthUserId) {
      login(oauthToken, {
        id: oauthUserId,
        email: '',
        firstName: oauthFirstName || 'User',
        lastName: oauthLastName || '',
        role: oauthRole || 'driver',
        profilePictureUrl: '',
        address: {
          country: '',
          province: '',
          city: '',
          barangay: '',
          street: '',
          houseNumber: '',
          postalCode: '',
        },
        authProviders: oauthProvider ? [oauthProvider] : [],
        hasPassword: false,
        emailVerified: true,
      });
      navigate(redirectTo, { replace: true });
      return;
    }

    if (isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [
    isAuthenticated,
    login,
    navigate,
    oauth,
    oauthFirstName,
    oauthLastName,
    oauthProvider,
    oauthRole,
    oauthToken,
    oauthUserId,
    redirectTo,
  ]);

  const oauthProviderLabel = oauthProvider === 'google'
    ? 'Google'
    : oauthProvider === 'github'
      ? 'GitHub'
      : 'OAuth';

  const oauthErrorText = oauth === 'error'
    ? oauthReason === 'provider_denied'
      ? `${oauthProviderLabel} sign-in was cancelled.`
      : oauthReason === 'oauth_not_configured'
        ? `${oauthProviderLabel} sign-in is not configured yet.`
        : oauthReason === 'invalid_state'
          ? 'Sign-in session expired. Please try again.'
          : oauthReason === 'missing_code'
            ? `${oauthProviderLabel} sign-in failed: missing authorization code.`
            : oauthReason === 'no_verified_email'
              ? `${oauthProviderLabel} account does not have a verified email.`
              : oauthReason === 'password_account_exists'
                ? `This account was created using email and password. Please return to login and sign in with your password — not ${oauthProviderLabel}.`
                : `${oauthProviderLabel} sign-in failed. Please try again.`
    : null;

  const notice = suspended === '1'
    ? { type: 'error' as const, text: 'Your account has been suspended. Please contact support.' }
    : oauthErrorText
      ? { type: 'error' as const, text: oauthErrorText }
      : verified === '1'
        ? { type: 'success' as const, text: 'Email verified. You can sign in now.' }
        : checkEmail === '1'
          ? {
            type: 'info' as const,
            text: `Check your inbox${emailHint ? ` (${emailHint})` : ''} for a verification link.`,
          }
          : verifyReason === 'expired_token'
            ? { type: 'error' as const, text: 'Verification link expired. Please request a new verification email.' }
            : verifyReason === 'invalid_token'
              ? { type: 'error' as const, text: 'Verification link is invalid. Please request a new one.' }
              : null;

  const startOAuth = async (provider: 'google' | 'github') => {
    setOauthLoadingProvider(provider);
    setError('');
    try {
      const startUrl = new URL(`${API_URL}/api/auth/oauth/${provider}/start`);
      startUrl.searchParams.set('format', 'json');
      startUrl.searchParams.set('frontendOrigin', window.location.origin);

      const response = await fetch(startUrl.toString());
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || 'Unable to start social sign-in right now.');
      }

      window.location.href = payload.url;
    } catch (err: any) {
      setOauthLoadingProvider(null);
      setError(err?.message || 'Unable to start social sign-in right now.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setResendMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok && data?.code === 'EMAIL_NOT_VERIFIED') {
        setResendMessage({
          type: 'info',
          text: 'Your account is not verified yet. Click resend to get a new verification email.',
        });
      }
      if (!res.ok) throw new Error(data.error || 'Login failed');
      if (!data?.token || !data?.user) {
        throw new Error('Login response is incomplete.');
      }
      login(data.token, data.user);
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!form.email.trim()) {
      setResendMessage({
        type: 'error',
        text: 'Enter your email address first.',
      });
      return;
    }

    setIsResending(true);
    setResendMessage(null);
    try {
      const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Unable to resend verification email.');
      }

      setResendMessage({
        type: 'success',
        text: data.message || 'Verification email sent. Please check your inbox.',
      });
    } catch (err: any) {
      setResendMessage({
        type: 'error',
        text: err.message || 'Unable to resend verification email.',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Left side - Image & Branding */}
      <div className="hidden md:flex md:w-1/2 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1760386128692-81476422e599?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzbWFydCUyMGNpdHklMjBtb2JpbGl0eSUyMG5pZ2h0fGVufDF8fHx8MTc3MzIwMjM5Nnww&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Smart City Mobility"
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full h-full">
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30">
              <Navigation className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Navocs</span>
          </Link>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md"
          >
            <h1 className="text-4xl font-bold text-white mb-6 leading-tight">
              Welcome back to smarter mobility.
            </h1>
            <p className="text-lg text-slate-300 mb-8">
              Access your personalized dashboard, track your carbon savings, and optimize your daily routes with advanced analytics.
            </p>
            
            <div className="flex items-center space-x-4 text-sm text-slate-400">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                    <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="User avatar" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <span>Join 10,000+ researchers and drivers</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-24 bg-white relative">
        <div className="absolute top-6 left-6 md:hidden">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900">Navocs</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto w-full max-w-sm"
        >
          <div className="mb-10 text-center md:text-left">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Sign in</h2>
            <p className="text-slate-500">Enter your details to access your dashboard</p>
          </div>

          {notice && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                notice.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : notice.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700'
              }`}
            >
              {notice.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
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
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-slate-900 transition-colors"
                    placeholder="researcher@university.edu"
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
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-slate-50 text-slate-900 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-slate-300 rounded cursor-pointer"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 cursor-pointer">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to={form.email.trim()
                    ? `/password-recovery?email=${encodeURIComponent(form.email.trim())}`
                    : '/password-recovery'}
                  className="font-medium text-teal-600 hover:text-teal-500 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-600">Didn&apos;t receive or lost your verification email?</p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="mt-2 text-sm font-medium text-teal-600 hover:text-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResending ? 'Resending...' : 'Resend verification email'}
              </button>
              {resendMessage && (
                <p className={`mt-2 text-sm ${
                  resendMessage.type === 'success'
                    ? 'text-emerald-700'
                    : resendMessage.type === 'error'
                      ? 'text-red-600'
                      : 'text-blue-700'
                }`}
                >
                  {resendMessage.text}
                </p>
              )}
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
                  Sign in
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => startOAuth('github')}
                disabled={oauthLoadingProvider !== null}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-200 rounded-xl shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Github className="w-5 h-5 mr-2" />
                {oauthLoadingProvider === 'github' ? 'Connecting...' : 'GitHub'}
              </button>
              <button
                type="button"
                onClick={() => startOAuth('google')}
                disabled={oauthLoadingProvider !== null}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-slate-200 rounded-xl shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Chrome className="w-5 h-5 mr-2 text-blue-500" />
                {oauthLoadingProvider === 'google' ? 'Connecting...' : 'Google'}
              </button>
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-teal-600 hover:text-teal-500 transition-colors">
              Sign up for free
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}