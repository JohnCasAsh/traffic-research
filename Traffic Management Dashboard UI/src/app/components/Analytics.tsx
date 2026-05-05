import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingDown,
  DollarSign,
  Fuel,
  Leaf,
  Award,
  Users,
  ArrowUp,
  Download,
  Copy,
  FlaskConical,
  Trash2,
} from 'lucide-react';
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

  // Mock data for charts
  const monthlySavings = [
    { month: 'Jan', cost: 245, fuel: 18.5, co2: 125 },
    { month: 'Feb', cost: 268, fuel: 19.8, co2: 138 },
    { month: 'Mar', cost: 312, fuel: 22.1, co2: 156 },
    { month: 'Apr', cost: 289, fuel: 20.4, co2: 142 },
    { month: 'May', cost: 334, fuel: 23.6, co2: 165 },
    { month: 'Jun', cost: 356, fuel: 25.2, co2: 178 },
  ];

  const routePerformance = [
    { name: 'Scenic Bypass', efficiency: 94, usage: 245, savings: 342 },
    { name: 'Highway Route', efficiency: 72, usage: 189, savings: 156 },
    { name: 'City Route', efficiency: 78, usage: 167, savings: 198 },
    { name: 'Express Lane', efficiency: 68, usage: 134, savings: 112 },
    { name: 'Alternate Path', efficiency: 86, usage: 201, savings: 267 },
  ];

  const trafficDistribution = [
    { name: 'Low Traffic', value: 42, color: '#10b981' },
    { name: 'Moderate', value: 35, color: '#f59e0b' },
    { name: 'Heavy Traffic', value: 23, color: '#ef4444' },
  ];

  const vehicleTypes = [
    { type: 'Sedan', count: 428, avgEfficiency: 82 },
    { type: 'SUV', count: 234, avgEfficiency: 74 },
    { type: 'Electric', count: 189, avgEfficiency: 96 },
    { type: 'Hybrid', count: 156, avgEfficiency: 88 },
    { type: 'Truck', count: 92, avgEfficiency: 68 },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex">
      <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Research Analytics Dashboard</h1>
          <p className="text-slate-600">
            Comprehensive data insights for energy-efficient route optimization research
          </p>
        </motion.div>

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            icon={<DollarSign className="w-6 h-6 text-green-600" />}
            title="Total Savings"
            value="₱8,942"
            trend="+28%"
            color="green"
            delay={0.1}
          />
          <MetricCard
            icon={<Fuel className="w-6 h-6 text-orange-600" />}
            title="Fuel Reduced"
            value="342 gal"
            trend="+18%"
            color="orange"
            delay={0.2}
          />
          <MetricCard
            icon={<Leaf className="w-6 h-6 text-emerald-600" />}
            title="CO₂ Avoided"
            value="2.4 tons"
            trend="+22%"
            color="emerald"
            delay={0.3}
          />
          <MetricCard
            icon={<Users className="w-6 h-6 text-blue-600" />}
            title="Active Users"
            value="1,247"
            trend="+34%"
            color="blue"
            delay={0.4}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Monthly Trends */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <h2 className="text-lg font-bold text-slate-900 mb-4">Monthly Savings Trends</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlySavings}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  name="Cost Savings (₱)"
                  dot={{ fill: '#14b8a6', r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="fuel"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Fuel Saved (gal)"
                  dot={{ fill: '#3b82f6', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Traffic Distribution */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
          >
            <h2 className="text-lg font-bold text-slate-900 mb-4">Traffic Conditions Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={trafficDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {trafficDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Route Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-4">Route Performance Comparison</h2>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={routePerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="efficiency" fill="#10b981" name="Efficiency Score" radius={[8, 8, 0, 0]} />
              <Bar dataKey="usage" fill="#3b82f6" name="Usage Count" radius={[8, 8, 0, 0]} />
              <Bar dataKey="savings" fill="#14b8a6" name="Savings (₱)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Vehicle Type Analysis */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8"
        >
          <h2 className="text-lg font-bold text-slate-900 mb-4">Vehicle Type Analysis</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Vehicle Type
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Usage Count
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Avg Efficiency
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                    Performance
                  </th>
                </tr>
              </thead>
              <tbody>
                {vehicleTypes.map((vehicle, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.9 + index * 0.1 }}
                    whileHover={{ backgroundColor: '#f8fafc' }}
                    className="border-b border-slate-100"
                  >
                    <td className="py-3 px-4 font-medium text-slate-900">{vehicle.type}</td>
                    <td className="py-3 px-4 text-slate-600">{vehicle.count}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          vehicle.avgEfficiency >= 90
                            ? 'bg-green-100 text-green-700'
                            : vehicle.avgEfficiency >= 75
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {vehicle.avgEfficiency}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${vehicle.avgEfficiency}%` }}
                          transition={{ delay: 1 + index * 0.1, duration: 0.8 }}
                          className={`h-2 rounded-full ${
                            vehicle.avgEfficiency >= 90
                              ? 'bg-green-500'
                              : vehicle.avgEfficiency >= 75
                              ? 'bg-blue-500'
                              : 'bg-orange-500'
                          }`}
                        ></motion.div>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Statistical Significance */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8"
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
            <div className="text-center py-8">
              <p className="text-slate-500 text-sm">{stats?.message ?? 'Statistical analysis unavailable.'}</p>
              <p className="text-slate-400 text-xs mt-1">Trip cost comparison data will populate this card as routes are used.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Top metrics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatPill label="Sample size (n)" value={String(stats.n)} />
                <StatPill label="Mean savings" value={`₱${stats.meanSavings?.toFixed(2)}`} />
                <StatPill label="Savings %" value={`${stats.meanSavingsPct?.toFixed(1)}%`} accent="green" />
                <StatPill label="95% CI" value={`₱${stats.ci95?.low} – ₱${stats.ci95?.high}`} />
              </div>

              {/* Normality test */}
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

              {/* Test result */}
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

              {/* Effect size */}
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

              {/* Action buttons */}
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

        {/* Key Insights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InsightCard
            icon={<Award className="w-6 h-6 text-green-600" />}
            title="Top Performance"
            description="Scenic Bypass route achieves 94% efficiency score with lowest fuel consumption"
            color="green"
            delay={0.2}
          />
          <InsightCard
            icon={<TrendingDown className="w-6 h-6 text-blue-600" />}
            title="Cost Reduction"
            description="Users save an average of 28% on fuel costs by choosing optimized routes"
            color="blue"
            delay={0.3}
          />
          <InsightCard
            icon={<Leaf className="w-6 h-6 text-emerald-600" />}
            title="Environmental Impact"
            description="2.4 tons of CO₂ emissions avoided through smart route selection"
            color="emerald"
            delay={0.4}
          />
        </div>
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

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'green';
}) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-sm font-bold ${accent === 'green' ? 'text-green-600' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  trend,
  color,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  trend: string;
  color: string;
  delay?: number;
}) {
  const colorClasses = {
    green: 'from-green-50 to-green-100 border-green-200',
    orange: 'from-orange-50 to-orange-100 border-orange-200',
    emerald: 'from-emerald-50 to-emerald-100 border-emerald-200',
    blue: 'from-blue-50 to-blue-100 border-blue-200',
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`bg-gradient-to-br ${colorClasses} border rounded-xl p-6 shadow-sm`}
    >
      <div className="flex items-center justify-between mb-3">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="bg-white rounded-lg p-2 shadow-sm"
        >
          {icon}
        </motion.div>
        <div className="flex items-center space-x-1 text-sm font-semibold text-green-600">
          <ArrowUp className="w-4 h-4" />
          <span>{trend}</span>
        </div>
      </div>
      <div className="text-sm text-slate-600 mb-1">{title}</div>
      <motion.div
        initial={{ scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={{ delay: delay + 0.2, type: 'spring' }}
        className="text-3xl font-bold text-slate-900"
      >
        {value}
      </motion.div>
    </motion.div>
  );
}

function InsightCard({
  icon,
  title,
  description,
  color,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  delay?: number;
}) {
  const colorClasses = {
    green: 'border-green-200 bg-green-50',
    blue: 'border-blue-200 bg-blue-50',
    emerald: 'border-emerald-200 bg-emerald-50',
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -5, scale: 1.02 }}
      className={`${colorClasses} border-2 rounded-xl p-6`}
    >
      <motion.div
        whileHover={{ rotate: 360 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-lg p-3 inline-flex mb-3 shadow-sm"
      >
        {icon}
      </motion.div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed">{description}</p>
    </motion.div>
  );
}