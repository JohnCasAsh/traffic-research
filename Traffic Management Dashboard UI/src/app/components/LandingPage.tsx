import { Link } from 'react-router';
import { motion } from 'motion/react';
import {
  MapPin,
  DollarSign,
  Leaf,
  TrendingDown,
  BarChart3,
  Route,
  Zap,
  Clock,
  ArrowRight,
  MessageCircle,
  CheckCircle,
  ChevronDown,
  Gauge,
  Users,
  Car,
  PersonStanding,
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-blue-50 to-slate-50">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(15, 118, 110, 0.15) 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-white rounded-full shadow-sm border border-teal-100 mb-6"
              >
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <Leaf className="w-4 h-4 text-green-600" />
                <span className="text-sm text-slate-700">Sustainable Transportation Research — Tuguegarao City</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight"
              >
                Energy & Cost Efficient
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-blue-600">
                  Route Optimization
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed"
              >
                Navocs is a research prototype that finds the most fuel-efficient, cost-effective route —
                not just the fastest. Built for tricycle operators, drivers, and commuters in Tuguegarao City
                using a Modified A* algorithm with real-time VSP energy modeling.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col sm:flex-row items-center gap-4"
              >
                <Link
                  to="/signup"
                  className="relative overflow-hidden px-8 py-4 bg-gradient-to-r from-teal-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all flex items-center space-x-2 group"
                >
                  <motion.span
                    className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                  />
                  <span>Get Started</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/about"
                  className="px-8 py-4 bg-white text-slate-700 rounded-xl font-medium border-2 border-slate-200 hover:border-teal-300 transition-all flex items-center space-x-2 group"
                >
                  <span>Learn More</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>

              {/* Accurate feature highlights */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-12 grid grid-cols-3 gap-6"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-teal-600">6</div>
                  <div className="text-sm text-slate-600">Vehicle Types</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">3</div>
                  <div className="text-sm text-slate-600">Routes Compared</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">AI</div>
                  <div className="text-sm text-slate-600">Route Assistant</div>
                </div>
              </motion.div>
            </motion.div>

            {/* Right Image */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1587258019478-b1a1107e24ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFmZmljJTIwaGlnaHdheSUyMGFlcmlhbCUyMHZpZXd8ZW58MXx8fHwxNzczMDg4NzI2fDA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Traffic Highway Aerial View"
                  className="w-full h-auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-teal-900/40 to-transparent"></div>

                {/* Floating cards — accurate data */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                  className="absolute top-6 left-6"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                    className="bg-white rounded-lg p-4 shadow-xl"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                        <Route className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-600">Modified A*</div>
                        <div className="text-sm font-bold text-slate-900">VSP Energy Model</div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                  className="absolute bottom-6 right-6"
                >
                  <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                    className="bg-white rounded-lg p-4 shadow-xl"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <MessageCircle className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-600">AI Assistant</div>
                        <div className="text-sm font-bold text-slate-900">Route Advisor</div>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </div>

          {/* Scroll Down Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 0.8 }}
            className="flex flex-col items-center gap-1 text-slate-400 mt-12 pb-4"
          >
            <span className="text-xs font-medium tracking-wide">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </motion.div>
        </div>

        {/* Decorative Orbs */}
        <motion.div
          animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.9, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 right-0 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
        <motion.div
          animate={{ x: [0, -40, 20, 0], y: [0, 30, -20, 0], scale: [1, 0.9, 1.15, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">What's Inside Navocs</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A full multi-role platform with route intelligence, live tracking, AI chat, and research analytics —
            all in one system.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Route className="w-8 h-8 text-teal-600" />}
            title="Route Comparison"
            description="Compare up to 3 routes side by side — see fuel cost, distance, travel time, and efficiency score for each before you drive."
            color="teal"
            delay={0.1}
          />
          <FeatureCard
            icon={<MessageCircle className="w-8 h-8 text-orange-500" />}
            title="Navocs AI Assistant"
            description="An AI-powered chat assistant built into your dashboard. Ask it for route advice, fuel tips, or help understanding your trip data."
            color="orange"
            delay={0.2}
          />
          <FeatureCard
            icon={<Gauge className="w-8 h-8 text-blue-600" />}
            title="Speed Meter"
            description="GPS-based live speed tracking with Kalman filter smoothing. Records fuel used, distance, elapsed time, and total trip cost in real time."
            color="blue"
            delay={0.3}
          />
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8 text-purple-600" />}
            title="Research Analytics"
            description="Admin and researcher accounts get full data visualization — trip logs, route efficiency trends, and exportable data for academic analysis."
            color="purple"
            delay={0.4}
          />
        </div>
      </div>

      {/* Vehicle Types Section */}
      <div className="bg-slate-900 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img
                src="https://images.unsplash.com/photo-1704474618942-ae933a8edd86?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJpYyUyMGNhciUyMGNoYXJnaW5nJTIwc3VzdGFpbmFibGV8ZW58MXx8fHwxNzczMjAwMTI2fDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Electric Vehicle"
                className="rounded-2xl shadow-2xl"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                6 Vehicle Types, 3 Powertrain Models
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Each vehicle uses a different energy model — ICE vehicles use the VSP fuel formula,
                hybrids use a dual-mode cost function, and BEV vehicles use a battery energy model
                with state-of-charge constraints.
              </p>

              <div className="space-y-3">
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />} badge="ICE" badgeColor="bg-amber-500">
                  Tricycle — VSP-based fuel model (most common in Tuguegarao)
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />} badge="ICE" badgeColor="bg-amber-500">
                  Motorcycle — VSP-based fuel model
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />} badge="ICE" badgeColor="bg-amber-500">
                  Private Car (Gasoline/Diesel) — VSP-based fuel model
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />} badge="HEV" badgeColor="bg-teal-500">
                  Hybrid Car — dual-mode ICE + electric cost function
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />} badge="BEV" badgeColor="bg-green-500">
                  E-Trike — battery energy model with SoC constraint
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />} badge="BEV" badgeColor="bg-green-500">
                  E-Motorcycle — battery energy model with SoC constraint
                </FeatureListItem>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-lg text-slate-600">Sign up, pick your role, and start optimizing in three steps</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Sign Up & Pick Your Role"
              description="Sign up as a Driver or Commuter. Drivers get route comparison and live trip tracking. Commuters get walking directions, parking spots, and terminal guidance."
              icon={<Users className="w-6 h-6" />}
              delay={0.2}
            />
            <StepCard
              number="2"
              title="Enter Trip Details"
              description="Set your origin, destination, vehicle type, fuel type, and current fuel price. The system fetches real routes and calculates energy cost for each."
              icon={<MapPin className="w-6 h-6" />}
              delay={0.4}
            />
            <StepCard
              number="3"
              title="Get the Best Route"
              description="See a ranked comparison of routes by efficiency score. Use the AI assistant to ask questions, then start live tracking to record actual vs estimated data."
              icon={<TrendingDown className="w-6 h-6" />}
              delay={0.6}
            />
          </div>
        </div>
      </div>

      {/* Who Is It For */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Who Is Navocs For?</h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Different roles, different dashboards — each user gets only what they need.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <RoleCard
            icon={<Car className="w-8 h-8 text-blue-600" />}
            role="Driver"
            color="blue"
            features={[
              'Route comparison dashboard',
              'Live map with congestion alerts',
              'Gas station finder',
              'Speed meter & trip tracker',
              'AI Route Assistant',
              'Feedback submission',
            ]}
          />
          <RoleCard
            icon={<PersonStanding className="w-8 h-8 text-teal-600" />}
            role="Commuter"
            color="teal"
            features={[
              'Commuter-focused dashboard',
              'Parking spot finder',
              'Walkway navigation',
              'AI Route Assistant',
              'Feedback submission',
            ]}
          />
        </div>
      </div>

      {/* Algorithm Section */}
      <div className="bg-gradient-to-br from-teal-50 to-blue-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Beyond Speed: Optimize for What Matters
              </h2>
              <p className="text-lg text-slate-600 mb-8">
                Standard navigation apps optimize for time. Navocs uses a Modified A* algorithm
                with an energy-aware edge cost function that weighs travel time, fuel consumption,
                traffic delay, and speed stability simultaneously.
              </p>

              <div className="space-y-4">
                <BenefitItem
                  icon={<Zap className="w-5 h-5 text-teal-600" />}
                  text="Modified A* with VSP (Vehicle Specific Power) energy model"
                />
                <BenefitItem
                  icon={<Clock className="w-5 h-5 text-blue-600" />}
                  text="Time-of-day traffic delay penalty built into route cost"
                />
                <BenefitItem
                  icon={<DollarSign className="w-5 h-5 text-green-600" />}
                  text="Fuel price and consumption per vehicle type calculated per route"
                />
                <BenefitItem
                  icon={<Leaf className="w-5 h-5 text-emerald-600" />}
                  text="Aligned with RA 11697 — the Philippine EV Road Map Act"
                />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="bg-slate-900 rounded-2xl p-6 shadow-xl font-mono text-sm">
                <div className="text-slate-400 mb-3 text-xs uppercase tracking-wide">Edge Cost Function</div>
                <div className="text-teal-400 mb-2">C(e) = w1·T(e) + w2·F(e) + w3·D(e) + w4·S(e)</div>
                <div className="text-slate-500 text-xs mt-4 space-y-1">
                  <div><span className="text-blue-400">T(e)</span> — travel time on edge e</div>
                  <div><span className="text-blue-400">F(e)</span> — fuel/energy consumption (VSP model)</div>
                  <div><span className="text-blue-400">D(e)</span> — traffic delay penalty</div>
                  <div><span className="text-blue-400">S(e)</span> — speed stability score</div>
                </div>
                <div className="border-t border-slate-700 mt-4 pt-4">
                  <div className="text-slate-400 mb-2 text-xs uppercase tracking-wide">VSP Formula (ICE)</div>
                  <div className="text-green-400 text-xs leading-relaxed">
                    VSP = v × (1.1a + 9.81 × grade + 0.132)<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ 0.000302 × v³
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="bg-gradient-to-r from-teal-600 to-blue-600 py-16"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold text-white mb-4"
          >
            Ready to Optimize Your Routes?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="text-xl text-teal-50 mb-8"
          >
            Sign up to access the dashboard, AI assistant, and live route tracking
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              to="/signup"
              className="inline-flex items-center justify-center space-x-2 px-8 py-4 bg-white text-teal-600 rounded-xl font-medium hover:shadow-2xl hover:scale-105 transition-all group"
            >
              <span>Create Account</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center justify-center space-x-2 px-8 py-4 bg-teal-500/30 text-white border border-white/30 rounded-xl font-medium hover:bg-teal-500/50 transition-all"
            >
              <span>About Navocs</span>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function FeatureCard({
  icon, title, description, color, delay = 0,
}: {
  icon: React.ReactNode; title: string; description: string; color: string; delay?: number;
}) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 border-green-100',
    teal: 'bg-teal-50 border-teal-100',
    blue: 'bg-blue-50 border-blue-100',
    purple: 'bg-purple-50 border-purple-100',
    orange: 'bg-orange-50 border-orange-100',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`${colorClasses[color] ?? 'bg-slate-50 border-slate-100'} border-2 rounded-xl p-6 hover:shadow-lg transition-shadow`}
    >
      <motion.div whileHover={{ scale: 1.1, rotate: 5 }} transition={{ duration: 0.2 }} className="mb-4">
        {icon}
      </motion.div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function RoleCard({
  icon, role, color, features,
}: {
  icon: React.ReactNode; role: string; color: string; features: string[];
}) {
  const headerColors: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    teal: 'from-teal-500 to-teal-600',
    purple: 'from-purple-500 to-purple-600',
    slate: 'from-slate-600 to-slate-700',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden hover:shadow-xl transition-shadow"
    >
      <div className={`bg-gradient-to-r ${headerColors[color] ?? 'from-slate-500 to-slate-600'} p-4 flex items-center gap-3`}>
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white">
          {icon}
        </div>
        <span className="font-bold text-white text-lg">{role}</span>
      </div>
      <ul className="p-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
            <CheckCircle className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function StepCard({
  number, title, description, icon, delay = 0,
}: {
  number: string; title: string; description: string; icon: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -5 }}
      className="relative bg-white rounded-xl p-8 shadow-md border border-slate-200 hover:shadow-xl transition-shadow"
    >
      <motion.div
        initial={{ scale: 0 }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
        className="absolute -top-4 -left-4 w-12 h-12 bg-gradient-to-br from-teal-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
      >
        {number}
      </motion.div>
      <div className="mb-4 text-teal-600">{icon}</div>
      <h3 className="font-bold text-slate-900 mb-2 text-lg">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function BenefitItem({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      whileHover={{ x: 5 }}
      className="flex items-center space-x-3"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <span className="text-slate-700">{text}</span>
    </motion.div>
  );
}

function FeatureListItem({
  icon, badge, badgeColor, children,
}: {
  icon: React.ReactNode; badge: string; badgeColor: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-center gap-3 text-slate-300"
    >
      <div className="flex-shrink-0 text-teal-400">{icon}</div>
      <span className="flex-1">{children}</span>
      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${badgeColor}`}>{badge}</span>
    </motion.div>
  );
}
