import { motion } from 'motion/react';
import { Navigation, FlaskConical, Cpu, Car, Zap, GitBranch, Database, MapPin, BarChart3, Shield, BookOpen } from 'lucide-react';

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

        {/* Research Scope — Why only Drivers and Commuters */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-2">Research Scope</h2>
          <p className="text-sm text-slate-500 mb-6">Why this study focuses on Drivers and Commuters — and what problem it solves.</p>

          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-slate-800 mb-2">The Problem in Tuguegarao City</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Tuguegarao City — the hottest city in the Philippines — has no eco-routing system built for its vehicle mix.
                Roads are dominated by tricycles carrying 1–5 passengers, creating stop-and-go congestion that burns more
                fuel per kilometer than steady-speed driving. Sidewalks are blocked by parked vehicles, forcing pedestrians
                onto the road. Students and workers pay for short tricycle trips they could walk if infrastructure existed.
                No existing system measures or addresses these conditions locally.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-blue-800 mb-2">Drivers</p>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Tricycle operators, delivery drivers, and private car owners who need to choose between routes.
                  The system calculates actual fuel cost per route — not just distance — so they can make a decision
                  based on money saved, not just minutes saved.
                </p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-teal-800 mb-2">Commuters</p>
                <p className="text-sm text-teal-700 leading-relaxed">
                  Students and workers who travel by foot or public transport. The system provides walking routes,
                  parking locations, and tricycle terminal guidance — helping them make informed decisions about
                  when walking is viable versus when to take a tricycle.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-amber-800 mb-3">The Gap — and How This Study Addresses It</p>
              <div className="space-y-3 text-sm text-amber-700 leading-relaxed">
                <p>
                  Most existing routing systems and studies use <strong>shortest path algorithms</strong> — they calculate
                  the route with the least distance. The problem with this approach is that when all vehicles are directed
                  to the same shortest path, that road becomes a bottleneck. Vehicles accumulate at intersections,
                  creating a stop-and-go cycle that consumes significantly more fuel and time than a longer but
                  smoother alternative route.
                </p>
                <p>
                  This study addresses that gap by introducing two components working together:
                </p>
                <div className="bg-white/60 rounded-lg p-3 border border-amber-200">
                  <p className="font-semibold text-amber-800 mb-1">A* Algorithm</p>
                  <p>A* (A-star) is a pathfinding algorithm that finds the most efficient route between two points by
                  evaluating each possible path using a cost function — not just distance. Unlike shortest-path algorithms,
                  A* can be guided by multiple factors at once, making it suitable for energy-aware routing.</p>
                </div>
                <div className="bg-white/60 rounded-lg p-3 border border-amber-200">
                  <p className="font-semibold text-amber-800 mb-1">VSP — Vehicle Specific Power</p>
                  <p>VSP is an energy model that estimates how much fuel a specific vehicle burns on a specific road segment,
                  based on its speed, acceleration, and the road gradient. It is vehicle-specific — a tricycle has a
                  different fuel consumption profile than a private car or an e-trike.</p>
                </div>
                <p>
                  By using VSP as the edge cost inside the A* algorithm, Navocs routes vehicles based on
                  <strong> actual estimated fuel cost per segment</strong> — not just distance or time. This is the
                  proposed solution to the bottleneck problem that shortest-path systems create. This study implements
                  and validates this approach as a prototype for Tuguegarao City.
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Why A* */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-violet-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Why A* Algorithm?</h2>
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-2">Shortest Path (Dijkstra)</p>
                <p className="text-sm text-red-700 leading-relaxed">
                  Finds the route with the least <strong>distance</strong>. Treats every road segment the same —
                  only asks "how long is this road?" Does not consider fuel cost, traffic, or vehicle type.
                  Checks every possible road before deciding — slow on large road networks.
                </p>
              </div>
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-violet-800 mb-2">A* Algorithm</p>
                <p className="text-sm text-violet-700 leading-relaxed">
                  Uses <strong>two things at once</strong> — the actual cost of the path so far, plus an estimate
                  of the remaining cost to the destination (the heuristic). This lets it skip roads going in the
                  wrong direction and reach the answer faster. More importantly, you can plug <strong>any cost
                  function</strong> into it — not just distance.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">How it works in Navocs</p>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                Instead of plugging in distance as the cost, Navocs plugs in <strong>VSP-based fuel consumption</strong>
                combined with traffic delay and speed stability. A* then finds the route where the total fuel cost
                across all road segments is lowest — not the shortest distance, not the fastest time, but the most
                energy-efficient path for that specific vehicle.
              </p>
              <div className="bg-slate-900 rounded-lg px-4 py-3 font-mono text-xs text-teal-300">
                Cost per segment = w1·Time + w2·Fuel(VSP) + w3·Traffic Delay + w4·Speed Stability
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">One-sentence answer for panelists</p>
              <p className="text-sm text-teal-700 italic">
                "We use A* because it allows a custom cost function — and our cost function is VSP-based fuel
                consumption per vehicle type, which shortest-path algorithms cannot support efficiently."
              </p>
            </div>
          </div>
        </motion.section>

        {/* Google Maps vs Our Algorithm */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.145 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Google Maps vs. Our Algorithm</h2>
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">What Google Maps does in Navocs</p>
                <p className="text-sm text-amber-700 leading-relaxed">
                  Displays the map, road names, and locations. Nothing more.
                  Google Maps is the <strong>visual layer</strong> — it draws roads on screen so users can see where they are.
                  It does not make any routing or efficiency decisions inside Navocs.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-blue-800 mb-2">What our A* algorithm does</p>
                <p className="text-sm text-blue-700 leading-relaxed">
                  Decides which road is most fuel-efficient for your vehicle type.
                  Uses the <strong>VSP formula</strong> — a physics-based fuel model — to calculate the cost of every road segment.
                  This is completely separate from Google's own routing.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">Current system status — honest scope</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Traffic delay estimates (<strong>D(e)</strong>) are currently based on theoretical assumptions from the VSP model —
                such as stop-and-go patterns during rush hour burning more fuel than steady-speed driving.
                Real-time or historical traffic data collection via the Navocs speed meter is ongoing.
                Full validation using collected GPS data from Tuguegarao roads is identified as future work.
              </p>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">One-sentence answer for panelists</p>
              <p className="text-sm text-teal-700 italic">
                "Google Maps provides the road display only — all efficiency decisions are made by our modified A* algorithm
                using VSP-based fuel modeling, independent of Google's routing engine."
              </p>
            </div>
          </div>
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

        {/* Powertrain Types */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Powertrain Types in Navocs</h2>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold">ICE</span>
                <span className="font-semibold text-slate-900 text-sm">Internal Combustion Engine</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Vehicles powered by burning gasoline or diesel fuel. Navocs calculates their fuel consumption using the <strong>VSP (Vehicle Specific Power)</strong> formula — which factors in speed, acceleration, and road gradient to estimate how much fuel is burned on each road segment. Includes: Tricycle, Motorcycle, Private Car.
              </p>
            </div>

            <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-teal-200 text-teal-800 text-xs font-bold">HEV</span>
                <span className="font-semibold text-slate-900 text-sm">Hybrid Electric Vehicle</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Vehicles that combine an ICE engine with an electric motor and battery. The system switches between fuel and electric power depending on speed and load. Navocs uses a <strong>dual-mode cost function</strong> — applying the VSP model at higher speeds (ICE mode) and the electric energy model at low speeds or braking (EV mode). Includes: Hybrid Car.
              </p>
            </div>

            <div className="rounded-xl border border-green-200 bg-green-50 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-bold">BEV</span>
                <span className="font-semibold text-slate-900 text-sm">Battery Electric Vehicle</span>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Fully electric vehicles with no combustion engine — powered entirely by a rechargeable battery pack. Navocs uses an <strong>energy model</strong> based on rolling resistance, aerodynamic drag, and acceleration forces, divided by drivetrain efficiency (η). Also tracks <strong>SoC (State of Charge)</strong> to avoid routes that would drain the battery completely. Includes: E-Trike, E-Motorcycle.
              </p>
            </div>
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

        {/* Study Scope & Limitations */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Study Scope & Honest Limitations</h2>
          </div>

          <div className="space-y-3">

            <div className="flex gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">What this study contributes</p>
                <p className="text-sm text-slate-600 mt-0.5">The design, development, and deployment of a fuel-efficient routing system applying A* with VSP — the first of its kind built for Tuguegarao City. The algorithm, vehicle profiles, and system architecture are the core contribution.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Validation is simulation-based, not empirical yet</p>
                <p className="text-sm text-amber-700 mt-0.5">Traffic delay estimates are based on theoretical VSP parameters — such as stop-and-go patterns burning more fuel. Real GPS data collection on Tuguegarao roads is ongoing. Full empirical validation is identified as future work.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-amber-200 text-amber-700 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">VSP formula is not yet locally calibrated</p>
                <p className="text-sm text-amber-700 mt-0.5">The VSP model is internationally validated in transportation research but has not been calibrated specifically for Filipino tricycles. Local calibration using collected speed data is a planned future enhancement.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
              <div>
                <p className="text-sm font-semibold text-blue-800">Commuters and drivers have different roles</p>
                <p className="text-sm text-blue-700 mt-0.5">A* route optimization is designed for drivers — tricycle operators, motorcyclists, and private car owners. Commuters use Navocs for walking directions, parking spots, and terminal guidance — not tricycle routing.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">5</span>
              <div>
                <p className="text-sm font-semibold text-blue-800">Supporting features are tools, not the study</p>
                <p className="text-sm text-blue-700 mt-0.5">The AI assistant, speed meter, road reporter, and parking map are supporting tools that aid data collection and user access. The core study is the A* routing algorithm and VSP energy model.</p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl border border-teal-200 bg-teal-50">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-teal-200 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0">6</span>
              <div>
                <p className="text-sm font-semibold text-teal-800">Why not just use Google Maps or Waze?</p>
                <p className="text-sm text-teal-700 mt-0.5">They optimize for time. Navocs optimizes for fuel cost per vehicle type using physics-based modeling. No existing app does this for tricycles or EVs in a Philippine provincial city — that is the gap this study fills.</p>
              </div>
            </div>

          </div>
        </motion.section>

        {/* Theoretical Assumptions */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Theoretical Assumptions</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            These are the assumptions the system operates on. Each is acknowledged as a study boundary — not a flaw.
          </p>

          <div className="space-y-3">

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-1">VSP formula is adopted from literature, not derived locally</p>
              <p className="text-sm text-slate-600">The VSP formula is from internationally peer-reviewed transportation research. Its coefficients are standard values — not measured from actual Filipino tricycles. The study applies the formula as-is and identifies local calibration as future work.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-1">Road gradient is assumed flat unless GPS elevation data is available</p>
              <p className="text-sm text-slate-600">The VSP formula requires road slope (grade). Since detailed elevation data for Tuguegarao roads is not yet integrated, the current implementation assumes flat terrain. Most urban roads in Tuguegarao are relatively flat, making this a reasonable assumption for this scope.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-1">Vehicle mass and specs use standard assumed values per type</p>
              <p className="text-sm text-slate-600">Each vehicle profile (tricycle, motorcycle, car, e-trike, etc.) uses standard mass and drag values from literature. Individual vehicle variations — engine condition, load weight, tire pressure — are not modeled. This is acceptable at study scope level.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-1">Traffic delay is time-of-day based, not real-time</p>
              <p className="text-sm text-slate-600">The D(e) component uses theoretical time-of-day patterns — rush hour assumed higher delay, off-peak assumed lower. Real-time traffic feeds are not yet connected. GPS speed data from the Navocs speed meter will feed into this over time.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-1">E-Trike and E-Motorcycle battery model assumes standard efficiency</p>
              <p className="text-sm text-slate-600">The BEV energy model uses a standard drivetrain efficiency value (η). Battery degradation, temperature effects, and charger type are not modeled. State of Charge (SoC) constraints prevent routes that would drain the battery — but exact range varies per unit.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-1">Fuel prices are assumed constant during route calculation</p>
              <p className="text-sm text-slate-600">Fuel cost estimates use a fixed price per liter. Real-world pump prices fluctuate weekly. The system compares routes relative to each other — so even if the absolute cost is approximate, the ranking of routes remains valid.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-sm font-semibold text-slate-800 mb-1">Drivers are assumed to follow the recommended route</p>
              <p className="text-sm text-slate-600">The system recommends a route but cannot enforce it. Real drivers may deviate based on personal knowledge, road conditions, or preference. Adherence tracking is not within the scope of this study.</p>
            </div>

          </div>
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
