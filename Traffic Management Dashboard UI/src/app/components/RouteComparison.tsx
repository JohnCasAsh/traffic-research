import { useLocation } from 'react-router';
import { motion } from 'motion/react';
import {
  MapPin,
  Clock,
  Gauge,
  Fuel,
  DollarSign,
  TrendingDown,
  Award,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Leaf,
  Sparkles,
} from 'lucide-react';

interface RouteData {
  id: number;
  name: string;
  distance: number;
  duration: number;
  trafficLevel: 'low' | 'moderate' | 'heavy';
  fuelConsumption: number;
  cost: number;
  efficiencyScore: number;
  isRecommended: boolean;
  co2Emission: number;
}

export function RouteComparison() {
  const location = useLocation();
  const formData = location.state || {
    origin: 'Downtown City Center',
    destination: 'Airport Terminal',
    vehicleType: 'sedan',
    fuelType: 'gasoline',
    fuelPrice: '3.50',
  };

  // Mock route data
  const routes: RouteData[] = [
    {
      id: 1,
      name: 'Highway Route',
      distance: 28.5,
      duration: 32,
      trafficLevel: 'heavy',
      fuelConsumption: 2.4,
      cost: 8.4,
      efficiencyScore: 72,
      isRecommended: false,
      co2Emission: 15.8,
    },
    {
      id: 2,
      name: 'Scenic Bypass',
      distance: 32.1,
      duration: 38,
      trafficLevel: 'low',
      fuelConsumption: 1.8,
      cost: 6.3,
      efficiencyScore: 94,
      isRecommended: true,
      co2Emission: 11.6,
    },
    {
      id: 3,
      name: 'City Route',
      distance: 24.8,
      duration: 42,
      trafficLevel: 'moderate',
      fuelConsumption: 2.1,
      cost: 7.35,
      efficiencyScore: 78,
      isRecommended: false,
      co2Emission: 13.9,
    },
  ];

  const recommendedRoute = routes.find((r) => r.isRecommended)!;
  const baseRoute = routes[0];
  const savingsPercent = Math.round(
    ((baseRoute.cost - recommendedRoute.cost) / baseRoute.cost) * 100
  );
  const fuelSavings = (baseRoute.fuelConsumption - recommendedRoute.fuelConsumption).toFixed(1);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center space-x-2 text-sm text-slate-600 mb-2">
            <MapPin className="w-4 h-4" />
            <span>
              {formData.origin} → {formData.destination}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Route Analysis Complete</h1>
          <p className="text-slate-600">
            Comparing {routes.length} routes based on efficiency, cost, and traffic conditions
          </p>
        </motion.div>

        {/* Recommendation Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 mb-8 shadow-lg relative overflow-hidden"
        >
          {/* Animated background elements */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute top-0 right-0 w-64 h-64 bg-green-200 rounded-full blur-3xl"
          />
          
          <div className="flex items-start space-x-4 relative z-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
              className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-full flex items-center justify-center"
            >
              <Award className="w-6 h-6 text-white" />
            </motion.div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h2 className="text-xl font-bold text-slate-900">Recommended Route</h2>
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="px-3 py-1 bg-green-500 text-white text-xs font-medium rounded-full flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>BEST CHOICE</span>
                </motion.span>
              </div>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="text-green-900 mb-4 text-lg font-medium"
              >
                {recommendedRoute.name} - Save ₱{(baseRoute.cost - recommendedRoute.cost).toFixed(2)}{' '}
                ({savingsPercent}%) compared to the fastest route
              </motion.p>

              {/* Score Breakdown */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white rounded-lg p-4 border border-green-200"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-slate-600">Efficiency Score</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {recommendedRoute.efficiencyScore}
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white rounded-lg p-4 border border-green-200"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-slate-600">Cost Savings</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{savingsPercent}%</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white rounded-lg p-4 border border-green-200"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Fuel className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-slate-600">Fuel Saved</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{fuelSavings} gal</div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="bg-white rounded-lg p-4 border border-green-200"
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Leaf className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-slate-600">CO₂ Reduced</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {(baseRoute.co2Emission - recommendedRoute.co2Emission).toFixed(1)} kg
                  </div>
                </motion.div>
              </motion.div>

              {/* Why This Route */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-white rounded-lg p-4 border border-green-200"
              >
                <h3 className="font-semibold text-slate-900 mb-2">Why this route was selected:</h3>
                <ul className="space-y-2 text-sm text-slate-700">
                  {[
                    {
                      text: (
                        <>
                          <strong>Lowest fuel consumption</strong> despite slightly longer distance,
                          thanks to minimal traffic
                        </>
                      ),
                    },
                    {
                      text: (
                        <>
                          <strong>Excellent cost efficiency</strong> with {savingsPercent}% savings on fuel
                          costs
                        </>
                      ),
                    },
                    {
                      text: (
                        <>
                          <strong>Low traffic conditions</strong> ensure consistent speeds and reduced
                          emissions
                        </>
                      ),
                    },
                    {
                      text: (
                        <>
                          <strong>Highest efficiency score</strong> of {recommendedRoute.efficiencyScore}
                          /100 based on comprehensive analysis
                        </>
                      ),
                    },
                  ].map((item, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + index * 0.1 }}
                      className="flex items-start space-x-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>{item.text}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Route Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {routes.map((route, index) => (
            <motion.div
              key={route.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              <RouteCard route={route} fuelType={formData.fuelType} />
            </motion.div>
          ))}
        </div>

        {/* Map View */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white rounded-xl shadow-sm border border-slate-200 p-6"
        >
          <h2 className="text-xl font-bold text-slate-900 mb-4">Route Visualization</h2>
          <div className="bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg h-96 flex items-center justify-center relative overflow-hidden">
            {/* Map Background */}
            <img
              src="https://images.unsplash.com/photo-1677161838747-ea0190b27b73?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaXR5JTIwdHJhZmZpYyUyMG5hdmlnYXRpb258ZW58MXx8fHwxNzczMjAxNjAxfDA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="City Traffic Navigation"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            
            <div className="text-center z-10 relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              >
                <Navigation className="w-12 h-12 text-teal-600 mx-auto mb-3" />
              </motion.div>
              <p className="text-slate-600">Interactive map with all routes highlighted</p>
              <p className="text-sm text-slate-500 mt-2">
                Green: Recommended • Orange: Alternative • Red: Congested
              </p>
            </div>
            
            {/* Route indicators */}
            <div className="absolute top-4 left-4 space-y-2">
              {routes.map((route, index) => (
                <motion.div
                  key={route.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + index * 0.1 }}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                    route.isRecommended
                      ? 'bg-green-500 text-white'
                      : 'bg-white border border-slate-300'
                  }`}
                >
                  <motion.div
                    animate={{ scale: route.isRecommended ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 1.5, repeat: route.isRecommended ? Infinity : 0 }}
                    className={`w-3 h-3 rounded-full ${
                      route.isRecommended
                        ? 'bg-white'
                        : route.trafficLevel === 'heavy'
                        ? 'bg-red-500'
                        : route.trafficLevel === 'moderate'
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                  ></motion.div>
                  <span className="text-sm font-medium">{route.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function RouteCard({ route, fuelType }: { route: RouteData; fuelType: string }) {
  const trafficColors = {
    low: 'bg-green-100 text-green-700 border-green-300',
    moderate: 'bg-orange-100 text-orange-700 border-orange-300',
    heavy: 'bg-red-100 text-red-700 border-red-300',
  };

  const trafficIcons = {
    low: <CheckCircle2 className="w-4 h-4" />,
    moderate: <Clock className="w-4 h-4" />,
    heavy: <AlertTriangle className="w-4 h-4" />,
  };

  return (
    <motion.div
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={`bg-white rounded-xl shadow-md border-2 transition-all ${
        route.isRecommended
          ? 'border-green-400 ring-4 ring-green-100'
          : 'border-slate-200 hover:border-teal-300'
      }`}
    >
      {/* Header */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-slate-900 text-lg">{route.name}</h3>
          {route.isRecommended && (
            <motion.span
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full flex items-center space-x-1"
            >
              <Award className="w-3 h-3" />
              <span>BEST</span>
            </motion.span>
          )}
        </div>

        {/* Efficiency Score */}
        <div className="flex items-center space-x-2 mb-3">
          <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${route.efficiencyScore}%` }}
              transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                route.efficiencyScore >= 90
                  ? 'bg-green-500'
                  : route.efficiencyScore >= 75
                  ? 'bg-blue-500'
                  : 'bg-orange-500'
              }`}
            ></motion.div>
          </div>
          <span className="text-sm font-bold text-slate-700">{route.efficiencyScore}</span>
        </div>

        {/* Traffic Badge */}
        <div
          className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full border text-xs font-medium ${
            trafficColors[route.trafficLevel]
          }`}
        >
          {trafficIcons[route.trafficLevel]}
          <span>{route.trafficLevel.charAt(0).toUpperCase() + route.trafficLevel.slice(1)} Traffic</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-6 space-y-4">
        <MetricRow
          icon={<Navigation className="w-4 h-4 text-blue-600" />}
          label="Distance"
          value={`${route.distance} mi`}
        />
        <MetricRow
          icon={<Clock className="w-4 h-4 text-purple-600" />}
          label="Duration"
          value={`${route.duration} min`}
        />
        <MetricRow
          icon={<Fuel className="w-4 h-4 text-orange-600" />}
          label={fuelType === 'electric' ? 'Energy Used' : 'Fuel Used'}
          value={`${route.fuelConsumption} ${fuelType === 'electric' ? 'kWh' : 'gal'}`}
        />
        <MetricRow
          icon={<DollarSign className="w-4 h-4 text-green-600" />}
          label="Estimated Cost"
          value={`₱${route.cost.toFixed(2)}`}
          highlight={route.isRecommended}
        />
        <MetricRow
          icon={<Leaf className="w-4 h-4 text-green-600" />}
          label="CO₂ Emission"
          value={`${route.co2Emission} kg`}
        />
      </div>
    </motion.div>
  );
}

function MetricRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg ${
        highlight ? 'bg-green-50 border border-green-200' : 'bg-slate-50'
      }`}
    >
      <div className="flex items-center space-x-2">
        {icon}
        <span className="text-sm text-slate-600">{label}</span>
      </div>
      <span className={`font-semibold ${highlight ? 'text-green-700' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}