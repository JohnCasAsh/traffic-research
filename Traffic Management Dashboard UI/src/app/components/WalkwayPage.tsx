import { PersonStanding, MapPin, Clock, Shield } from 'lucide-react';

export function WalkwayPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-teal-100 flex items-center justify-center mx-auto">
          <PersonStanding className="w-10 h-10 text-teal-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Walkway</h1>
          <p className="text-slate-500 mt-2 text-sm leading-relaxed">
            Pedestrian-friendly routes and walkway mapping for Tuguegarao City — coming soon.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-left space-y-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Planned Features</p>
          <ul className="space-y-3">
            {[
              { icon: MapPin, text: 'Safe walking routes with footpath indicators' },
              { icon: Clock, text: 'Estimated walking time and distance' },
              { icon: Shield, text: 'Avoid high-traffic and unsafe crossings' },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <div className="w-6 h-6 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-teal-600" />
                </div>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-slate-400">
          This feature is part of the multi-modal routing system being developed for the thesis research.
        </p>
      </div>
    </div>
  );
}
