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
  Play,
  Star,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import { useState, useEffect } from 'react';

export function LandingPage() {
  const [counters, setCounters] = useState({
    routes: 0,
    savings: 0,
    co2: 0,
    users: 0,
  });

  // Animated counter effect
  useEffect(() => {
    const targets = { routes: 1247, savings: 28, co2: 2.4, users: 342 };
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setCounters({
        routes: Math.floor(targets.routes * progress),
        savings: Math.floor(targets.savings * progress),
        co2: Math.round(targets.co2 * progress * 10) / 10,
        users: Math.floor(targets.users * progress),
      });

      if (step >= steps) {
        clearInterval(timer);
        setCounters(targets);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-50 via-blue-50 to-slate-50">
        {/* Dot grid background */}
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
                <span className="text-sm text-slate-700">Sustainable Transportation Research</span>
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
                Advanced traffic management system that analyzes multiple routes to find the most 
                energy-efficient and cost-effective path—not just the fastest. Make smarter mobility 
                decisions with real-time traffic, fuel consumption, and sustainability metrics.
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
                  <span>Start Optimizing Routes</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/analytics"
                  className="px-8 py-4 bg-white text-slate-700 rounded-xl font-medium border-2 border-slate-200 hover:border-teal-300 transition-all flex items-center space-x-2 group"
                >
                  <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>View Demo</span>
                </Link>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-12 grid grid-cols-3 gap-6"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-teal-600">{counters.users}+</div>
                  <div className="text-sm text-slate-600">Active Users</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{counters.routes}+</div>
                  <div className="text-sm text-slate-600">Routes Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">{counters.savings}%</div>
                  <div className="text-sm text-slate-600">Avg. Savings</div>
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
                
                {/* Floating cards */}
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
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Leaf className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-600">CO₂ Reduced</div>
                        <div className="text-lg font-bold text-slate-900">{counters.co2}T</div>
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
                      <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="text-xs text-slate-600">Cost Saved</div>
                        <div className="text-lg font-bold text-slate-900">₱8,942</div>
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

        {/* Decorative Animated Orbs */}
        <motion.div
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 right-0 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
        <motion.div
          animate={{
            x: [0, -40, 20, 0],
            y: [0, 30, -20, 0],
            scale: [1, 0.9, 1.15, 1],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20"
        />
        <motion.div
          animate={{
            x: [0, -20, 30, 0],
            y: [0, 20, -30, 0],
            scale: [1, 1.1, 0.95, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 8 }}
          className="absolute top-1/2 left-1/3 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-10"
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
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Why SmartRoute?
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Our intelligent system goes beyond traditional routing to optimize for what truly matters: 
            sustainability and cost savings.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Leaf className="w-8 h-8 text-green-600" />}
            title="Energy Efficient"
            description="Minimize fuel or energy consumption with optimized route calculations based on real traffic conditions."
            color="green"
            delay={0.1}
          />
          <FeatureCard
            icon={<DollarSign className="w-8 h-8 text-teal-600" />}
            title="Cost Savings"
            description="Calculate exact fuel costs and compare routes to save money on every trip."
            color="teal"
            delay={0.2}
          />
          <FeatureCard
            icon={<Route className="w-8 h-8 text-blue-600" />}
            title="Multi-Route Analysis"
            description="Compare up to 3 different routes simultaneously with detailed metrics and recommendations."
            color="blue"
            delay={0.3}
          />
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8 text-purple-600" />}
            title="Research Analytics"
            description="Comprehensive data visualization and insights for academic research and presentations."
            color="purple"
            delay={0.4}
          />
        </div>
      </div>

      {/* Visual Features Section */}
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
                alt="Electric Vehicle Charging"
                className="rounded-2xl shadow-2xl"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                Support for All Vehicle Types
              </h2>
              <p className="text-lg text-slate-300 mb-8">
                Whether you drive a traditional gasoline car, hybrid, or fully electric vehicle, 
                our system optimizes routes specifically for your vehicle's characteristics and fuel type.
              </p>
              
              <div className="space-y-4">
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />}>
                  Electric Vehicle optimization with charging station awareness
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />}>
                  Hybrid vehicle efficiency modes and battery management
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />}>
                  Traditional fuel vehicle consumption patterns
                </FeatureListItem>
                <FeatureListItem icon={<CheckCircle className="w-5 h-5" />}>
                  Real-time fuel price integration for accurate cost estimates
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
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600">
              Simple, powerful, and data-driven route optimization in three steps
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard
              number="1"
              title="Enter Trip Details"
              description="Input origin, destination, vehicle type, fuel type, and current fuel price for accurate calculations."
              icon={<MapPin className="w-6 h-6" />}
              delay={0.2}
            />
            <StepCard
              number="2"
              title="Analyze Routes"
              description="Our system compares multiple routes analyzing distance, traffic, fuel consumption, and costs."
              icon={<Zap className="w-6 h-6" />}
              delay={0.4}
            />
            <StepCard
              number="3"
              title="Choose Best Route"
              description="Get clear recommendations with efficiency scores and detailed breakdowns of savings."
              icon={<TrendingDown className="w-6 h-6" />}
              delay={0.6}
            />
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
              Beyond Speed: Optimize for Sustainability
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Traditional navigation apps prioritize speed. SmartRoute considers the complete picture: 
              energy efficiency, environmental impact, and cost-effectiveness while maintaining reasonable travel times.
            </p>
            
            <div className="space-y-4">
              <BenefitItem
                icon={<Clock className="w-5 h-5 text-teal-600" />}
                text="Real-time traffic analysis for accurate predictions"
              />
              <BenefitItem
                icon={<Leaf className="w-5 h-5 text-green-600" />}
                text="Reduce carbon footprint with efficient routing"
              />
              <BenefitItem
                icon={<DollarSign className="w-5 h-5 text-blue-600" />}
                text="Save up to 30% on fuel costs"
              />
              <BenefitItem
                icon={<BarChart3 className="w-5 h-5 text-purple-600" />}
                text="Research-grade analytics and reporting"
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
            <div className="bg-gradient-to-br from-teal-100 to-blue-100 rounded-2xl p-8 shadow-xl">
              <div className="grid grid-cols-2 gap-4">
                <MetricCard title="Routes Analyzed" value={counters.routes.toString()} trend="+12%" />
                <MetricCard title="Avg. Savings" value={`${counters.savings}%`} trend="+5%" />
                <MetricCard title="CO₂ Reduced" value={`${counters.co2}T`} trend="+18%" />
                <MetricCard title="Users" value={counters.users.toString()} trend="+24%" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Testimonial Section */}
      <div className="bg-gradient-to-br from-blue-50 to-teal-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Trusted by Researchers & Commuters
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <TestimonialCard
              quote="This system has revolutionized how we approach sustainable transportation planning."
              author="Dr. Sarah Chen"
              role="Transportation Research Lead"
              delay={0.2}
            />
            <TestimonialCard
              quote="I've saved over ₱200 on fuel costs in just three months using SmartRoute."
              author="Michael Rodriguez"
              role="Daily Commuter"
              delay={0.4}
            />
            <TestimonialCard
              quote="The analytics dashboard is perfect for our environmental impact studies."
              author="Prof. James Wilson"
              role="Environmental Science"
              delay={0.6}
            />
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
            Start making smarter, more sustainable transportation decisions today
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
          >
            <Link
              to="/signup"
              className="inline-flex items-center space-x-2 px-8 py-4 bg-white text-teal-600 rounded-xl font-medium hover:shadow-2xl hover:scale-105 transition-all group"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function FeatureCard({ 
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
    green: 'bg-green-50 border-green-100',
    teal: 'bg-teal-50 border-teal-100',
    blue: 'bg-blue-50 border-blue-100',
    purple: 'bg-purple-50 border-purple-100',
  }[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`${colorClasses} border-2 rounded-xl p-6 hover:shadow-lg transition-shadow cursor-pointer`}
    >
      <motion.div
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ duration: 0.2 }}
        className="mb-4"
      >
        {icon}
      </motion.div>
      <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}

function StepCard({ 
  number, 
  title, 
  description, 
  icon,
  delay = 0,
}: { 
  number: string; 
  title: string; 
  description: string; 
  icon: React.ReactNode;
  delay?: number;
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

function MetricCard({ title, value, trend }: { title: string; value: string; trend: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white rounded-lg p-4 shadow-md"
    >
      <div className="text-xs text-slate-500 mb-1">{title}</div>
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-green-600 font-medium">{trend}</div>
    </motion.div>
  );
}

function FeatureListItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      className="flex items-start space-x-3 text-slate-300"
    >
      <div className="flex-shrink-0 text-teal-400 mt-1">{icon}</div>
      <span>{children}</span>
    </motion.div>
  );
}

function TestimonialCard({
  quote,
  author,
  role,
  delay = 0,
}: {
  quote: string;
  author: string;
  role: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-xl p-6 shadow-md border border-slate-200"
    >
      <div className="flex items-center space-x-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <p className="text-slate-700 mb-4 italic">"{quote}"</p>
      <div>
        <div className="font-semibold text-slate-900">{author}</div>
        <div className="text-sm text-slate-500">{role}</div>
      </div>
    </motion.div>
  );
}