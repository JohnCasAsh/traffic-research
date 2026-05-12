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

        {/* ONE Research Focus */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.09 }}
          className="rounded-2xl border-2 border-teal-400 bg-teal-50 p-8"
        >
          <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-3">One Research Goal</p>
          <h2 className="text-2xl font-bold text-slate-900 mb-4 leading-snug">
            Can A* with VSP energy modeling produce fuel-efficient route recommendations for multiple vehicle types in Tuguegarao City?
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            That is the single question this study answers. Everything else in the system — the AI assistant, speed meter,
            road reporter, commuter features, parking map — exists only to support this goal. They are tools, not separate studies.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { feature: 'A* Route Algorithm', role: 'Core study — the research contribution', core: true },
              { feature: 'VSP Energy Model', role: 'Core study — the fuel cost formula', core: true },
              { feature: 'Speed Meter', role: 'Data collection — feeds speed data into D(e) traffic estimates', core: false },
              { feature: 'Road Reporter', role: 'Data collection — captures road conditions from users', core: false },
              { feature: 'AI Assistant', role: 'Supporting tool — helps users understand route recommendations', core: false },
              { feature: 'Commuter Features', role: 'Supporting tool — walking routes, terminals, parking for non-drivers', core: false },
              { feature: 'Parking Map', role: 'Supporting tool — helps commuters decide when to walk vs ride', core: false },
              { feature: 'Live Tracking', role: 'Supporting tool — real-time position for active trips', core: false },
            ].map(({ feature, role, core }) => (
              <div key={feature} className={`flex gap-3 p-3 rounded-xl border ${core ? 'bg-teal-100 border-teal-300' : 'bg-white border-slate-200'}`}>
                <span className={`mt-0.5 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${core ? 'bg-teal-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {core ? '★' : '○'}
                </span>
                <div>
                  <p className={`text-sm font-semibold ${core ? 'text-teal-800' : 'text-slate-700'}`}>{feature}</p>
                  <p className={`text-xs mt-0.5 ${core ? 'text-teal-700' : 'text-slate-500'}`}>{role}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 p-4 bg-white rounded-xl border border-teal-200">
            <p className="text-sm font-semibold text-teal-800 mb-1">If a panelist says "your scope is too big"</p>
            <p className="text-sm text-teal-700 italic">
              "The research scope is one algorithm — A* with VSP-based fuel modeling. The additional features are
              implementation tools that support data collection and user access. They are not separate research contributions."
            </p>
          </div>
        </motion.section>

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

        {/* Not a Navigation App */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.11 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center">
              <Car className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Navocs is Not a Navigation App</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">This is the most important thing to understand about what Navocs does — and does not do.</p>

          <div className="space-y-4">

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-rose-800 mb-2">What people assume it does</p>
                <p className="text-sm text-rose-700 leading-relaxed">
                  "Tell me where SM is." "How do I get to Rizal Street?" — In Tuguegarao, everyone already knows these
                  answers. Locals ask neighbors. Drivers know every road. A navigation app would be useless here.
                </p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-teal-800 mb-2">What Navocs actually does</p>
                <p className="text-sm text-teal-700 leading-relaxed">
                  "Which road to SM burns the least fuel for my tricycle?" — Nobody can answer that by asking a neighbor.
                  No existing app calculates it per vehicle type. That is the problem Navocs solves.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">The real value — in peso terms</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                A tricycle driver does 20 trips a day. He always takes the same familiar road — because he knows it.
                But that road has stop-and-go traffic, constant braking and accelerating, which burns more fuel.
                Navocs compares routes and finds one that saves even <strong>₱3 per trip</strong> — that is
                <strong> ₱60 a day</strong>, <strong>₱1,800 a month</strong>. He could never see that difference
                just by driving. The fuel cost is invisible without calculation.
              </p>
            </div>

            <div className="bg-slate-900 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">The distinction for panelists</p>
              <div className="space-y-2">
                <div className="flex gap-3 text-sm">
                  <span className="text-rose-400 font-bold shrink-0">Asking a local:</span>
                  <span className="text-slate-300">Tells you how to get there</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-amber-400 font-bold shrink-0">Google Maps / Waze:</span>
                  <span className="text-slate-300">Tells you the fastest way to get there</span>
                </div>
                <div className="flex gap-3 text-sm">
                  <span className="text-teal-400 font-bold shrink-0">Navocs:</span>
                  <span className="text-slate-300">Tells you which way costs your vehicle the least fuel to get there — per vehicle type, using physics-based modeling</span>
                </div>
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">One-sentence answer for panelists</p>
              <p className="text-sm text-teal-700 italic">
                "Navocs does not solve navigation — locals already know the city. It solves fuel cost visibility,
                which no person or existing app can calculate per vehicle type for Tuguegarao roads."
              </p>
            </div>

          </div>
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

        {/* What is VSP */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.148 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">What is VSP — and Why Does It Matter?</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">VSP stands for <strong>Vehicle Specific Power</strong>. It is a number that tells you how hard your engine is working at any given moment.</p>

          <div className="space-y-4">

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-orange-800 mb-2">Simple explanation</p>
              <p className="text-sm text-orange-700 leading-relaxed">
                Think of VSP as your engine's effort level. When you accelerate fast, climb a hill, or drive at high speed —
                your engine works harder and burns more fuel. When you drive slow and steady — your engine barely works and
                burns less fuel. VSP measures that effort as a single number.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-700 mb-2">The VSP formula</p>
              <div className="bg-slate-900 rounded-lg px-4 py-3 font-mono text-xs text-amber-300 mb-3">
                VSP = v · (1.1a + 9.81 · grade + 0.132) + 0.000302 · v³
              </div>
              <div className="grid sm:grid-cols-3 gap-2 text-sm text-slate-600">
                <span><strong className="text-slate-800">v</strong> — your speed (m/s)</span>
                <span><strong className="text-slate-800">a</strong> — how fast you're speeding up or braking (m/s²)</span>
                <span><strong className="text-slate-800">grade</strong> — steepness of the road</span>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-800 mb-2">High VSP = more fuel burned</p>
                <ul className="text-sm text-red-700 space-y-1">
                  <li>— Stop-and-go traffic (constant acceleration)</li>
                  <li>— Going uphill</li>
                  <li>— Speeding up quickly from a stop</li>
                  <li>— High speed on an open road</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-green-800 mb-2">Low VSP = less fuel burned</p>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>— Steady speed on a flat road</li>
                  <li>— Slow and smooth driving</li>
                  <li>— Coasting or light braking</li>
                  <li>— Less acceleration, less engine load</li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <p className="text-sm font-semibold text-slate-700 mb-3">How VSP works differently per vehicle type</p>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-xs font-bold shrink-0 mt-0.5">ICE</span>
                  <p className="text-sm text-slate-600"><strong>Tricycle, Motorcycle, Private Car</strong> — VSP directly maps to fuel burned per second. Higher VSP = more gasoline consumed. A* avoids roads where VSP will be high for your vehicle.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-xs font-bold shrink-0 mt-0.5">BEV</span>
                  <p className="text-sm text-slate-600"><strong>E-Trike, E-Motorcycle</strong> — VSP does not apply. Instead we use an energy model that calculates battery drain based on rolling resistance, wind drag, and acceleration. State of Charge (SoC) is tracked so the route never fully drains the battery.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="px-2 py-0.5 rounded-full bg-teal-200 text-teal-800 text-xs font-bold shrink-0 mt-0.5">HEV</span>
                  <p className="text-sm text-slate-600"><strong>Hybrid Car</strong> — Uses both. At high speed, the ICE engine runs and VSP applies. At low speed or braking, the electric motor takes over and the energy model applies instead.</p>
                </div>
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">One-sentence answer for panelists</p>
              <p className="text-sm text-teal-700 italic">
                "VSP measures how hard your engine works on each road segment — Navocs uses that number to calculate fuel cost,
                so A* can pick the route that costs your specific vehicle the least fuel."
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
                <p className="text-sm text-teal-700 mt-0.5">They solve navigation — getting from A to B. Navocs solves fuel cost — which path to A costs your vehicle the least. These are different problems. Google Maps has no VSP model, no vehicle-specific fuel calculation, and no cross-powertrain comparison. See the full breakdown below.</p>
              </div>
            </div>

          </div>
        </motion.section>

        {/* Why Not Google Maps — Critical Panelist Section */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.275 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">"Why Not Just Use Google Maps or Waze?"</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            This is the most common panelist question. The answer is not that Navocs is better — it is that Navocs does something Google Maps <strong>cannot do</strong>.
          </p>

          <div className="space-y-4">

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left px-4 py-3 rounded-tl-xl font-semibold text-slate-700">Capability</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-700">Google Maps / Waze</th>
                    <th className="text-center px-4 py-3 rounded-tr-xl font-semibold text-teal-700">Navocs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['Optimize for fastest time', '✅ Yes', '—'],
                    ['Optimize for fuel cost', '❌ No', '✅ Yes'],
                    ['VSP-based fuel model per road segment', '❌ No', '✅ Yes'],
                    ['Different route for tricycle vs e-trike', '❌ No', '✅ Yes'],
                    ['ICE vs BEV vs HEV cost comparison', '❌ No', '✅ Yes'],
                    ['Built for Philippine provincial vehicle mix', '❌ No', '✅ Yes'],
                    ['Real-time live traffic', '✅ Yes', '❌ Future work'],
                  ].map(([cap, google, navocs], i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">{cap}</td>
                      <td className={`px-4 py-3 text-center font-medium ${google.includes('✅') ? 'text-green-600' : 'text-rose-500'}`}>{google}</td>
                      <td className={`px-4 py-3 text-center font-medium ${navocs.includes('✅') ? 'text-teal-600' : 'text-slate-400'}`}>{navocs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-900 rounded-xl p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">The correct framing</p>
              <div className="space-y-2 text-sm">
                <div className="flex gap-2">
                  <span className="text-rose-400 font-bold shrink-0">Wrong claim:</span>
                  <span className="text-slate-300">"Navocs gives better routes than Google Maps" — this requires experimental proof we do not have yet.</span>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="text-teal-400 font-bold shrink-0">Correct claim:</span>
                  <span className="text-slate-300">"Navocs solves a problem Google Maps cannot solve — fuel cost optimization per vehicle type using VSP modeling."</span>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">What about experimental validation?</p>
              <p className="text-sm text-amber-700 leading-relaxed">
                The study does not claim Navocs produces lower fuel consumption than Google Maps in a live test — no such experiment has been conducted yet.
                The contribution is the <strong>design and implementation</strong> of a fuel-efficient routing system using A* and VSP for vehicle types that no existing tool models.
                Empirical comparison against existing tools is identified as a priority for future work.
              </p>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-teal-800 mb-1">One-sentence answer for panelists</p>
              <p className="text-sm text-teal-700 italic">
                "We are not claiming to outperform Google Maps — we are implementing a capability it does not have:
                VSP-based fuel cost routing per vehicle type, applied for the first time to Tuguegarao City's vehicle mix."
              </p>
            </div>

          </div>
        </motion.section>

        {/* Panelist Q&A — All Hard Questions */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.276 }}
          className="bg-white rounded-2xl border border-slate-200 p-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Anticipated Panelist Questions — Honest Answers</h2>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Every hard question a panelist can ask — answered honestly. No absolute claims. No fake data. Only what the study actually does.
          </p>

          <div className="space-y-3">

            {/* Q1 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"Where is your proof that Navocs saves more fuel than Google Maps?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">There is no experimental proof yet — and we do not claim there is. The study contributes the <strong>design and implementation</strong> of a VSP-based fuel routing system. Comparing fuel savings against Google Maps routes in a live test is identified as future work. The claim is not "we save more fuel" — the claim is "we calculate fuel cost per vehicle type, which Google Maps does not do."</p>
              </div>
            </div>

            {/* Q2 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"You claim to be the first eco-routing system for Tuguegarao — where is your proof no one else built this?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">The claim is scoped specifically: no published eco-routing system for Tuguegarao City using VSP modeling for tricycle and EV profiles was found in literature review. We do not claim to be first in the world — we claim to be first for this specific local context, based on our review of related work. If a panelist knows of one, we welcome the reference.</p>
              </div>
            </div>

            {/* Q3 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"Your VSP formula — did you test it on actual tricycles? How do you know it's accurate?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">The VSP formula is adopted from peer-reviewed transportation research — it is an internationally validated model, not invented by this study. It has not been locally calibrated against actual tricycle fuel measurements yet. That is acknowledged as a limitation. The formula is applied as-is from literature, which is standard practice at thesis level when OBD-II or fuel sensor data is not yet available.</p>
              </div>
            </div>

            {/* Q4 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"Where does your traffic data come from? Did you actually collect it?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">Traffic delay estimates are currently theoretical — based on time-of-day assumptions derived from VSP behavior (stop-and-go during rush hour = higher fuel cost). Real GPS speed data collection on Tuguegarao roads is ongoing using the Navocs speed meter tool. The current system uses theoretical parameters as placeholders until sufficient local data is collected.</p>
              </div>
            </div>

            {/* Q5 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"Did you test this with real drivers? Do actual users find it useful?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">The system is a working prototype deployed at navocs.com. Formal user testing with a measured sample of drivers and commuters has not been conducted yet. Usability evaluation and user acceptance testing are identified as future work. The current stage is system design and implementation — not full-scale deployment evaluation.</p>
              </div>
            </div>

            {/* Q6 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"How do you know A* gives a better route than Dijkstra for this problem?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">A* is chosen because it supports a custom cost function — which Dijkstra also does. The advantage of A* over Dijkstra is computational efficiency on large road networks due to the heuristic. Both can use the same VSP cost function. The study does not claim A* produces different fuel savings than Dijkstra — it claims A* is the more appropriate algorithm for scaling to a full road network. Simulation comparison is future work.</p>
              </div>
            </div>

            {/* Q7 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"What if your algorithm recommends a route that is actually worse? How do you know it won't?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">The algorithm's output is only as good as its input data. If the VSP parameters or traffic estimates are inaccurate, the recommended route may not be optimal in real conditions. This is acknowledged. The system is a research prototype — drivers can see all compared routes and make their own decision. It is a decision-support tool, not an enforced routing system.</p>
              </div>
            </div>

            {/* Q8 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"Your e-trike energy model — where did you get the battery specs? Are they accurate for local e-trikes?"</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">The BEV energy model uses standard values for rolling resistance, drag coefficient, and drivetrain efficiency from transportation engineering literature. These are not calibrated against specific Philippine e-trike models. Battery degradation and temperature effects are not modeled. Local e-trike calibration is identified as future work, especially relevant given RA 11697 and the projected growth of EVs in the Philippines.</p>
              </div>
            </div>

            {/* Q9 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"Will local people actually use this? Most tricycle drivers don't use routing apps."</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">Adoption is a valid concern. The current system is a research prototype targeting tech-familiar users. Barriers include language (app is in English), digital literacy, and mobile data access. These are acknowledged limitations. Localization to Filipino and Ilocano, simplified offline UI, and driver adoption strategies are identified as future work. The thesis contribution is the algorithm and system — not mass deployment.</p>
              </div>
            </div>

            {/* Q10 */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-4 py-3">
                <p className="text-sm font-semibold text-white">"You say you fill a gap — but is the gap real? Maybe no one built this because there's no demand."</p>
              </div>
              <div className="px-4 py-3 bg-slate-50">
                <p className="text-sm text-slate-600">The gap is documented through literature review — no published eco-routing system for Philippine provincial cities using VSP was found. Whether there is market demand is a separate question from whether the research gap exists academically. The study addresses the academic gap. Demand validation would require a separate market study, which is outside this research scope.</p>
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
