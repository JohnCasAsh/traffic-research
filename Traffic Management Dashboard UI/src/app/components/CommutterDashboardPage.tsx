import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ParkingSquare, PersonStanding, MessageSquare, MapPin, Fuel, ChevronRight } from 'lucide-react';
import { useAuth } from '../auth';
import { API_URL } from '../api';

type PinSummary = { total: number; parking: number; gas: number };

export function CommutterDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<PinSummary>({ total: 0, parking: 0, gas: 0 });

  const GAS_TYPES = ['gas_station', 'gasoline_station', 'fuel_station'];

  useEffect(() => {
    fetch(`${API_URL}/api/parking`)
      .then(r => r.json())
      .then(data => {
        const locs = data.locations ?? [];
        setSummary({
          total: locs.length,
          parking: locs.filter((l: { type: string }) => !GAS_TYPES.includes(l.type)).length,
          gas: locs.filter((l: { type: string }) => GAS_TYPES.includes(l.type)).length,
        });
      })
      .catch(() => {});
  }, []);

  const firstName = user?.firstName?.trim() || 'there';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hello, {firstName}!</h1>
          <p className="text-sm text-slate-500 mt-1">Here's what's available in Tuguegarao City.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-teal-600">{summary.total}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Pins</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{summary.parking}</p>
            <p className="text-xs text-slate-500 mt-0.5">Parking Spots</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-orange-500">{summary.gas}</p>
            <p className="text-xs text-slate-500 mt-0.5">Gas Stations</p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Features</p>

          <Link to="/parking-way" className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-4 hover:border-teal-400 hover:shadow-sm transition group">
            <div className="w-11 h-11 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
              <ParkingSquare className="w-5 h-5 text-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm">Parking Way</p>
              <p className="text-xs text-slate-500 mt-0.5">Find parking & gas stations — walk or ride there</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-teal-500 transition flex-shrink-0" />
          </Link>

          <Link to="/walkway" className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-4 hover:border-blue-400 hover:shadow-sm transition group">
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <PersonStanding className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm">Walkway</p>
              <p className="text-xs text-slate-500 mt-0.5">Safe pedestrian routes across the city</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition flex-shrink-0" />
          </Link>

          <Link to="/feedback" className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 p-4 hover:border-purple-400 hover:shadow-sm transition group">
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm">Feedback & Report</p>
              <p className="text-xs text-slate-500 mt-0.5">Report traffic issues, road conditions, and more</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-500 transition flex-shrink-0" />
          </Link>
        </div>

        {/* Location note */}
        <div className="flex items-start gap-2 text-xs text-slate-400">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>Coverage area: Tuguegarao City, Cagayan, Philippines</span>
        </div>

      </div>
    </div>
  );
}
