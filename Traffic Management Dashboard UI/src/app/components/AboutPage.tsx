import { motion } from 'motion/react';
import { Navigation, FlaskConical, Cpu, Car, Zap, GitBranch, Database, MapPin, BarChart3, Shield } from 'lucide-react';

const vehicles = [
  { name: 'Tricycle', type: 'ICE', model: 'VSP fuel model', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { name: 'Motorcycle', type: 'ICE', model: 'VSP fuel model', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { name: 'Private Car', type: 'ICE', model: 'VSP fuel model', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { name: 'Hybrid Car', type: 'HEV', model: 'Dual-mode cost function', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { name: 'E-Trike', type: 'BEV', model: 'Energy model + SoC', color: 'bg-green-50 text-green-700 border-green-200' },
  { name: 'E-Motorcycle', type: 'BEV', model: 'Energy model + SoC', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

const gpsFactors = [
  {
    title: 'GPS Speed (Chipset Native)',
    color: 'bg-emerald-50 border-emerald-200',
    body: "Your phone's GPS chip reports speed directly using Doppler shift of satellite signals. Navocs displays that reading with a Kalman filter to smooth out jitter, but doesn't reject or recompute anything — just uses what the GPS API provides.",
  },
  {
    title: 'Kalman Filter (Smoothing Only)',
    color: 'bg-blue-50 border-blue-200',
    body: 'Every new GPS speed reading is blended with the previous estimate based on how different they are. Gradual acceleration ripples through cleanly; sudden spikes get dampened. No samples are ever skipped.',
  },
  {
    title: 'Stationary Lock',
    color: 'bg-violet-50 border-violet-200',
    body: 'After a few seconds of near-zero speed and minimal movement, the display snaps to 0 to avoid residual jitter from GPS noise. Once you start moving clearly, the speed immediately rises from zero.',
  },
  {
    title: 'Accuracy Circle',
    color: 'bg-amber-50 border-amber-200',
    body: 'Your location accuracy (the GPS uncertainty radius) is shown in the badge. Smaller is better. The accuracy threshold is different for indoors vs outdoors — use the Environment toggle to match your situation.',
  },
  {
    title: 'Multipath (Near Buildings)',
    color: 'bg-red-50 border-red-200',
    body: 'Near buildings, GPS signals bounce off walls and arrive late — the chip interprets this as a sudden position jump and reports a falsely high speed. Switch to Outdoors mode and Stable filter to reject these spikes before they reach the display.',
  },
  {
    title: 'Indoors Limitations',
    color: 'bg-teal-50 border-teal-200',
    body: 'Indoors, GPS rarely locks onto satellites and accuracy degrades to 30–50 m. The app relaxes its accuracy gate so you still get readings, but speed values will be noisier. For best results, walk near a window or step outside.',
  },
];

const stack = [
  { icon: <Cpu className="w-5 h-5" />, label: 'Frontend', value: 'React + TypeScript', color: 'bg-blue-50 text-blue-600' },
  { icon: <GitBranch className="w-5 h-5" />, label: 'Backend', value: 'Node.js + Express', color: 'bg-green-50 text-green-600' },
  { icon: <Database className="w-5 h-5" />, label: 'Database', value: 'PostgreSQL + PostGIS', color: 'bg-purple-50 text-purple-600' },
  { icon: <MapPin className="w-5 h-5" />, label: 'Map Data', value: 'OpenStreetMap', color: 'bg-amber-50 text-amber-600' },
  { icon: <BarChart3 className="w-5 h-5" />, label: 'GPS Data', value: 'navocs.com (Doppler + Kalman)', color: 'bg-teal-50 text-teal-600' },
  { icon: <Shield className="w-5 h-5" />, label: 'Cloud', value: 'Azure App Service + Static Web Apps', color: 'bg-slate-50 text-slate-600' },
];

const gaps = [
  'No eco-routing system exists for Philippine provincial cities',
  'No routing optimized for tricycle fuel profiles (ICE or EV)',
  'No cross-powertrain cost comparison tool for local commuters',
  'No VSP model calibrated for Filipino vehicle behavior',
  'No routing system aligned with RA 11697 (PH EV Law — 2.45M EVs by 2028)',
];

export function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">

      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-start gap-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Navigation className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold">Navocs</div>
                <div className="text-sm text-slate-400">Energy & Cost Optimizer</div>
              </div>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold leading-tight max-w-2xl">
              Energy-Aware Multi-Modal Route Optimization for Urban Commuters
            </h1>
            <p className="text-slate-300 max-w-xl text-base leading-relaxed">
              A thesis research system built for Tuguegarao City, Cagayan, Philippines.
              Navocs finds the most fuel-efficient and cost-effective route — not just the fastest or shortest.
            </p>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20">BS Computer Science</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20">University of Saint Louis Tuguegarao</span>
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20">2026</span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">

        {/* Core Claim */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-4">Core Research Claim</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <p className="text-amber-800 font-semibold text-sm mb-1">The fastest route</p>
              <p className="text-amber-700 text-sm">is not always the cheapest.</p>
            </div>
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-5">
              <p className="text-teal-800 font-semibold text-sm mb-1">The shortest route</p>
              <p className="text-teal-700 text-sm">is not always the most fuel-efficient.</p>
            </div>
          </div>
          <p className="mt-5 text-slate-600 text-sm leading-relaxed">
            Navocs uses a <strong>Modified A* algorithm</strong> with an energy-aware edge cost function to recommend
            the route with the best balance of time, fuel cost, traffic delay, and speed stability — tunable per user.
          </p>
        </motion.section>

        {/* Algorithm */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">The Algorithm</h2>
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Edge Cost Function</p>
              <div className="bg-slate-900 rounded-xl px-5 py-4 font-mono text-sm text-teal-300">
                C(e) = w₁·T(e) + w₂·F(e) + w₃·D(e) + w₄·S(e)
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mt-3 text-sm text-slate-600">
                <span><strong className="text-slate-800">T(e)</strong> — Travel time on edge</span>
                <span><strong className="text-slate-800">F(e)</strong> — Fuel / energy consumption (VSP)</span>
                <span><strong className="text-slate-800">D(e)</strong> — Traffic delay penalty (time-of-day)</span>
                <span><strong className="text-slate-800">S(e)</strong> — Speed stability score</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">w₁–w₄ are user-adjustable weights.</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">VSP Formula — ICE Vehicles</p>
              <div className="bg-slate-900 rounded-xl px-5 py-4 font-mono text-sm text-amber-300">
                VSP = v·(1.1a + 9.81·grade + 0.132) + 0.000302·v³
              </div>
              <p className="mt-2 text-xs text-slate-500">v = speed (m/s) · a = acceleration (m/s²) · grade = road gradient</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">EV Energy Model</p>
              <div className="bg-slate-900 rounded-xl px-5 py-4 font-mono text-sm text-green-300">
                E(e) = (m·g·Cᵣ·d + ½·ρ·Cᵈ·A·v²·d + m·a·d) / η
              </div>
            </div>
          </div>
        </motion.section>

        {/* Vehicle Profiles */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <Car className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Supported Vehicle Profiles</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehicles.map((v) => (
              <div key={v.name} className={`rounded-xl border p-4 ${v.color}`}>
                <div className="font-semibold text-sm mb-1">{v.name}</div>
                <div className="text-xs opacity-75 mb-2">{v.type}</div>
                <div className="text-xs">{v.model}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Research Gaps */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Research Gaps This Fills</h2>
          </div>
          <ul className="space-y-3">
            {gaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                {gap}
              </li>
            ))}
          </ul>
        </motion.section>

        {/* Tech Stack */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-6">Technology Stack</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stack.map((s) => (
              <div key={s.label} className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
                  {s.icon}
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">{s.label}</p>
                  <p className="text-sm font-semibold text-slate-800">{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* GPS Accuracy Explainer */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.33 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-violet-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Why is Speed Sometimes Inaccurate?</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Understanding these six factors helps you collect clean GPS data for thesis validation.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gpsFactors.map(({ title, color, body }) => (
              <div key={title} className={`rounded-xl border p-4 ${color}`}>
                <div className="font-semibold text-sm text-slate-900 mb-1">{title}</div>
                <div className="text-xs leading-relaxed text-slate-700">{body}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Target Users */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-2xl border border-teal-100 p-8"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-3">Who Is This For?</h2>
          <p className="text-slate-600 text-sm mb-5">
            Navocs is designed for everyday commuters in Tuguegarao City, Cagayan, Philippines.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {['Tricycle operators', 'Delivery drivers', 'Private car commuters', 'Researchers & planners'].map((u) => (
              <span key={u} className="px-4 py-2 rounded-full bg-white border border-teal-200 text-teal-700 font-medium shadow-sm">
                {u}
              </span>
            ))}
          </div>
        </motion.section>

      </div>
    </div>
  );
}
