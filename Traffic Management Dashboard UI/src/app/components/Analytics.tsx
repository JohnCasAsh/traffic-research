import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Download, Copy, FlaskConical, Trash2 } from 'lucide-react';
import { AssistantPanel } from './AssistantPanel';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

type StatsResult = {
  n: number;
  message?: string;
  meanBaseline?: number;
  meanNavocs?: number;
  meanSavings?: number;
  meanSavingsPct?: number;
  normality?: { W: number; p: number; isNormal: boolean };
  test?: { name: string; statistic: number; p: number; significant: boolean };
  effectSize?: { name: string; value: number; magnitude: string };
  ci95?: { low: number; high: number };
};

export function Analytics() {
  const { token } = useAuth();
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(true);
  const [stats, setStats] = useState<StatsResult | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!token) return;
    setChatLoading(true);
    fetch(`${API_URL}/api/auth/chat-token`, { headers: buildAuthHeaders(token) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setChatUrl(data.url))
      .catch(() => setChatUrl(null))
      .finally(() => setChatLoading(false));
  }, [token]);

  const loadStats = (tok: string | null) => {
    if (!tok) return;
    setStatsLoading(true);
    fetch(`${API_URL}/api/stats/analysis`, { headers: buildAuthHeaders(tok) })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  };

  useEffect(() => { loadStats(token); }, [token]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex">
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Research Analytics</h1>
            <p className="text-slate-600">
              Statistical analysis of Navocs eco-routing vs. Google Routes API default recommendations
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-teal-50 rounded-lg p-2">
                <FlaskConical className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Statistical Significance</h2>
                <p className="text-xs text-slate-500">Navocs vs Google Routes API — paired cost comparison</p>
              </div>
            </div>

            {statsLoading ? (
              <div className="flex items-center gap-2 text-slate-400 py-6 justify-center">
                <div className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Running analysis…</span>
              </div>
            ) : !stats || stats.n < 3 ? (
              <div className="text-center py-12">
                <FlaskConical className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm">{stats?.message ?? 'Not enough data yet.'}</p>
                <p className="text-slate-400 text-xs mt-1">
                  Use the Routes page to analyze trips. Statistical analysis populates once at least 3 trips are recorded.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatPill label="Sample size (n)" value={String(stats.n)} />
                  <StatPill label="Mean savings" value={`₱${stats.meanSavings?.toFixed(2)}`} />
                  <StatPill label="Savings %" value={`${stats.meanSavingsPct?.toFixed(1)}%`} accent="green" />
                  <StatPill label="95% CI" value={`₱${stats.ci95?.low} – ₱${stats.ci95?.high}`} />
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Normality (Shapiro-Wilk)</p>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="text-slate-700">W = <strong>{stats.normality?.W}</strong></span>
                    <span className="text-slate-700">p = <strong>{stats.normality?.p}</strong></span>
                    <span className={`font-medium ${stats.normality?.isNormal ? 'text-green-600' : 'text-orange-600'}`}>
                      {stats.normality?.isNormal ? '✓ Normal' : '✗ Non-normal'}
                    </span>
                    <span className="text-slate-500 text-xs self-center">→ using {stats.test?.name}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{stats.test?.name}</p>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-slate-700">statistic = <strong>{stats.test?.statistic}</strong></span>
                    <span className="text-slate-700">p-value = <strong>{stats.test?.p}</strong></span>
                    {stats.test?.significant ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        ✅ Significant (p &lt; 0.05)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                        ❌ Not significant (p ≥ 0.05)
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 rounded-lg p-4 space-y-1">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Effect Size</p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-700">{stats.effectSize?.name} = <strong>{stats.effectSize?.value}</strong></span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      stats.effectSize?.magnitude === 'Large' ? 'bg-teal-100 text-teal-700' :
                      stats.effectSize?.magnitude === 'Medium' ? 'bg-blue-100 text-blue-700' :
                      'bg-slate-200 text-slate-600'
                    }`}>
                      {stats.effectSize?.magnitude}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    onClick={() => {
                      if (!token) return;
                      fetch(`${API_URL}/api/stats/export-csv`, { headers: buildAuthHeaders(token) })
                        .then(r => r.ok ? r.blob() : Promise.reject())
                        .then(blob => {
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = 'navocs-trip-analysis.csv'; a.click();
                          URL.revokeObjectURL(url);
                        }).catch(() => {});
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => {
                      const sentence = buildThesisSentence(stats);
                      navigator.clipboard.writeText(sentence).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      });
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Copied!' : 'Copy thesis sentence'}
                  </button>
                  <button
                    onClick={() => {
                      if (!token || !window.confirm('Clear all your saved trip data? This cannot be undone.')) return;
                      setClearing(true);
                      fetch(`${API_URL}/api/stats/clear`, { method: 'DELETE', headers: buildAuthHeaders(token) })
                        .then(() => { setStats(null); loadStats(token); })
                        .catch(() => {})
                        .finally(() => setClearing(false));
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {clearing ? 'Clearing…' : 'Clear my data'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
      <AssistantPanel chatUrl={chatUrl} chatLoading={chatLoading} />
    </div>
  );
}

function buildThesisSentence(stats: StatsResult): string {
  if (!stats.test || !stats.effectSize || !stats.ci95) return '';
  const pVal = stats.test.p < 0.0001 ? '< 0.0001' : stats.test.p.toFixed(4);
  return `The Navocs eco-routing engine reduced fuel cost by an average of ₱${stats.meanSavings?.toFixed(2)} per trip (${stats.meanSavingsPct?.toFixed(1)}%) relative to the Google Routes API default recommendation. A ${stats.test.name} confirmed this difference was statistically significant (p = ${pVal}, α = 0.05). Effect size was ${stats.effectSize.magnitude.toLowerCase()} (${stats.effectSize.name} = ${stats.effectSize.value}), and the 95% confidence interval for mean savings was [₱${stats.ci95.low}, ₱${stats.ci95.high}].`;
}

function StatPill({ label, value, accent }: { label: string; value: string; accent?: 'green' }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-sm font-bold ${accent === 'green' ? 'text-green-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}
